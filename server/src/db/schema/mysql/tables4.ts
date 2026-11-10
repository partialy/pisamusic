import { SchemaTable } from '../types';
export const tables4: readonly SchemaTable[] = [
  {
    "name": "user_track_stats",
    "columns": [
      {
        "name": "user_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "source",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "song_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "title",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "artist",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "album",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "duration_ms",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "listened_ms",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "play_count",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "completed_count",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "first_listened_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "last_listened_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "user_id",
      "source",
      "song_id"
    ],
    "createSql": "CREATE TABLE `user_track_stats` (\n  `user_id` VARCHAR(191) NOT NULL,\n  `source` VARCHAR(191) NOT NULL,\n  `song_id` VARCHAR(191) NOT NULL,\n  `title` VARCHAR(1024) NOT NULL DEFAULT '',\n  `artist` VARCHAR(1024) NOT NULL DEFAULT '',\n  `album` VARCHAR(1024) NOT NULL DEFAULT '',\n  `duration_ms` BIGINT NULL,\n  `listened_ms` BIGINT NOT NULL DEFAULT 0,\n  `play_count` BIGINT NOT NULL DEFAULT 0,\n  `completed_count` BIGINT NOT NULL DEFAULT 0,\n  `first_listened_at` BIGINT NOT NULL,\n  `last_listened_at` BIGINT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`user_id`, `source`, `song_id`),\n  KEY `idx_user_track_stats_last_listened` (`user_id`, `last_listened_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `user_track_stats` ADD CONSTRAINT `fk_user_track_stats_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "listening_level_config",
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "version",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `listening_level_config` (\n  `id` BIGINT NOT NULL,\n  `version` BIGINT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "listening_level_rules",
    "columns": [
      {
        "name": "level",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "min_minutes",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "max_minutes",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "created_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "level"
    ],
    "createSql": "CREATE TABLE `listening_level_rules` (\n  `level` BIGINT NOT NULL,\n  `min_minutes` BIGINT NOT NULL,\n  `max_minutes` BIGINT NULL,\n  `created_at` BIGINT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`level`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "user_sync_items",
    "columns": [
      {
        "name": "user_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "item_type",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "item_key",
        "type": "VARCHAR(256)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "payload_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'{}'"
      },
      {
        "name": "deleted",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "last_op_id",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "last_device_id",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "client_updated_at",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "server_version",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "server_updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "user_id",
      "item_type",
      "item_key"
    ],
    "createSql": "CREATE TABLE `user_sync_items` (\n  `user_id` VARCHAR(191) NOT NULL,\n  `item_type` VARCHAR(191) NOT NULL,\n  `item_key` VARCHAR(256) NOT NULL,\n  `payload_json` LONGTEXT NOT NULL,\n  `deleted` BIGINT NOT NULL DEFAULT 0,\n  `last_op_id` VARCHAR(1024) NOT NULL DEFAULT '',\n  `last_device_id` VARCHAR(1024) NOT NULL DEFAULT '',\n  `client_updated_at` VARCHAR(1024) NOT NULL DEFAULT '',\n  `server_version` BIGINT NOT NULL,\n  `server_updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`user_id`, `item_type`, `item_key`),\n  KEY `idx_user_sync_items_version` (`user_id`, `server_version`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `user_sync_items` ADD CONSTRAINT `fk_user_sync_items_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "user_sync_change_log",
    "columns": [
      {
        "name": "user_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "version",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "op_id",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "device_id",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "item_type",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "item_key",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "action",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "payload_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'{}'"
      },
      {
        "name": "client_updated_at",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "server_updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "user_id",
      "version"
    ],
    "createSql": "CREATE TABLE `user_sync_change_log` (\n  `user_id` VARCHAR(191) NOT NULL,\n  `version` BIGINT NOT NULL,\n  `op_id` LONGTEXT NOT NULL,\n  `device_id` LONGTEXT NOT NULL,\n  `item_type` LONGTEXT NOT NULL,\n  `item_key` LONGTEXT NOT NULL,\n  `action` LONGTEXT NOT NULL,\n  `payload_json` LONGTEXT NOT NULL,\n  `client_updated_at` VARCHAR(1024) NOT NULL DEFAULT '',\n  `server_updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`user_id`, `version`),\n  KEY `idx_user_sync_change_log_version` (`user_id`, `version`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `user_sync_change_log` ADD CONSTRAINT `fk_user_sync_change_log_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "user_sync_applied_ops",
    "columns": [
      {
        "name": "user_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "device_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "op_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "server_version",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "applied_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "user_id",
      "device_id",
      "op_id"
    ],
    "createSql": "CREATE TABLE `user_sync_applied_ops` (\n  `user_id` VARCHAR(191) NOT NULL,\n  `device_id` VARCHAR(191) NOT NULL,\n  `op_id` VARCHAR(191) NOT NULL,\n  `server_version` BIGINT NOT NULL,\n  `applied_at` BIGINT NOT NULL,\n  PRIMARY KEY (`user_id`, `device_id`, `op_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `user_sync_applied_ops` ADD CONSTRAINT `fk_user_sync_applied_ops_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "verification_code_records",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "channel",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "target",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "purpose",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "code",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "user_id",
        "type": "VARCHAR(191)",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "device_id",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "client_ip",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "user_agent",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "status",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'sent'"
      },
      {
        "name": "error_message",
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
      },
      {
        "name": "expires_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "verified_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `verification_code_records` (\n  `id` VARCHAR(191) NOT NULL,\n  `channel` VARCHAR(191) NOT NULL,\n  `target` VARCHAR(191) NOT NULL,\n  `purpose` VARCHAR(191) NOT NULL,\n  `code` LONGTEXT NOT NULL,\n  `user_id` VARCHAR(191) NULL,\n  `device_id` VARCHAR(1024) NOT NULL DEFAULT '',\n  `client_ip` VARCHAR(1024) NOT NULL DEFAULT '',\n  `user_agent` LONGTEXT NOT NULL,\n  `status` VARCHAR(191) NOT NULL DEFAULT 'sent',\n  `error_message` LONGTEXT NOT NULL,\n  `created_at` BIGINT NOT NULL,\n  `expires_at` BIGINT NOT NULL,\n  `verified_at` BIGINT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_verification_code_created` (`created_at`),\n  KEY `idx_verification_code_status` (`status`, `created_at`),\n  KEY `idx_verification_code_channel_purpose` (`channel`, `purpose`, `created_at`),\n  KEY `idx_verification_code_target_created` (`target`, `created_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `verification_code_records` ADD CONSTRAINT `fk_verification_code_records_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "site_visit_records",
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
        "name": "visitor_hash",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "ip_address",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "path",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'/'"
      },
      {
        "name": "referrer",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "user_agent",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "language",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "timezone",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "screen_width",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "screen_height",
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
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `site_visit_records` (\n  `id` VARCHAR(191) NOT NULL,\n  `visit_day` VARCHAR(191) NOT NULL,\n  `visitor_hash` VARCHAR(191) NOT NULL,\n  `ip_address` VARCHAR(1024) NOT NULL DEFAULT '',\n  `path` VARCHAR(1024) NOT NULL DEFAULT '/',\n  `referrer` LONGTEXT NOT NULL,\n  `user_agent` LONGTEXT NOT NULL,\n  `language` VARCHAR(1024) NOT NULL DEFAULT '',\n  `timezone` VARCHAR(1024) NOT NULL DEFAULT '',\n  `screen_width` BIGINT NOT NULL DEFAULT 0,\n  `screen_height` BIGINT NOT NULL DEFAULT 0,\n  `created_at` BIGINT NOT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_site_visit_created` (`created_at`),\n  KEY `idx_site_visit_day` (`visit_day`),\n  UNIQUE KEY `ux_site_visit_day_visitor` (`visit_day`, `visitor_hash`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "download_records",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "download_day",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "platform",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "version",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "file_record_id",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "ip_address",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "referrer",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "user_agent",
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
    "createSql": "CREATE TABLE `download_records` (\n  `id` VARCHAR(191) NOT NULL,\n  `download_day` VARCHAR(191) NOT NULL,\n  `platform` VARCHAR(191) NOT NULL,\n  `version` VARCHAR(1024) NOT NULL DEFAULT '',\n  `file_record_id` LONGTEXT NULL,\n  `ip_address` VARCHAR(1024) NOT NULL DEFAULT '',\n  `referrer` LONGTEXT NOT NULL,\n  `user_agent` LONGTEXT NOT NULL,\n  `created_at` BIGINT NOT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_download_created` (`created_at`),\n  KEY `idx_download_day_platform` (`download_day`, `platform`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "device_daily_activity",
    "columns": [
      {
        "name": "activity_day",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "device_type",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "device_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "app_version",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "first_seen_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "last_seen_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "activity_day",
      "device_type",
      "device_id"
    ],
    "createSql": "CREATE TABLE `device_daily_activity` (\n  `activity_day` VARCHAR(191) NOT NULL,\n  `device_type` VARCHAR(191) NOT NULL,\n  `device_id` VARCHAR(191) NOT NULL,\n  `app_version` VARCHAR(1024) NOT NULL DEFAULT '',\n  `first_seen_at` BIGINT NOT NULL,\n  `last_seen_at` BIGINT NOT NULL,\n  PRIMARY KEY (`activity_day`, `device_type`, `device_id`),\n  KEY `idx_device_daily_last_seen` (`last_seen_at`),\n  KEY `idx_device_daily_day_type` (`activity_day`, `device_type`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "runtime_configs",
    "columns": [
      {
        "name": "key",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "name",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "value_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "key"
    ],
    "createSql": "CREATE TABLE `runtime_configs` (\n  `key` VARCHAR(191) NOT NULL,\n  `name` VARCHAR(1024) NOT NULL DEFAULT '',\n  `value_json` LONGTEXT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`key`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  }
];
