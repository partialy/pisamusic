import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { backup, DatabaseSync } from "node:sqlite";
import { atomicWrite, listJson, readJson, resourcePath } from "./stateStore";

export type Source = { sourceType: "server" | "upload" | "snapshot"; sourceId?: string };
export type SourceTable = { name: string; count: number; columns: string[]; primaryKey: string[] };
export type Snapshot = { id: string; sha256: string; size: number; createdAt: number; tables: SourceTable[]; checkpoint: string };
export type Upload = { id: string; size: number; createdAt: number; tables: SourceTable[] };

export function parseSource(value: unknown): Source {
  const body = value as Partial<Source> | null;
  if (!body || !["server", "upload", "snapshot"].includes(String(body.sourceType))) throw new Error("请选择数据库来源");
  if (body.sourceType !== "server" && (typeof body.sourceId !== "string" || !/^[a-f0-9-]{36}$/.test(body.sourceId))) throw new Error("无效来源 ID");
  return { sourceType: body.sourceType!, sourceId: body.sourceId };
}
export function sourcePath(source: Source): string {
  if (source.sourceType === "server") return path.resolve(process.env.PISA_APP_DB_PATH?.trim() || "data/pm.db");
  const kind = source.sourceType === "upload" ? "uploads" : "snapshots";
  readJson(resourcePath(kind, source.sourceId!));
  return resourcePath(kind, source.sourceId!, ".db");
}
export function quoteIdentifier(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("不支持的数据库标识符");
  return "`" + name + "`";
}
export function inspectSqlite(file: string): SourceTable[] {
  const header = Buffer.alloc(16);
  const fd = fs.openSync(file, "r");
  try { fs.readSync(fd, header, 0, 16, 0); } finally { fs.closeSync(fd); }
  if (header.toString("binary") !== "SQLite format 3\0") throw new Error("文件不是 SQLite 数据库");
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const integrity = db.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || Object.values(integrity[0]!)[0] !== "ok") throw new Error("SQLite 完整性检查失败");
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("SQLite 外键检查失败");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    return tables.map(row => {
      const name = String(row.name);
      const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(name)})`).all();
      const count = Number(db.prepare(`SELECT COUNT(*) AS n FROM ${quoteIdentifier(name)}`).get()!.n);
      return { name, count, columns: columns.map(c => String(c.name)), primaryKey: columns.filter(c => Number(c.pk) > 0).sort((a,b) => Number(a.pk) - Number(b.pk)).map(c => String(c.name)) };
    });
  } finally { db.close(); }
}
export async function hashFile(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
let snapshotBusy = false;
export async function createSnapshot(source: Source): Promise<Snapshot> {
  if (snapshotBusy) throw new Error("已有备份正在生成");
  snapshotBusy = true;
  const id = randomUUID();
  const target = resourcePath("snapshots", id, ".db");
  const temporary = target + ".partial";
  let db: DatabaseSync | undefined;
  try {
    const file = sourcePath(source);
    if (!fs.existsSync(file)) throw new Error("源数据库不存在");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    let checkpoint = "未执行（只读来源）";
    // 只有配置的服务器库允许尝试非阻塞 checkpoint，绝不删除 WAL。
    db = new DatabaseSync(file, { readOnly: source.sourceType !== "server" });
    if (source.sourceType === "server") {
      try { checkpoint = JSON.stringify(db.prepare("PRAGMA wal_checkpoint(PASSIVE)").get()); }
      catch { checkpoint = "checkpoint 忙或失败，Backup API 仍包含已提交 WAL"; }
    }
    await backup(db, temporary, { rate: 100 });
    db.close(); db = undefined;
    const tables = inspectSqlite(temporary);
    const result: Snapshot = { id, tables, checkpoint, sha256: await hashFile(temporary), size: fs.statSync(temporary).size, createdAt: Date.now() };
    fs.renameSync(temporary, target);
    atomicWrite(resourcePath("snapshots", id), result);
    return result;
  } catch (error) {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    throw error;
  } finally { db?.close(); snapshotBusy = false; }
}
export function getSnapshot(id: string): Snapshot { return readJson(resourcePath("snapshots", id)); }
export function listSnapshots(): Snapshot[] { return listJson<Snapshot>("snapshots").sort((a,b) => b.createdAt-a.createdAt); }
