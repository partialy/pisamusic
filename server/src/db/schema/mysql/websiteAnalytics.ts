import type { SchemaTable } from '../types';
export const websiteAnalyticsTables: readonly SchemaTable[] = [
  {
    "name": "site_page_view_records",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "visit_day",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "domain",
        "type": "VARCHAR(253)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "visitor_hash",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "path",
        "type": "VARCHAR(512)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "referrer",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "created_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `site_page_view_records` (\n  `id` VARCHAR(191) NOT NULL,\n  `visit_day` VARCHAR(191) NOT NULL,\n  `domain` VARCHAR(253) NOT NULL DEFAULT '',\n  `visitor_hash` VARCHAR(191) NOT NULL,\n  `path` VARCHAR(512) NOT NULL,\n  `referrer` LONGTEXT NOT NULL,\n  `created_at` BIGINT NOT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_site_pv_domain_day` (`domain`, `visit_day`),\n  KEY `idx_site_pv_day_path` (`visit_day`, `path`),\n  KEY `idx_site_pv_created` (`created_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  }
];
