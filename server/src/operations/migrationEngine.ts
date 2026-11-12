import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createDatabase, readDatabaseConfig } from "../db/core/createDatabase";
import { getAppDb } from "../db/appDb";
import type { DbClient } from "../db/core/types";
import { prepareDatabaseSchema } from "../db/schema/runner";
import { markTransferReady, readInstallation } from "../db/installationStore";
import { enterMaintenance, exitMaintenance, readOperationState } from "./maintenance";
import { activeTask, getTask, newTask, saveTask, type MigrationTask } from "./migrationTasks";
import { safeError } from "./mysqlTarget";
import { createSnapshot, getSnapshot, hashFile, inspectSqlite, sourcePath, type Source, type SourceTable } from "./sqliteSnapshots";
import { resourcePath } from "./stateStore";
import { snapshotDatabase } from "./databaseSnapshot";
import { standbyConfig, configIdentity, inspectTarget, redactedTarget, targetExists } from "./databaseTarget";
import { archiveLegacyTables, ensureSqliteArchives, replaceFromSnapshot, validateCopySource } from "./databaseCopy";

export interface Preflight { passed:boolean; checks:Array<{name:string;ok:boolean;detail:string}>; tables:SourceTable[]; totalRows:number; target?:ReturnType<typeof redactedTarget> }
export interface MigrationOptions { mode?:"sync"|"switch"; confirmOverwrite?:boolean }
export async function preflight(source:Source,_retryTaskId?:string):Promise<Preflight>{
  const checks:Preflight["checks"]=[];let tables:SourceTable[]=[];let target:DbClient|undefined;let targetInfo:Preflight["target"];
  try{
    if(source.sourceType==="server"&&readDatabaseConfig().type==="MYSQL"){
      const {catalog}=await import("./databaseSnapshot.js");
      tables=(await catalog(getAppDb())).map(t=>({name:t.name,count:t.count,columns:t.columns,primaryKey:t.primaryKey}));
    }else tables=inspectSqlite(sourcePath(source));
    validateCopySource(tables);checks.push({name:"源库结构",ok:true,detail:`${tables.length} 张表，未识别非空数据禁止静默丢弃`});
    if(source.sourceType!=="server"||readDatabaseConfig().type==="SQLITE"){
      const db=new DatabaseSync(sourcePath(source),{readOnly:true});
      try{
        if(tables.some(t=>t.name==="app_installation")){
          const marker=db.prepare("SELECT transfer_status FROM app_installation WHERE id=1").get();
          if(marker?.transfer_status!=="ready")throw new Error("来源含未完成复制标记，禁止使用半成品");
        }
      }finally{db.close();}
    }else if((await readInstallation())?.transfer_status!=="ready")throw new Error("当前源库有未完成复制标记");
  }catch(error){checks.push({name:"源库检查",ok:false,detail:safeError(error)});}
  try{
    const config=standbyConfig();targetInfo=redactedTarget(config);
    if(source.sourceType!=="server"&&config.type==="SQLITE")throw new Error("外部 SQLite 文件只能导入 MySQL，禁止覆盖当前运行库");
    if(targetExists(config)){target=await createDatabase(config);await inspectTarget(target);}
    checks.push({name:"目标库",ok:true,detail:"目标已有数据将先备份再完整替换，目标须停止其他服务写入"});
  }catch(error){checks.push({name:"目标库检查",ok:false,detail:safeError(error)});}
  finally{await target?.close();}
  return {passed:checks.every(c=>c.ok),checks,tables,totalRows:tables.filter(t=>t.name!=="schema_migrations").reduce((n,t)=>n+t.count,0),target:targetInfo};
}
export function startMigration(source:Source,_retryTaskId?:string,options:MigrationOptions={}):MigrationTask{
  if(activeTask())throw new Error("已有复制任务正在运行");
  if(options.confirmOverwrite!==true)throw new Error("需明确确认目标已停止写入并允许完整覆盖");
  if(options.mode!=="sync"&&options.mode!=="switch")throw new Error("请选择同步副本或准备切库");
  const identity=configIdentity(standbyConfig());
  const task=newTask(source);task.mode=options.mode;task.sourceDialect=readDatabaseConfig().type==="MYSQL"?"mysql":"sqlite";
  task.targetDialect=task.sourceDialect==="mysql"?"sqlite":"mysql";task.targetFingerprint=identity;
  saveTask(task);
  void runMigration(task).catch(error=>{task.targetUsable=false;task.error=safeError(error);saveTask(task,"FAILED","复制失败，保留源库、目标备份与维护状态；确认任务停止后可恢复源库");});
  return task;
}
async function runMigration(task:MigrationTask):Promise<void>{
  const check=await preflight(task.source);if(!check.passed)throw new Error("预检查未通过："+check.checks.filter(c=>!c.ok).map(c=>c.detail).join("；"));
  saveTask(task,"QUIESCING","进入维护并排空业务写入");await enterMaintenance(task.id);
  saveTask(task,"SNAPSHOTTING","备份源库与目标库，备份失败不覆盖");
  const snapshot=await createSnapshot(task.source);task.snapshotId=snapshot.id;task.sourceSha256=snapshot.sha256;saveTask(task);
  const work=resourcePath("working",task.id,".db");fs.mkdirSync(path.dirname(work),{recursive:true});
  let source:DatabaseSync|undefined,target:DbClient|undefined;
  try{
    const config=standbyConfig();if(configIdentity(config)!==task.targetFingerprint)throw new Error("任务执行期间目标配置已改变");
    target=await createDatabase(config);await inspectTarget(target);
    const backup=await snapshotDatabase(target);task.targetBackupId=backup.id;saveTask(task);
    fs.copyFileSync(sourcePath({sourceType:"snapshot",sourceId:snapshot.id}),work);
    source=new DatabaseSync(work);archiveLegacyTables(source);
    saveTask(task,"INITIALIZING","准备目标表结构与复制中断标记");
    await prepareDatabaseSchema(target,task.id);await ensureSqliteArchives(target);
    saveTask(task,"IMPORTING","以源库为准完整替换目标业务数据");
    await replaceFromSnapshot(source,target,task);
    if(await hashFile(sourcePath({sourceType:"snapshot",sourceId:snapshot.id}))!==snapshot.sha256)throw new Error("源备份摘要变化，保持目标不可切换");
    await markTransferReady(target);task.targetUsable=true;
    if(task.mode==="switch")saveTask(task,"READY_TO_SWITCH","目标全量校验通过，保持维护；修改 DB_TYPE 后重启");
    else{await exitMaintenance();saveTask(task,"COMPLETED","副本同步完成，源库恢复；源库后续写入会使副本过时");}
  }finally{source?.close();await target?.close();if(fs.existsSync(work))fs.unlinkSync(work);}
}
export async function cancelMaintenance():Promise<void>{
  if(activeTask())throw new Error("复制任务仍在运行，不能退出维护");
  await getAppDb().queryOne("SELECT 1 AS readable");
  if((await readInstallation())?.transfer_status!=="ready")throw new Error("当前库是未完成复制的目标，不能恢复业务");
  const state=readOperationState();await exitMaintenance();
  if(state.taskId){const task=getTask(state.taskId);saveTask(task,task.status,"管理员确认复制已停止，恢复源库业务；切库前必须重新同步");}
}

/** 离线恢复：先停止目标服务，不要求本机旧迁移完成记录。 */
export async function restoreTargetBackup(snapshotId:string,confirm:boolean):Promise<void>{
  if(!confirm||activeTask())throw new Error("请确认停止目标服务且无复制任务运行");
  const backup=getSnapshot(snapshotId),file=sourcePath({sourceType:"snapshot",sourceId:snapshotId});
  if(await hashFile(file)!==backup.sha256)throw new Error("备份摘要不匹配，禁止恢复");
  const source=new DatabaseSync(file,{readOnly:true});let target:DbClient|undefined;
  try{
    // 先独立确认备份可恢复，再连接目标；备份里的半成品绝不能因恢复操作升级为 ready。
    const { MYSQL_TABLES, SCHEMA_VERSION } = await import("../db/schema/runner.js");
    const { BACKUP_MANIFEST } = await import("./databaseSnapshot.js");
    const tables = inspectSqlite(file).filter(table=>table.name!==BACKUP_MANIFEST);
    validateCopySource(tables);
    const names = new Set(tables.map(table=>table.name));
    if (tables.length) {
      const missing = MYSQL_TABLES.filter(table=>table.name!=="site_page_view_records"&&!names.has(table.name));
      if (missing.length) throw new Error(`备份业务结构不完整，禁止恢复：${missing.map(table=>table.name).join(",")}`);
      let version: number | undefined;
      if (names.has("schema_migrations")) {
        const ledger = source.prepare("SELECT version,status FROM schema_migrations ORDER BY version DESC LIMIT 1").get();
        version = Number(ledger?.version);
        if (!ledger || ledger.status!=="applied" || ![1,2,SCHEMA_VERSION].includes(version)) throw new Error("备份 Schema 账本未完成或版本不支持，禁止恢复");
      }
      if (names.has("app_installation")) {
        const markers = source.prepare("SELECT id,transfer_status FROM app_installation").all();
        if (markers.length!==1 || Number(markers[0]?.id)!==1 || markers[0]?.transfer_status!=="ready") throw new Error("备份包含未完成复制或缺失安装标记，禁止恢复");
        if (version!==2 && version!==SCHEMA_VERSION) throw new Error("带安装标记的备份缺少当前完整 Schema 账本，禁止恢复");
      } else if (version===SCHEMA_VERSION) throw new Error("当前版本备份缺失安装标记，禁止恢复");
      if (version===SCHEMA_VERSION && !names.has("site_page_view_records")) throw new Error("v3 备份缺少 PV 事件表，禁止恢复");
      // 无标记的旧备份仅兼容完整业务结构，账本可缺省或为已应用 v1；归档容器允许补空。
    }
    target=await createDatabase(standbyConfig());await inspectTarget(target);await prepareDatabaseSchema(target,"backup-restore");await ensureSqliteArchives(target);
    const task=newTask({sourceType:"snapshot",sourceId:snapshotId});
    try{await replaceFromSnapshot(source,target,task);await markTransferReady(target);task.targetUsable=true;saveTask(task,"COMPLETED","目标备份恢复并校验成功");}
    catch(error){task.error=safeError(error);saveTask(task,"FAILED","恢复失败，目标保持不可切换");throw error;}
  }finally{source.close();await target?.close();}
}
