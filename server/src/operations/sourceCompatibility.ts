import { DatabaseSync } from "node:sqlite";
import { MYSQL_ARCHIVE_TABLES, MYSQL_TABLES } from "../db/schema/runner";
import type { SchemaColumn, SchemaTable } from "../db/schema/types";
import type { SqlValue } from "../db/core/types";
import { quoteIdentifier, type SourceTable } from "./sqliteSnapshots";

export function checkSourceTables(tables: SourceTable[]): string[] {
  const errors: string[] = [];
  const current = new Map(MYSQL_TABLES.map(t=>[t.name,t]));
  const archives = new Set(MYSQL_ARCHIVE_TABLES.map(t=>t.sourceTable));
  for (const table of tables) {
    if (table.name === "schema_migrations") continue;
    const target = current.get(table.name);
    if (!target) {
      if (!archives.has(table.name) && table.count > 0) errors.push(`未知非空表 ${table.name}，需明确归档映射`);
      continue;
    }
    const expected = new Set(target.columns.filter(c=>!c.generated).map(c=>c.name));
    for (const col of table.columns) if (!expected.has(col)) errors.push(`未识别字段 ${table.name}.${col}，禁止静默丢弃`);
    for (const col of target.columns) {
      if (!col.generated && !table.columns.includes(col.name) && !col.nullable && col.default === undefined) errors.push(`缺少必要字段 ${table.name}.${col.name}`);
    }
  }
  return errors;
}
export function selectSourceColumns(db: DatabaseSync, table: SchemaTable, source: SourceTable): string {
  return table.columns.filter(c=>!c.generated).map(c => {
    if (source.columns.includes(c.name)) return quoteIdentifier(c.name);
    // 默认值来自受控Schema而非上传内容；仅转换临时快照取数，不ALTER源库。
    return `${c.default ?? "NULL"} AS ${quoteIdentifier(c.name)}`;
  }).join(",");
}
export function normalizeValue(value: unknown, column: SchemaColumn): SqlValue {
  if (value === null || value === undefined) {
    if (!column.nullable) throw new Error(`非空字段无值 ${column.name}`);
    return null;
  }
  if (column.sqliteType === "INTEGER" || column.sqliteType === "REAL") {
    const number = Number(value);
    if (!Number.isFinite(number) || (column.sqliteType === "INTEGER" && !Number.isSafeInteger(number))) throw new Error(`数值超出安全范围 ${column.name}`);
    return number;
  }
  if (typeof value !== "string") throw new Error(`字段类型不兼容 ${column.name}`);
  const max = /^VARCHAR\((\d+)\)$/.exec(column.type);
  if (max && [...value].length > Number(max[1])) throw new Error(`字段长度超出目标上限 ${column.name}`);
  return value;
}
export function normalizedRow(row: Record<string,unknown>, columns: readonly SchemaColumn[]): SqlValue[] { return columns.map(c => normalizeValue(row[c.name],c)); }
export function archiveJson(value: unknown): string {
  return JSON.stringify(value, (_key,v) => typeof v === "bigint" ? {$bigint:String(v)} : v instanceof Uint8Array ? {$blob:Buffer.from(v).toString("base64")} : v);
}
