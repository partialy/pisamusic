export type DbDialect = "sqlite" | "mysql";
export type SqlValue = string | number | bigint | boolean | null | Uint8Array;
export type SqlParams = readonly SqlValue[];
export interface QueryResult { affectedRows: number; insertId?: number | bigint }
export interface DbTransaction {
  readonly dialect: DbDialect;
  query<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T[]>;
  queryOne<T = Record<string, unknown>>(sql: string, params?: SqlParams): Promise<T | null>;
  execute(sql: string, params?: SqlParams): Promise<QueryResult>;
}
export interface DbClient extends DbTransaction {
  transaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export class DatabaseError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "DatabaseError"; }
}
