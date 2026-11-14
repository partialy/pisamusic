import type { DbClient } from "../core/types";
import { DatabaseError } from "../core/types";
import { playlistCoverTables } from "./mysql/playlistCovers";
/** 新表必须真实匹配后才能写入 v5 applied；禁止用户级联外键吞掉回收账本。 */
export async function validatePlaylistCoverSchema(client: DbClient): Promise<void> {
  for (const table of playlistCoverTables) {
    if (client.dialect === "sqlite") {
      const columns = await client.query<{name:string;type:string;notnull:number;pk:number;dflt_value:string|null}>(`PRAGMA table_info(${table.name})`);
      if (columns.length !== table.columns.length || table.columns.some(col => {
        const actual = columns.find(c => c.name === col.name);
        return !actual || actual.type !== col.sqliteType || (!col.nullable && !actual.notnull && !actual.pk)
          || (col.default !== undefined && actual.dflt_value !== col.default);
      })) throw new DatabaseError("DB_SCHEMA_CONFLICT", `SQLite 封面表 ${table.name} 结构不匹配`);
      const pk = columns.filter(c => c.pk).sort((a,b) => a.pk-b.pk).map(c => c.name);
      if (pk.join() !== table.primaryKey.join()) throw new DatabaseError("DB_SCHEMA_CONFLICT", `SQLite 封面表 ${table.name} 主键不匹配`);
      const foreign = await client.query<{table:string;from:string;to:string;on_delete:string;on_update:string}>(`PRAGMA foreign_key_list(${table.name})`);
      const expected = table.foreignSql.map(sql => /FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)` \(`([^`]+)`\)/.exec(sql)!);
      if (foreign.length !== expected.length || expected.some(e => !foreign.some(f => f.from === e[1] && f.table === e[2] && f.to === e[3] && f.on_delete === "NO ACTION" && f.on_update === "NO ACTION"))) throw new DatabaseError("DB_SCHEMA_CONFLICT", `SQLite 封面表 ${table.name} 外键不匹配`);
      const indexes = await client.query<{name:string;unique:number}>(`PRAGMA index_list(${table.name})`);
      for (const required of [...table.createSql.matchAll(/(UNIQUE KEY|KEY) `([^`]+)` \(([^)]+)\)/g)]) {
        const fields = [...required[3]!.matchAll(/`([^`]+)`/g)].map(m => m[1]).join();
        let found = false;
        for (const index of indexes) {
          if (Boolean(index.unique) !== (required[1] === "UNIQUE KEY")) continue;
          const names = await client.query<{seqno:number;name:string}>(`PRAGMA index_info("${index.name.replace(/"/g,'""')}")`);
          if (names.sort((a,b) => a.seqno-b.seqno).map(c => c.name).join() === fields) found = true;
        }
        if (!found) throw new DatabaseError("DB_SCHEMA_CONFLICT", `SQLite 封面表 ${table.name} 缺少索引`);
      }
    } else {
      const foreign = await client.query<{name:string;col:string;refTable:string;refCol:string;deleteRule:string;updateRule:string}>("SELECT k.CONSTRAINT_NAME AS name,k.COLUMN_NAME AS col,k.REFERENCED_TABLE_NAME AS refTable,k.REFERENCED_COLUMN_NAME AS refCol,r.DELETE_RULE AS deleteRule,r.UPDATE_RULE AS updateRule FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME=? AND k.REFERENCED_TABLE_NAME IS NOT NULL", [table.name]);
      const expected = table.foreignSql.map(sql => /CONSTRAINT `([^`]+)` FOREIGN KEY \(`([^`]+)`\) REFERENCES `([^`]+)` \(`([^`]+)`\)/.exec(sql)!);
      if (foreign.length !== expected.length || expected.some(e => !foreign.some(f => f.name === e[1] && f.col === e[2] && f.refTable === e[3] && f.refCol === e[4] && ["RESTRICT","NO ACTION"].includes(f.deleteRule) && ["RESTRICT","NO ACTION"].includes(f.updateRule)))) throw new DatabaseError("DB_SCHEMA_CONFLICT", `MySQL 封面表 ${table.name} 外键不匹配`);
      const defaults = await client.query<{name:string;value:string|null}>("SELECT COLUMN_NAME AS name,COLUMN_DEFAULT AS value FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", [table.name]);
      for (const col of table.columns.filter(c => c.default !== undefined && c.type !== "LONGTEXT")) {
        const expectedValue = col.default!.replace(/^'|'$/g,"");
        if (String(defaults.find(c => c.name === col.name)?.value) !== expectedValue) throw new DatabaseError("DB_SCHEMA_CONFLICT", `MySQL 封面表 ${table.name}.${col.name} 默认值不匹配`);
      }
    }
  }
}
