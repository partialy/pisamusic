/** 历史表不恢复业务职责；按源行原值JSON（含类型编码）归档，迁移器必须保留完整源DDL。 */
export const MYSQL_ARCHIVE_TABLES = ["json_imports", "listen_together_user_records"].map(sourceTable => ({
  name: `legacy_archive_${sourceTable}`,
  sourceTable,
  createSql: `CREATE TABLE \`legacy_archive_${sourceTable}\` (
    \`archive_row_id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    \`source_schema_sql\` LONGTEXT NOT NULL,
    \`source_row_json\` LONGTEXT NOT NULL,
    PRIMARY KEY (\`archive_row_id\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC`,
}));
