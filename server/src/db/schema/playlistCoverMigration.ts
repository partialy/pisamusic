import { validatePlaylistCoverSchema } from "./playlistCoverValidation";
import { DatabaseError, type DbClient } from "../core/types";
import { playlistCoverTables } from "./mysql/playlistCovers";
/** 每张表与外键登记意图，失败保留账本；已建对象必须通过真实结构校验才能续迁。 */
export async function upgradeMysqlPlaylistCovers(client: DbClient, fingerprint: string, validate: (client: DbClient, name: string, ddl: string) => Promise<void>): Promise<void> {
  const task = "upgrade-v5-playlist-covers";
  if (!(await client.queryOne("SELECT version FROM schema_migrations WHERE version=4 AND status='applied'")))
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "封面升级要求已完成 v4 Schema");
  const ledger = await client.queryOne<{status: string; task_id: string; fingerprint: string; created_objects_json: string}>("SELECT * FROM schema_migrations WHERE version=5");
  if (ledger && (ledger.task_id !== task || ledger.fingerprint !== fingerprint || !["failed", "applying"].includes(ledger.status)))
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "v5 账本不属于可续迁封面任务");
  const created: string[] = ledger ? JSON.parse(ledger.created_objects_json) : [];
  const allowed = playlistCoverTables.flatMap(t => [t.name, ...t.foreignSql.map(sql => /CONSTRAINT `([^`]+)`/.exec(sql)![1]!)]);
  if (!Array.isArray(created) || created.some(n => !allowed.includes(n))) throw new DatabaseError("DB_SCHEMA_CONFLICT", "v5 账本对象无效");
  if (!ledger) await client.execute("INSERT INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at) VALUES(5,?,?,?,?,?)", [fingerprint, "applying", task, "[]", Date.now()]);
  else await client.execute("UPDATE schema_migrations SET status='applying',error_code=NULL WHERE version=5");
  const record = async (name: string) => {
    if (!created.includes(name)) { created.push(name); await client.execute("UPDATE schema_migrations SET created_objects_json=? WHERE version=5", [JSON.stringify(created)]); }
  };
  try {
    for (const table of playlistCoverTables) {
      const exists = await client.queryOne("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", [table.name]);
      if (exists && !created.includes(table.name)) throw new DatabaseError("DB_SCHEMA_CONFLICT", `封面表 ${table.name} 未登记在本任务`);
      await record(table.name);
      if (!exists) await client.execute(table.createSql);
      await validate(client, table.name, table.createSql);
      for (const ddl of table.foreignSql) {
        const name = /CONSTRAINT `([^`]+)`/.exec(ddl)![1]!;
        await record(name);
        const match = /FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)` \(`([^`]+)`\)/.exec(ddl)!;
        const keys = await client.query<{col:string;refTable:string;refCol:string;deleteRule:string}>("SELECT k.COLUMN_NAME AS col,k.REFERENCED_TABLE_NAME AS refTable,k.REFERENCED_COLUMN_NAME AS refCol,r.DELETE_RULE AS deleteRule FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME=? AND k.CONSTRAINT_NAME=?", [table.name,name]);
        if (!keys.length) await client.execute(ddl);
        else if (keys.length !== 1 || keys[0]!.col !== match[1] || keys[0]!.refTable !== match[2] || keys[0]!.refCol !== match[3] || !["RESTRICT","NO ACTION"].includes(keys[0]!.deleteRule)) throw new DatabaseError("DB_SCHEMA_CONFLICT", `封面外键 ${name} 不匹配`);
      }
    }
    await validatePlaylistCoverSchema(client);
    await client.execute("UPDATE schema_migrations SET status='applied',completed_at=?,error_code=NULL WHERE version=5", [Date.now()]);
  } catch (error) {
    await client.execute("UPDATE schema_migrations SET status='failed',error_code='DDL_FAILED' WHERE version=5").catch(() => undefined);
    throw error;
  }
}
