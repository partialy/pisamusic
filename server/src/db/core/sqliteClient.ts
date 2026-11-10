import { AsyncLocalStorage } from "node:async_hooks";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { DatabaseError, DbClient, DbTransaction, QueryResult, SqlParams } from "./types";

/** 单连接所有入口共用队列；事务 await 期间只有 tx 能访问连接。 */
export class SqliteClient implements DbClient {
  readonly dialect = "sqlite" as const;
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;
  private context = new AsyncLocalStorage<boolean>();
  constructor(private readonly raw: DatabaseSync) {}
  private schedule<T>(fn: () => T | Promise<T>): Promise<T> {
    if (this.context.getStore()) return Promise.reject(new DatabaseError("DB_TRANSACTION_SCOPE", "事务内必须使用 tx，不能使用外层客户端"));
    const work = this.queue.then(() => { if (this.closed) throw new DatabaseError("DB_CLOSED", "数据库已关闭"); return fn(); });
    this.queue = work.catch(() => undefined);
    return work;
  }
  private params(params: SqlParams): (string | number | bigint | null | Uint8Array)[] { return params.map(v => typeof v === "boolean" ? Number(v) : v); }
  private session(isActive: () => boolean): DbTransaction {
    const check = () => { if (!isActive()) throw new DatabaseError("DB_TRANSACTION_CLOSED", "事务已结束"); };
    return {
      dialect: this.dialect,
      query: async <T>(sql: string, params: SqlParams = []) => { check(); return this.raw.prepare(sql).all(...this.params(params)) as T[]; },
      queryOne: async <T>(sql: string, params: SqlParams = []) => { check(); return (this.raw.prepare(sql).get(...this.params(params)) as T | undefined) ?? null; },
      execute: async (sql: string, params: SqlParams = []): Promise<QueryResult> => { check(); const result = this.raw.prepare(sql).run(...this.params(params)); return { affectedRows: Number(result.changes), insertId: result.lastInsertRowid }; },
    };
  }
  query<T>(sql: string, params: SqlParams = []): Promise<T[]> { return this.schedule(() => this.session(() => !this.closed).query<T>(sql, params)); }
  queryOne<T>(sql: string, params: SqlParams = []): Promise<T | null> { return this.schedule(() => this.session(() => !this.closed).queryOne<T>(sql, params)); }
  execute(sql: string, params: SqlParams = []): Promise<QueryResult> { return this.schedule(() => this.session(() => !this.closed).execute(sql, params)); }
  transaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
    return this.schedule(() => this.context.run(true, async () => {
      this.raw.exec("BEGIN IMMEDIATE");
      let active = true;
      try { const value = await fn(this.session(() => active)); active = false; this.raw.exec("COMMIT"); return value; }
      catch (error) { active = false; this.raw.exec("ROLLBACK"); throw error; }
    }));
  }
  close(): Promise<void> { return this.schedule(() => { this.closed = true; this.raw.close(); }); }
}
export function openSqliteClient(filename: string): SqliteClient {
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  try { db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;"); return new SqliteClient(db); }
  catch (error) { db.close(); throw error; }
}
