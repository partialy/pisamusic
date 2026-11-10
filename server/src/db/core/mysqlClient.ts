import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { AsyncLocalStorage } from "node:async_hooks";
import { DatabaseConfig } from "./config";
import { DatabaseError, DbClient, DbTransaction, QueryResult, SqlParams } from "./types";

export class MysqlClient implements DbClient {
  readonly dialect = "mysql" as const;
  private readonly pool: Pool;
  private context = new AsyncLocalStorage<boolean>();
  private async connection(): Promise<PoolConnection> {
    const connection = await this.pool.getConnection();
    try { await connection.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION,ONLY_FULL_GROUP_BY'"); return connection; }
    catch (error) { connection.release(); throw error; }
  }
  constructor(config: Extract<DatabaseConfig, { type: "MYSQL" }>) {
    this.pool = mysql.createPool({ host: config.host, port: config.port, user: config.user, password: config.password, database: config.database,
      connectionLimit: config.connectionLimit, connectTimeout: config.connectTimeout, waitForConnections: true, queueLimit: 1000,
      charset: "utf8mb4_bin", timezone: "Z", supportBigNumbers: true, bigNumberStrings: false, decimalNumbers: false,
      multipleStatements: false, enableKeepAlive: true });
  }
  private session(connection: Pool | PoolConnection, active: () => boolean): DbTransaction {
    const check = () => { if (!active()) throw new DatabaseError("DB_TRANSACTION_CLOSED", "事务已结束"); };
    const values = (params: SqlParams) => params.map(value => typeof value === "bigint" ? value.toString() : typeof value === "boolean" ? Number(value) : value instanceof Uint8Array ? Buffer.from(value) : value);
    return {
      dialect: this.dialect,
      query: async <T>(sql: string, params: SqlParams = []) => { check(); const [rows] = await connection.execute<RowDataPacket[]>(sql, values(params)); return rows as T[]; },
      queryOne: async <T>(sql: string, params: SqlParams = []) => { check(); const [rows] = await connection.execute<RowDataPacket[]>(sql, values(params)); return (rows[0] as T | undefined) ?? null; },
      execute: async (sql: string, params: SqlParams = []): Promise<QueryResult> => { check(); const [r] = await connection.execute<ResultSetHeader>(sql, values(params)); return { affectedRows: r.affectedRows, insertId: r.insertId }; },
    };
  }
  private outside(): DbTransaction { if (this.context.getStore()) throw new DatabaseError("DB_TRANSACTION_SCOPE", "事务内必须使用 tx，不能使用外层客户端"); return this.session(this.pool, () => true); }
  async query<T>(sql: string, params: SqlParams = []): Promise<T[]> {
    this.outside(); const connection = await this.connection();
    try { return await this.session(connection, () => true).query<T>(sql, params); } finally { connection.release(); }
  }
  async queryOne<T>(sql: string, params: SqlParams = []): Promise<T | null> {
    const rows = await this.query<T>(sql, params); return rows[0] ?? null;
  }
  async execute(sql: string, params: SqlParams = []): Promise<QueryResult> {
    this.outside(); const connection = await this.connection();
    try { return await this.session(connection, () => true).execute(sql, params); } finally { connection.release(); }
  }
  async transaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T> {
    this.outside();
    const connection = await this.connection();
    let active = true;
    try {
      await connection.beginTransaction();
      const value = await this.context.run(true, () => fn(this.session(connection, () => active)));
      active = false; await connection.commit(); return value;
    } catch (error) { active = false; try { await connection.rollback(); } catch { connection.destroy(); } throw error; }
    finally { active = false; connection.release(); }
  }
  async close(): Promise<void> { this.outside(); await this.pool.end(); }
}
