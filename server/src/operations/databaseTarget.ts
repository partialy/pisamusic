import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createDatabase, readDatabaseConfig } from "../db/core/createDatabase";
import type { DatabaseConfig } from "../db/core/config";
import type { DbClient } from "../db/core/types";
import { catalog } from "./databaseSnapshot";
import { copyTableNames } from "./databaseCopy";

export function standbyConfig():DatabaseConfig{
  const current=readDatabaseConfig();
  if(current.type==="MYSQL"&&!process.env.PISA_APP_DB_PATH?.trim())throw new Error("请明确配置 PISA_APP_DB_PATH 作为 SQLite 迁移目标");
  return readDatabaseConfig({...process.env,DB_TYPE:current.type==="MYSQL"?"SQLITE":"MYSQL"});
}
export function configIdentity(config:DatabaseConfig):string{
  return createHash("sha256").update(JSON.stringify(config.type==="SQLITE"?["sqlite",path.resolve(config.path)]:["mysql",config.host,config.port,config.database])).digest("hex");
}
export function redactedTarget(config=standbyConfig()){
  return config.type==="MYSQL"?{type:config.type,host:config.host,port:config.port,database:config.database}:{type:config.type,file:path.basename(config.path)};
}
export async function openStandby():Promise<DbClient>{return createDatabase(standbyConfig());}
export async function inspectTarget(db:DbClient):Promise<void>{
  const allowed=copyTableNames();allowed.add("schema_migrations");
  const tables=await catalog(db);
  const unknown=tables.filter(t=>!allowed.has(t.name));
  // 无关表一律拒绝，避免覆盖或备份时误碰不属于本应用的资产。
  if(unknown.length)throw new Error(`目标含未识别表 ${unknown.map(t=>t.name).join(",")}，请先处理旧数据或选择专用目标库`);
  if(db.dialect==="mysql"){
    const version=await db.queryOne<{version:string}>("SELECT VERSION() AS version");
    if(!version?.version.startsWith("5.7."))throw new Error("本轮仅支持 MySQL 5.7");
  }
}
/** 预检查 SQLite 不隐式创建数据库文件。 */
export function targetExists(config:DatabaseConfig):boolean{return config.type==="MYSQL"||fs.existsSync(config.path);}
