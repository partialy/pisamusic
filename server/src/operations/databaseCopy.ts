import { createHash, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { DbClient, DbTransaction, SqlValue } from "../db/core/types";
import { MYSQL_TABLES, MYSQL_ARCHIVE_TABLES } from "../db/schema/runner";
import type { SchemaTable } from "../db/schema/types";
import { archiveJson, normalizedRow, selectSourceColumns } from "./sourceCompatibility";
import { quoteIdentifier as q, inspectSqlite, type SourceTable } from "./sqliteSnapshots";
import { BACKUP_MANIFEST } from "./databaseSnapshot";
import { saveTask, type MigrationTask } from "./migrationTasks";

const installation:SchemaTable={name:"app_installation",columns:[
  {name:"id",type:"BIGINT",sqliteType:"INTEGER",nullable:false},
  {name:"installation_id",type:"VARCHAR(191)",sqliteType:"TEXT",nullable:false},
  {name:"initialized_at",type:"BIGINT",sqliteType:"INTEGER",nullable:true},
  {name:"transfer_status",type:"VARCHAR(32)",sqliteType:"TEXT",nullable:false},
  {name:"transfer_task_id",type:"VARCHAR(191)",sqliteType:"TEXT",nullable:true},
  {name:"legacy_user_tokens",type:"BIGINT",sqliteType:"INTEGER",nullable:false},
],primaryKey:["id"],createSql:"",foreignSql:[]};
const archives:SchemaTable[]=MYSQL_ARCHIVE_TABLES.map(a=>({name:a.name,columns:[
  {name:"archive_row_id",type:"BIGINT",sqliteType:"INTEGER",nullable:false},
  {name:"source_schema_sql",type:"LONGTEXT",sqliteType:"TEXT",nullable:false},
  {name:"source_row_json",type:"LONGTEXT",sqliteType:"TEXT",nullable:false},
],primaryKey:["archive_row_id"],createSql:"",foreignSql:[]}));

export function orderedCopyTables():SchemaTable[]{
  const remaining=[...MYSQL_TABLES],ordered:SchemaTable[]=[],done=new Set<string>();
  while(remaining.length){
    const i=remaining.findIndex(t=>t.foreignSql.every(sql=>[...sql.matchAll(/REFERENCES\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/gi)].every(m=>done.has(m[1]!))));
    if(i<0)throw new Error("表外键存在循环依赖");
    const table=remaining.splice(i,1)[0]!;ordered.push(table);done.add(table.name);
  }
  return [...ordered,...archives,installation];
}
export const copyTableNames=()=>new Set(orderedCopyTables().map(t=>t.name));

export function validateCopySource(tables:SourceTable[]):void{
  const current=new Map(orderedCopyTables().map(table=>[table.name,table]));
  const legacy=new Set(MYSQL_ARCHIVE_TABLES.map(table=>table.sourceTable));
  const errors:string[]=[];
  for(const table of tables){
    if(table.name==="schema_migrations"||table.name===BACKUP_MANIFEST)continue;
    const target=current.get(table.name);
    if(!target){
      if(!legacy.has(table.name)&&table.count>0)errors.push(`未知非空表 ${table.name}，需明确归档映射`);
      continue;
    }
    const expected=new Set(target.columns.filter(column=>!column.generated).map(column=>column.name));
    for(const column of table.columns)if(!expected.has(column))errors.push(`未识别字段 ${table.name}.${column}，禁止静默丢弃`);
    for(const column of target.columns)if(!column.generated&&!table.columns.includes(column.name)&&!column.nullable&&column.default===undefined)errors.push(`缺少必要字段 ${table.name}.${column.name}`);
  }
  if(errors.length)throw new Error(errors.join("；"));
}

/** 旧 SQLite 历史表转换为归档容器；后续往返直接复制容器，不恢复旧业务表。 */
export function archiveLegacyTables(source:DatabaseSync):void{
  for(const archive of MYSQL_ARCHIVE_TABLES){
    const legacy=source.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(archive.sourceTable);
    if(!legacy)continue;
    source.exec(`CREATE TABLE IF NOT EXISTS ${q(archive.name)} (archive_row_id INTEGER PRIMARY KEY AUTOINCREMENT,source_schema_sql TEXT NOT NULL,source_row_json TEXT NOT NULL)`);
    const count=Number(source.prepare(`SELECT COUNT(*) AS n FROM ${q(archive.name)}`).get()!.n);
    if(count)throw new Error("同时存在历史表和非空归档，需先人工确认，禁止覆盖归档");
    const insert=source.prepare(`INSERT INTO ${q(archive.name)} (source_schema_sql,source_row_json) VALUES (?,?)`);
    for(const row of source.prepare(`SELECT * FROM ${q(archive.sourceTable)}`).iterate())insert.run(String(legacy.sql),archiveJson(row));
  }
}
export async function ensureSqliteArchives(db:DbClient):Promise<void>{
  if(db.dialect!=="sqlite")return;
  for(const archive of archives)await db.execute(`CREATE TABLE IF NOT EXISTS ${q(archive.name)} (archive_row_id INTEGER PRIMARY KEY AUTOINCREMENT,source_schema_sql TEXT NOT NULL,source_row_json TEXT NOT NULL)`);
}

function readRows(source:DatabaseSync,table:SchemaTable,info:SourceTable,offset:number):Record<string,unknown>[] {
  return source.prepare(`SELECT ${selectSourceColumns(source,table,info)} FROM ${q(table.name)} ORDER BY ${table.primaryKey.map(q).join(",")} LIMIT 500 OFFSET ${offset}`).all();
}
/** 同一事务替换与校验，失败由数据库回滚；外部 incomplete 标记仍保留。 */
export async function replaceFromSnapshot(source:DatabaseSync,db:DbClient,task:MigrationTask):Promise<void>{
  const file=String(source.prepare("PRAGMA database_list").get()!.file);
  const tables=inspectSqlite(file).filter(t=>t.name!==BACKUP_MANIFEST);
  validateCopySource(tables);
  const ordered=orderedCopyTables();
  const infos=new Map(tables.map(t=>[t.name,t]));
  task.tables=[];task.totalRows=ordered.reduce((n,t)=>n+(infos.get(t.name)?.count||0),0);task.processedRows=0;
  const existingMarker=await db.queryOne<Record<string,SqlValue>>("SELECT * FROM app_installation WHERE id=1");
  await db.transaction(async tx=>{
    for(const table of [...ordered].reverse())await tx.execute(`DELETE FROM ${q(table.name)}`);
    for(const table of ordered){
      const info=infos.get(table.name),columns=table.columns.filter(c=>!c.generated),fields=columns.map(c=>q(c.name)).join(",");
      const result={name:table.name,sourceCount:info?.count||0,status:"IMPORTING"};task.tables.push(result);task.currentTable=table.name;
      if(info)for(let offset=0;offset<info.count;offset+=500){
        for(const row of readRows(source,table,info,offset)){
          await tx.execute(`INSERT INTO ${q(table.name)} (${fields}) VALUES (${columns.map(()=>"?").join(",")})`,normalizedRow(row,columns));task.processedRows++;
        }
        saveTask(task);
      }
      result.status="IMPORTED";
    }
    saveTask(task,"VERIFYING","核对全部表记录数、主键和字段摘要");
    for(const table of ordered)await verifyTable(source,tx,table,infos.get(table.name),task);
    // 无安装标记的旧导入库由后续初始化兼容逻辑认领；不能丢失目标任务防护标记。
    if(!infos.has("app_installation")&&existingMarker){
      existingMarker.installation_id=randomUUID();existingMarker.initialized_at=null;existingMarker.legacy_user_tokens=0;
      const keys=Object.keys(existingMarker);
      await tx.execute(`INSERT INTO app_installation (${keys.map(q).join(",")}) VALUES (${keys.map(()=>"?").join(",")})`,keys.map(k=>existingMarker[k]));
    }
    await tx.execute("UPDATE app_installation SET transfer_status='incomplete',transfer_task_id=? WHERE id=1",[task.id]);
  });
}
async function verifyTable(source:DatabaseSync,tx:DbTransaction,table:SchemaTable,info:SourceTable|undefined,task:MigrationTask):Promise<void>{
  const result=task.tables.find(t=>t.name===table.name)!;
  const n=Number((await tx.queryOne<{n:number}>(`SELECT COUNT(*) AS n FROM ${q(table.name)}`))!.n);result.targetCount=n;
  if(n!==(info?.count||0))throw new Error(`表记录数不一致 ${table.name}`);
  const left=createHash("sha256"),right=createHash("sha256"),cols=table.columns.filter(c=>!c.generated);
  for(let offset=0;offset<n;offset+=500){
    for(const row of readRows(source,table,info!,offset))left.update(JSON.stringify(normalizedRow(row,cols))+"\n");
    const rows=await tx.query<Record<string,unknown>>(`SELECT ${cols.map(c=>q(c.name)).join(",")} FROM ${q(table.name)} ORDER BY ${table.primaryKey.map(q).join(",")} LIMIT 500 OFFSET ${offset}`);
    for(const row of rows)right.update(JSON.stringify(normalizedRow(row,cols))+"\n");
  }
  result.sourceHash=left.digest("hex");result.targetHash=right.digest("hex");
  if(result.sourceHash!==result.targetHash)throw new Error(`字段或主键摘要不一致 ${table.name}`);
  result.status="VERIFIED";saveTask(task);
}
