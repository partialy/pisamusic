export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
  sqliteType?: string;
  /** SQLite SQL字面量（例如 '{}'），不是解析后的JavaScript值。 */
  default?: string;
  generated?: boolean;
  autoIncrement?: boolean;
}
export interface SchemaTable {
  name: string;
  columns: readonly SchemaColumn[];
  primaryKey: readonly string[];
  createSql: string;
  foreignSql: readonly string[];
}
