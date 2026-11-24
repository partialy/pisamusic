import type { SchemaTable } from "../types";

export const sidebarMenuTables: readonly SchemaTable[] = [
  {
    name: "sidebar_menu_config",
    columns: [
      { name: "id", type: "BIGINT", nullable: false, sqliteType: "INTEGER" },
      { name: "config_json", type: "LONGTEXT", nullable: false, sqliteType: "TEXT" },
      { name: "updated_at", type: "BIGINT", nullable: false, sqliteType: "INTEGER" },
    ],
    primaryKey: ["id"],
    createSql: `CREATE TABLE \`sidebar_menu_config\` (
  \`id\` BIGINT NOT NULL,
  \`config_json\` LONGTEXT NOT NULL,
  \`updated_at\` BIGINT NOT NULL,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC`,
    foreignSql: [],
  },
  {
    name: "sidebar_menu_icon_uploads",
    columns: [
      { name: "object_key", type: "VARCHAR(191)", nullable: false, sqliteType: "TEXT" },
      { name: "input_json", type: "LONGTEXT", nullable: false, sqliteType: "TEXT" },
      { name: "expires_at", type: "BIGINT", nullable: false, sqliteType: "INTEGER" },
      { name: "file_id", type: "VARCHAR(191)", nullable: true, sqliteType: "TEXT" },
    ],
    primaryKey: ["object_key"],
    createSql: `CREATE TABLE \`sidebar_menu_icon_uploads\` (
  \`object_key\` VARCHAR(191) NOT NULL,
  \`input_json\` LONGTEXT NOT NULL,
  \`expires_at\` BIGINT NOT NULL,
  \`file_id\` VARCHAR(191) NULL,
  PRIMARY KEY (\`object_key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC`,
    foreignSql: [],
  },
];
