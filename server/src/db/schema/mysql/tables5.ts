import { SchemaTable } from '../types';
export const tables5: readonly SchemaTable[] = [
  {
    "name": "listen_together_room_records",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "room_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "room_name",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "lifecycle_status",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "initial_host_user_id",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "initial_host_snapshot_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "final_host_user_id",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "final_host_snapshot_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "max_people",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "member_operation",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "peak_people",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "1"
      },
      {
        "name": "total_join_count",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "1"
      },
      {
        "name": "unique_people",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "1"
      },
      {
        "name": "final_people",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "last_song_snapshot_json",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "final_playback_status",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'paused'"
      },
      {
        "name": "final_position",
        "type": "DOUBLE",
        "nullable": false,
        "sqliteType": "REAL",
        "default": "0"
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
      },
      {
        "name": "ended_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "end_reason",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "ended_by_admin",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "active_room_id",
        "type": "VARCHAR(191)",
        "nullable": true,
        "generated": true
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `listen_together_room_records` (\n  `id` VARCHAR(191) NOT NULL,\n  `room_id` VARCHAR(191) NOT NULL,\n  `room_name` LONGTEXT NOT NULL,\n  `lifecycle_status` VARCHAR(191) NOT NULL,\n  `initial_host_user_id` LONGTEXT NOT NULL,\n  `initial_host_snapshot_json` LONGTEXT NOT NULL,\n  `final_host_user_id` LONGTEXT NOT NULL,\n  `final_host_snapshot_json` LONGTEXT NOT NULL,\n  `max_people` BIGINT NOT NULL,\n  `member_operation` BIGINT NOT NULL,\n  `peak_people` BIGINT NOT NULL DEFAULT 1,\n  `total_join_count` BIGINT NOT NULL DEFAULT 1,\n  `unique_people` BIGINT NOT NULL DEFAULT 1,\n  `final_people` BIGINT NOT NULL DEFAULT 0,\n  `last_song_snapshot_json` LONGTEXT NULL,\n  `final_playback_status` VARCHAR(1024) NOT NULL DEFAULT 'paused',\n  `final_position` DOUBLE NOT NULL DEFAULT 0,\n  `created_at` BIGINT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  `ended_at` BIGINT NULL,\n  `end_reason` LONGTEXT NULL,\n  `ended_by_admin` LONGTEXT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_listen_room_history_ended` (`lifecycle_status`, `ended_at`, `id`),\n  `active_room_id` VARCHAR(191) GENERATED ALWAYS AS (CASE WHEN `lifecycle_status` = 'active' THEN `room_id` ELSE NULL END) STORED,\n  UNIQUE KEY `ux_listen_room_active_room_id` (`active_room_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "listen_together_room_members",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "room_record_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "user_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "user_snapshot_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "role",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "joined_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "last_seen_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "left_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "leave_reason",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "open_user_id",
        "type": "VARCHAR(191)",
        "nullable": true,
        "generated": true
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `listen_together_room_members` (\n  `id` VARCHAR(191) NOT NULL,\n  `room_record_id` VARCHAR(191) NOT NULL,\n  `user_id` VARCHAR(191) NOT NULL,\n  `user_snapshot_json` LONGTEXT NOT NULL,\n  `role` LONGTEXT NOT NULL,\n  `joined_at` BIGINT NOT NULL,\n  `last_seen_at` BIGINT NOT NULL,\n  `left_at` BIGINT NULL,\n  `leave_reason` LONGTEXT NULL,\n  PRIMARY KEY (`id`),\n  `open_user_id` VARCHAR(191) GENERATED ALWAYS AS (CASE WHEN `left_at` IS NULL THEN `user_id` ELSE NULL END) STORED,\n  UNIQUE KEY `ux_listen_room_member_open` (`room_record_id`, `open_user_id`),\n  KEY `idx_listen_room_members_open` (`room_record_id`, `user_id`, `left_at`),\n  KEY `idx_listen_room_members_record` (`room_record_id`, `joined_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `listen_together_room_members` ADD CONSTRAINT `fk_listen_together_room_members_0` FOREIGN KEY (`room_record_id`) REFERENCES `listen_together_room_records` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "app_share_records",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "code",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "device_kind",
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
        "name": "user_id",
        "type": "VARCHAR(191)",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "identity_key",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "user_snapshot_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "device_snapshot_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "created_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "last_requested_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "last_visit_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "last_download_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "visit_count",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "download_count",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "android_download_count",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "desktop_download_count",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "valid",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "1"
      },
      {
        "name": "invalidated_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "active_identity",
        "type": "VARCHAR(191)",
        "nullable": true,
        "generated": true
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `app_share_records` (\n  `id` VARCHAR(191) NOT NULL,\n  `code` VARCHAR(191) NOT NULL,\n  `device_kind` VARCHAR(191) NOT NULL,\n  `device_id` VARCHAR(191) NOT NULL,\n  `user_id` VARCHAR(191) NULL,\n  `identity_key` VARCHAR(191) NOT NULL,\n  `user_snapshot_json` LONGTEXT NOT NULL,\n  `device_snapshot_json` LONGTEXT NOT NULL,\n  `created_at` BIGINT NOT NULL,\n  `last_requested_at` BIGINT NOT NULL,\n  `last_visit_at` BIGINT NULL,\n  `last_download_at` BIGINT NULL,\n  `visit_count` BIGINT NOT NULL DEFAULT 0,\n  `download_count` BIGINT NOT NULL DEFAULT 0,\n  `android_download_count` BIGINT NOT NULL DEFAULT 0,\n  `desktop_download_count` BIGINT NOT NULL DEFAULT 0,\n  `valid` BIGINT NOT NULL DEFAULT 1,\n  `invalidated_at` BIGINT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_app_share_download` (`last_download_at`),\n  KEY `idx_app_share_visit` (`last_visit_at`),\n  KEY `idx_app_share_valid` (`valid`, `created_at`),\n  KEY `idx_app_share_device` (`device_id`, `created_at`),\n  KEY `idx_app_share_user` (`user_id`, `created_at`),\n  KEY `idx_app_share_created` (`created_at`, `id`),\n  `active_identity` VARCHAR(191) GENERATED ALWAYS AS (CASE WHEN `valid` = 1 THEN `identity_key` ELSE NULL END) STORED,\n  UNIQUE KEY `ux_app_share_identity` (`device_kind`, `device_id`, `active_identity`),\n  UNIQUE KEY `ux_app_share_records_code` (`code`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "app_share_visits",
    "columns": [
      {
        "name": "event_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "share_record_id",
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
        "name": "opened_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "navigation_sequence",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "received_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "referrer_path",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "user_agent",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "browser_device_type",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "is_unique_for_share_day",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "is_unique_global_day",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "event_id"
    ],
    "createSql": "CREATE TABLE `app_share_visits` (\n  `event_id` VARCHAR(191) NOT NULL,\n  `share_record_id` VARCHAR(191) NOT NULL,\n  `code` LONGTEXT NOT NULL,\n  `visit_day` VARCHAR(191) NOT NULL,\n  `visitor_hash` VARCHAR(191) NOT NULL,\n  `opened_at` BIGINT NOT NULL,\n  `navigation_sequence` BIGINT NOT NULL DEFAULT 0,\n  `received_at` BIGINT NOT NULL,\n  `referrer_path` LONGTEXT NOT NULL,\n  `user_agent` LONGTEXT NOT NULL,\n  `browser_device_type` LONGTEXT NOT NULL,\n  `is_unique_for_share_day` BIGINT NOT NULL,\n  `is_unique_global_day` BIGINT NOT NULL,\n  PRIMARY KEY (`event_id`),\n  KEY `idx_app_share_visit_cleanup` (`received_at`),\n  KEY `idx_app_share_visit_attribution` (`visitor_hash`, `opened_at`, `navigation_sequence`),\n  KEY `idx_app_share_visit_detail` (`share_record_id`, `received_at`),\n  KEY `idx_app_share_visit_global_uv` (`visit_day`, `visitor_hash`),\n  KEY `idx_app_share_visit_uv` (`share_record_id`, `visit_day`, `visitor_hash`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "app_share_downloads",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "share_record_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "download_record_id",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "visitor_hash",
        "type": "LONGTEXT",
        "nullable": true,
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
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "file_record_id",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "attribution_source",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "triggered_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "safe_referrer_path",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "safe_user_agent",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `app_share_downloads` (\n  `id` VARCHAR(191) NOT NULL,\n  `share_record_id` VARCHAR(191) NOT NULL,\n  `download_record_id` LONGTEXT NULL,\n  `visitor_hash` LONGTEXT NULL,\n  `download_day` VARCHAR(191) NOT NULL,\n  `platform` VARCHAR(191) NOT NULL,\n  `version` LONGTEXT NOT NULL,\n  `file_record_id` LONGTEXT NULL,\n  `attribution_source` LONGTEXT NOT NULL,\n  `triggered_at` BIGINT NOT NULL,\n  `safe_referrer_path` LONGTEXT NOT NULL,\n  `safe_user_agent` LONGTEXT NOT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_app_share_download_cleanup` (`triggered_at`),\n  KEY `idx_app_share_download_day` (`download_day`, `platform`),\n  KEY `idx_app_share_download_detail` (`share_record_id`, `triggered_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "app_share_daily_stats",
    "columns": [
      {
        "name": "day",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "scope",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "share_record_key",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "platform_bucket",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "visit_pv",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "visit_uv",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "download_triggers",
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
        "name": "updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "day",
      "scope",
      "share_record_key",
      "platform_bucket"
    ],
    "createSql": "CREATE TABLE `app_share_daily_stats` (\n  `day` VARCHAR(191) NOT NULL,\n  `scope` VARCHAR(191) NOT NULL,\n  `share_record_key` VARCHAR(191) NOT NULL,\n  `platform_bucket` VARCHAR(191) NOT NULL,\n  `visit_pv` BIGINT NOT NULL DEFAULT 0,\n  `visit_uv` BIGINT NOT NULL DEFAULT 0,\n  `download_triggers` BIGINT NOT NULL DEFAULT 0,\n  `created_at` BIGINT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`day`, `scope`, `share_record_key`, `platform_bucket`),\n  KEY `idx_app_share_daily_record` (`share_record_key`, `day`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  }
];
