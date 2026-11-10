import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { setImmediate as yieldEventLoop } from "node:timers/promises";
import { createDatabase, readDatabaseConfig } from "../db/core/createDatabase";
import type { DbClient } from "../db/core/types";
import { initializeSchema, MYSQL_TABLES, MYSQL_ARCHIVE_TABLES, schemaFingerprint as expectedSchemaFingerprint } from "../db/schema/runner";
import type { SchemaTable } from "../db/schema/types";
import { enterMaintenance, exitMaintenance, readOperationState, writeOperationState } from "./maintenance";
import { activeTask, getTask, newTask, saveTask, type MigrationTask } from "./migrationTasks";
import { openTarget, safeError, schemaFingerprint, targetFingerprint, targetTables } from "./mysqlTarget";
import { archiveJson, checkSourceTables, normalizedRow, selectSourceColumns } from "./sourceCompatibility";
import { createSnapshot, getSnapshot, hashFile, inspectSqlite, quoteIdentifier as q, sourcePath, type Source, type SourceTable } from "./sqliteSnapshots";

const batchSize = Math.min(2000, Math.max(1, Number(process.env.DB_MIGRATION_BATCH_SIZE) || 500));
export interface Preflight { passed: boolean; checks: Array<{name:string;ok:boolean;detail:string}>; tables: SourceTable[]; totalRows:number }
export async function preflight(source: Source, retryTaskId?: string): Promise<Preflight> {
  const checks: Preflight["checks"] = [];
  let tables: SourceTable[] = [];
  try {
    tables = inspectSqlite(sourcePath(source));
    checks.push({name:"SQLite 完整性",ok:true,detail:`${tables.length} 张表`});
    const errors = checkSourceTables(tables);
    checks.push({name:"源结构兼容",ok:!errors.length,detail:errors.join("；") || "字段与历史归档映射已识别"});
  } catch (e) { checks.push({name:"SQLite 来源",ok:false,detail:safeError(e)}); }
  checks.push({name:"运行模式",ok:readDatabaseConfig().type === "SQLITE",detail:"仅 SQLite 模式可迁移，MySQL 正式运行后禁止再次导入"});
  let target: DbClient | undefined;
  try {
    target = await openTarget();
    const names = await targetTables(target);
    let owned = false;
    if (retryTaskId && names.length) { await assertRetryOwnership(target,getTask(retryTaskId),names); owned = true; }
    checks.push({name:"MySQL 5.7 与空库",ok:names.length===0 || owned,detail:owned ? "目标仅含上次任务创建的对象，重试将清理后重建" : names.length ? "目标存在数据表，禁止覆盖" : "连接成功，目标为空"});
  } catch(e) { checks.push({name:"MySQL 目标",ok:false,detail:safeError(e)}); }
  finally { await target?.close(); }
  return {passed:checks.every(c=>c.ok),checks,tables,totalRows:tables.filter(t=>t.name!=="schema_migrations").reduce((n,t)=>n+t.count,0)};
}
async function assertRetryOwnership(db: DbClient, task: MigrationTask, names: string[]): Promise<void> {
  if (!["FAILED","INTERRUPTED"].includes(task.status) || task.targetFingerprint !== targetFingerprint() || task.schemaFingerprint && task.schemaFingerprint !== expectedSchemaFingerprint) throw new Error("失败任务或目标指纹不匹配，禁止清理");
  if (readOperationState().activatedMysql) throw new Error("目标已正式启用，禁止清理");
  const row = await db.queryOne<{task_id:string;created_objects_json:string}>("SELECT task_id,created_objects_json FROM schema_migrations WHERE version=1");
  if (!row || row.task_id !== task.id) throw new Error("无法核验迁移对象所有权");
  const created = JSON.parse(row.created_objects_json) as string[];
  const allowed = new Set(["schema_migrations",...MYSQL_TABLES.map(t=>t.name),...MYSQL_ARCHIVE_TABLES.map(t=>t.name)]);
  if (names.some(name=>!created.includes(name) || !allowed.has(name))) throw new Error("发现不属于失败任务的目标表，禁止清理");
}
function orderedTables(): SchemaTable[] {
  const remaining = [...MYSQL_TABLES]; const ordered: SchemaTable[] = []; const done = new Set<string>();
  while (remaining.length) {
    const index = remaining.findIndex(t=>t.foreignSql.every(sql=>[...sql.matchAll(/REFERENCES\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/gi)].every(m=>done.has(m[1]!))));
    if (index < 0) throw new Error("目标外键存在循环依赖，需要明确 staging 方案");
    const table = remaining.splice(index,1)[0]!; ordered.push(table); done.add(table.name);
  }
  return ordered;
}
async function clearRetryTarget(db: DbClient, previous: MigrationTask): Promise<void> {
  const names = await targetTables(db);
  if (!names.length) return;
  await assertRetryOwnership(db,previous,names);
  // 子表先删除，不关闭外键校验。只处理已核验的本任务表。
  const order = [...MYSQL_ARCHIVE_TABLES.map(t=>t.name),...orderedTables().reverse().map(t=>t.name),"schema_migrations"];
  for (const name of order) if (names.includes(name)) await db.execute(`DROP TABLE ${q(name)}`);
}
export function startMigration(source: Source, retryTaskId?: string): MigrationTask {
  if (readDatabaseConfig().type !== "SQLITE") throw new Error("MySQL 模式禁止导入");
  if (activeTask()) throw new Error("已有迁移任务正在运行");
  const state = readOperationState();
  if (state.activatedMysql) throw new Error("MySQL 已正式启用，禁止重复导入");
  if (state.maintenance && state.taskId && state.taskId !== retryTaskId) throw new Error("请先处理现有维护任务，或指定失败任务重试");
  const task = newTask(source);
  void runMigration(task,retryTaskId).catch(e=>{ task.error=safeError(e); saveTask(task,"FAILED","迁移失败，保留维护状态与源库"); });
  return task;
}
async function runMigration(task: MigrationTask, retryTaskId?: string): Promise<void> {
  const check = await preflight(task.source,retryTaskId);
  if (!check.passed) throw new Error("预检查未通过："+check.checks.filter(c=>!c.ok).map(c=>c.detail).join("；"));
  saveTask(task,"QUIESCING","进入维护并排空在途业务");
  await enterMaintenance(task.id);
  saveTask(task,"SNAPSHOTTING","生成维护后的一致性完整快照");
  const snapshot = await createSnapshot(task.source);
  task.snapshotId=snapshot.id; task.sourceSha256=snapshot.sha256; task.targetFingerprint=targetFingerprint(); task.schemaFingerprint=expectedSchemaFingerprint;
  const errors = checkSourceTables(snapshot.tables);
  if (errors.length) throw new Error("源库兼容检查失败："+errors.join("；"));
  const source = new DatabaseSync(sourcePath({sourceType:"snapshot",sourceId:snapshot.id}),{readOnly:true});
  let db: DbClient | undefined;
  try {
    db=await openTarget();
    if (retryTaskId) await clearRetryTarget(db,getTask(retryTaskId));
    if ((await targetTables(db)).length) throw new Error("目标库已被修改，不再为空");
    saveTask(task,"INITIALIZING","初始化版本化 MySQL 5.7 Schema");
    await initializeSchema(db,task.id);
    task.ownedTables=await targetTables(db);
    task.totalRows=snapshot.tables.filter(t=>t.name!=="schema_migrations").reduce((n,t)=>n+t.count,0);
    saveTask(task,"IMPORTING","按外键依赖顺序分批导入");
    for (const table of orderedTables()) await importTable(source,db,table,snapshot.tables.find(t=>t.name===table.name),task);
    for (const archive of MYSQL_ARCHIVE_TABLES) await importArchive(source,db,archive,snapshot.tables.find(t=>t.name===archive.sourceTable),task);
    saveTask(task,"VERIFYING","检查逐表记录、主键与全部字段摘要");
    for (const table of MYSQL_TABLES) await verifyTable(source,db,table,snapshot.tables.find(t=>t.name===table.name),task);
    if (await hashFile(sourcePath({sourceType:"snapshot",sourceId:snapshot.id})) !== snapshot.sha256) throw new Error("源快照 SHA-256 已变化");
    const fingerprint=await schemaFingerprint(db);
    // 数据完成标记独立于Schema applied，启动必须同时验证本地成功任务。
    await db.execute("UPDATE schema_migrations SET status=?,completed_at=? WHERE version=1 AND task_id=?",["applied",Date.now(),task.id]);
    writeOperationState({targetFingerprint:fingerprint});
    saveTask(task,"READY_TO_SWITCH","全量校验通过；保持维护，请修改 DB_TYPE=MYSQL 后重启");
  } finally { source.close(); await db?.close(); }
}
async function importTable(source: DatabaseSync,db:DbClient,table:SchemaTable,info:SourceTable|undefined,task:MigrationTask):Promise<void> {
  const result={name:table.name,sourceCount:info?.count??0,status:"IMPORTING"}; task.tables.push(result);task.currentTable=table.name;
  if (info) {
    const columns=table.columns.filter(c=>!c.generated); const fields=columns.map(c=>q(c.name)).join(",");
    for (let offset=0;offset<info.count;offset+=batchSize) {
      const rows=source.prepare(`SELECT ${selectSourceColumns(source,table,info)} FROM ${q(table.name)} ORDER BY ${table.primaryKey.map(q).join(",")} LIMIT ? OFFSET ?`).all(batchSize,offset);
      await db.transaction(async tx=>{for(const row of rows) await tx.execute(`INSERT INTO ${q(table.name)} (${fields}) VALUES (${columns.map(()=>"?").join(",")})`,normalizedRow(row,columns));});
      task.processedRows+=rows.length;saveTask(task);await yieldEventLoop();
    }
  }
  result.status="IMPORTED";saveTask(task);
}
async function verifyTable(source:DatabaseSync,db:DbClient,table:SchemaTable,info:SourceTable|undefined,task:MigrationTask):Promise<void> {
  const result=task.tables.find(t=>t.name===table.name)!;task.currentTable=table.name;
  const count=Number((await db.queryOne<{n:number}>(`SELECT COUNT(*) AS n FROM ${q(table.name)}`))!.n);result.targetCount=count;
  if(count!==(info?.count??0)) throw new Error(`表记录数不一致 ${table.name}`);
  const columns=table.columns.filter(c=>!c.generated);const left=createHash("sha256"),right=createHash("sha256");
  const fields=columns.map(c=>q(c.name)).join(",");const order=table.primaryKey.map(q).join(",");
  for(let offset=0;offset<count;offset+=batchSize){
    const rows=source.prepare(`SELECT ${selectSourceColumns(source,table,info!)} FROM ${q(table.name)} ORDER BY ${order} LIMIT ? OFFSET ?`).all(batchSize,offset);
    const target=await db.query<Record<string,unknown>>(`SELECT ${fields} FROM ${q(table.name)} ORDER BY ${order} LIMIT ${batchSize} OFFSET ${offset}`);
    for(const row of rows) left.update(JSON.stringify(normalizedRow(row,columns))+"\n");
    for(const row of target) right.update(JSON.stringify(normalizedRow(row,columns))+"\n");
    await yieldEventLoop();
  }
  result.sourceHash=left.digest("hex");result.targetHash=right.digest("hex");
  if(result.sourceHash!==result.targetHash) throw new Error(`主键或字段校验不一致 ${table.name}`);
  result.status="VERIFIED";saveTask(task);
}
async function importArchive(source:DatabaseSync,db:DbClient,archive:typeof MYSQL_ARCHIVE_TABLES[number],info:SourceTable|undefined,task:MigrationTask):Promise<void>{
  const result={name:archive.name,sourceCount:info?.count??0,targetCount:0,status:"IMPORTING"};task.tables.push(result);task.currentTable=archive.name;
  if(info){
    const ddl=String(source.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(info.name)!.sql);
    for(let offset=0;offset<info.count;offset+=batchSize){
      const rows=source.prepare(`SELECT * FROM ${q(info.name)} ORDER BY rowid LIMIT ? OFFSET ?`).all(batchSize,offset);
      await db.transaction(async tx=>{for(const row of rows) await tx.execute(`INSERT INTO ${q(archive.name)}(source_schema_sql,source_row_json) VALUES(?,?)`,[ddl,archiveJson(row)]);});
      const target=await db.query<{source_schema_sql:string;source_row_json:string}>(`SELECT source_schema_sql,source_row_json FROM ${q(archive.name)} ORDER BY archive_row_id LIMIT ${batchSize} OFFSET ${offset}`);
      if(target.length!==rows.length||target.some((row,i)=>row.source_schema_sql!==ddl||row.source_row_json!==archiveJson(rows[i]))) throw new Error(`历史归档校验失败 ${info.name}`);
      task.processedRows+=rows.length;saveTask(task);await yieldEventLoop();
    }
  }
  result.targetCount=Number((await db.queryOne<{n:number}>(`SELECT COUNT(*) AS n FROM ${q(archive.name)}`))!.n);
  if(result.sourceCount!==result.targetCount) throw new Error(`历史归档记录数不一致 ${archive.name}`);
  result.status="VERIFIED";saveTask(task);
}
export async function cancelMaintenance():Promise<void>{
  if(readDatabaseConfig().type!=="SQLITE"||activeTask()) throw new Error("当前模式或运行中任务不允许退出维护");
  const state=readOperationState();
  if(state.activatedMysql) throw new Error("MySQL 已正式启用，禁止直接回退");
  if(state.taskId){const task=getTask(state.taskId);if(task.snapshotId){const snapshot=getSnapshot(task.snapshotId);if(await hashFile(sourcePath({sourceType:"snapshot",sourceId:snapshot.id}))!==snapshot.sha256) throw new Error("回滚快照校验失败");}}
  // 连接当前SQLite验证可读，不执行初始化或修复。
  inspectSqlite(sourcePath({sourceType:"server"}));
  await exitMaintenance();
  if(state.taskId) saveTask(getTask(state.taskId),"CANCELLED","管理员确认取消迁移并恢复 SQLite");
}
