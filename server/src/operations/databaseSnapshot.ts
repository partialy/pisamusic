import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { DbClient, DbTransaction, SqlValue } from "../db/core/types";
import { atomicWrite, resourcePath } from "./stateStore";
import { hashFile, inspectSqlite, quoteIdentifier as q, type Snapshot } from "./sqliteSnapshots";

export const BACKUP_MANIFEST = "_pisa_backup_manifest";
export interface CatalogTable { name: string; columns: string[]; primaryKey: string[]; ddl: string; count: number }
export async function catalog(db: DbTransaction): Promise<CatalogTable[]> {
  if (db.dialect === "sqlite") {
    const tables = await db.query<{name:string;sql:string}>("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    return Promise.all(tables.filter(t=>t.name!==BACKUP_MANIFEST).map(async table=>{
      const cols=await db.query<{name:string;pk:number;hidden?:number}>(`PRAGMA table_xinfo(${q(table.name)})`);
      return {name:table.name,ddl:table.sql,columns:cols.filter(c=>!c.hidden).map(c=>c.name),primaryKey:cols.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name),count:Number((await db.queryOne<{n:number}>(`SELECT COUNT(*) AS n FROM ${q(table.name)}`))!.n)};
    }));
  }
  const tables=await db.query<{name:string}>("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
  const result: CatalogTable[]=[];
  for(const table of tables){
    const cols=await db.query<{name:string;extra:string}>("SELECT COLUMN_NAME AS name,EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION",[table.name]);
    const keys=await db.query<{name:string}>("SELECT COLUMN_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX",[table.name]);
    const ddl=await db.queryOne<Record<string,string>>(`SHOW CREATE TABLE ${q(table.name)}`);
    result.push({name:table.name,columns:cols.filter(c=>!c.extra.includes("GENERATED")).map(c=>c.name),primaryKey:keys.map(c=>c.name),ddl:ddl!["Create Table"]!,count:Number((await db.queryOne<{n:number}>(`SELECT COUNT(*) AS n FROM ${q(table.name)}`))!.n)});
  }
  return result;
}

/** MySQL 用只读一致性事务导出为便携 SQLite；内含原始 DDL，可独立恢复。 */
export async function snapshotDatabase(db: DbClient): Promise<Snapshot> {
  const id=randomUUID(), file=resourcePath("snapshots",id,".db"), temp=file+".partial";
  fs.mkdirSync(path.dirname(file),{recursive:true});
  let out:DatabaseSync|undefined;
  try{
    fs.closeSync(fs.openSync(temp,"wx",0o600));
    out=new DatabaseSync(temp);out.exec("PRAGMA journal_mode=DELETE;");
    const output=out;
    await db.transaction(async tx=>{
      const tables=await catalog(tx);
      output.exec(`CREATE TABLE ${q(BACKUP_MANIFEST)} (id INTEGER PRIMARY KEY, manifest_json TEXT NOT NULL)`);
      output.prepare(`INSERT INTO ${q(BACKUP_MANIFEST)} VALUES(1,?)`).run(JSON.stringify({format:1,dialect:db.dialect,createdAt:Date.now(),tables}));
      for(const table of tables){
        // 不施加目标引擎约束，避免备份格式转换改变原始值；正式复制另做逐字段校验。
        output.exec(`CREATE TABLE ${q(table.name)} (${table.columns.map(c=>q(c)).join(",")})`);
        const insert=output.prepare(`INSERT INTO ${q(table.name)} VALUES (${table.columns.map(()=>"?").join(",")})`);
        const fields=table.columns.map(q).join(","), order=table.primaryKey.length?` ORDER BY ${table.primaryKey.map(q).join(",")}`:"";
        for(let offset=0;offset<table.count;offset+=500){
          const rows=await tx.query<Record<string,SqlValue>>(`SELECT ${fields} FROM ${q(table.name)}${order} LIMIT 500 OFFSET ${offset}`);
          output.exec("BEGIN");
          try{for(const row of rows)insert.run(...table.columns.map(c=>{const v=row[c];return typeof v==="boolean"?Number(v):v;}));output.exec("COMMIT");}
          catch(e){output.exec("ROLLBACK");throw e;}
        }
      }
    });
    out.close();out=undefined;
    const tables=inspectSqlite(temp).filter(t=>t.name!==BACKUP_MANIFEST);
    const snapshot:Snapshot={id,tables,createdAt:Date.now(),size:fs.statSync(temp).size,sha256:await hashFile(temp),checkpoint:`${db.dialect.toUpperCase()} 一致性快照（含原始表结构）`};
    fs.renameSync(temp,file);atomicWrite(resourcePath("snapshots",id),snapshot);
    return snapshot;
  }catch(error){out?.close();if(fs.existsSync(temp))fs.unlinkSync(temp);throw error;}
}
