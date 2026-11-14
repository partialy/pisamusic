import type { SchemaTable } from '../types';
export const playlistCoverTables: readonly SchemaTable[] = [
  {
    "name": "playlist_cover_resources",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "upload_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "owner_user_id",
        "type": "VARCHAR(191)",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "playlist_id",
        "type": "VARCHAR(256)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "edit_generation",
        "type": "VARCHAR(128)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "file_record_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "state",
        "type": "VARCHAR(16)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'pending'"
      },
      {
        "name": "public_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "width",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "height",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "created_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "expires_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "unreferenced_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "deletion_claimed_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "last_error",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `playlist_cover_resources` (\n `id` VARCHAR(191) NOT NULL,\n `upload_id` VARCHAR(191) NOT NULL,\n `owner_user_id` VARCHAR(191) NULL,\n `playlist_id` VARCHAR(256) NOT NULL,\n `edit_generation` VARCHAR(128) NOT NULL,\n `file_record_id` VARCHAR(191) NOT NULL,\n `state` VARCHAR(16) NOT NULL DEFAULT 'pending',\n `public_url` LONGTEXT NOT NULL,\n `width` BIGINT NOT NULL DEFAULT 0,\n `height` BIGINT NOT NULL DEFAULT 0,\n `created_at` BIGINT NOT NULL,\n `expires_at` BIGINT NOT NULL,\n `unreferenced_at` BIGINT NULL,\n `deletion_claimed_at` BIGINT NULL,\n `last_error` LONGTEXT NOT NULL,\n PRIMARY KEY (`id`),\n UNIQUE KEY `ux_playlist_cover_upload` (`upload_id`),\n UNIQUE KEY `ux_playlist_cover_file` (`file_record_id`),\n KEY `idx_playlist_cover_gc` (`state`,`unreferenced_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `playlist_cover_resources` ADD CONSTRAINT `fk_playlist_cover_file` FOREIGN KEY (`file_record_id`) REFERENCES `file_records` (`id`)"
    ]
  },
  {
    "name": "playlist_cover_refs",
    "columns": [
      {
        "name": "user_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "playlist_id",
        "type": "VARCHAR(256)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "resource_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      }
    ],
    "primaryKey": [
      "user_id",
      "playlist_id"
    ],
    "createSql": "CREATE TABLE `playlist_cover_refs` (\n `user_id` VARCHAR(191) NOT NULL,\n `playlist_id` VARCHAR(256) NOT NULL,\n `resource_id` VARCHAR(191) NOT NULL,\n PRIMARY KEY (`user_id`,`playlist_id`),\n KEY `idx_playlist_cover_ref_resource` (`resource_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `playlist_cover_refs` ADD CONSTRAINT `fk_playlist_cover_ref` FOREIGN KEY (`resource_id`) REFERENCES `playlist_cover_resources` (`id`)"
    ]
  }
];
