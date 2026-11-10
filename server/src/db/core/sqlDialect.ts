import { DbDialect } from "./types";
/** 仅选择显式维护的两份 SQL，禁止运行时猜测或改写业务 SQL。 */
export function dialectSql(dialect: DbDialect, statements: { sqlite: string; mysql: string }): string { return statements[dialect]; }
