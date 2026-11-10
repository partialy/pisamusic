import { SchemaTable } from '../types';
export const tables3: readonly SchemaTable[] = [
  {
    "name": "fault_report_logs",
    "columns": [
      {
        "name": "client_log_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "report_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "occurred_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "scene",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "failure_type",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "method_name",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "request_method",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "request_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "request_params_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'{}'"
      },
      {
        "name": "nonce_id",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "response_code",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "response_body",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "resolved_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "error_type",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "error_message",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "stack_trace",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "song_source",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "song_id",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "quality",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      }
    ],
    "primaryKey": [
      "client_log_id"
    ],
    "createSql": "CREATE TABLE `fault_report_logs` (\n  `client_log_id` VARCHAR(191) NOT NULL,\n  `report_id` VARCHAR(191) NOT NULL,\n  `occurred_at` BIGINT NOT NULL,\n  `scene` VARCHAR(191) NOT NULL,\n  `failure_type` LONGTEXT NOT NULL,\n  `method_name` VARCHAR(1024) NOT NULL DEFAULT '',\n  `request_method` VARCHAR(1024) NOT NULL DEFAULT '',\n  `request_url` LONGTEXT NOT NULL,\n  `request_params_json` LONGTEXT NOT NULL,\n  `nonce_id` VARCHAR(1024) NOT NULL DEFAULT '',\n  `response_code` BIGINT NULL,\n  `response_body` LONGTEXT NOT NULL,\n  `resolved_url` LONGTEXT NOT NULL,\n  `error_type` VARCHAR(1024) NOT NULL DEFAULT '',\n  `error_message` LONGTEXT NOT NULL,\n  `stack_trace` LONGTEXT NOT NULL,\n  `song_source` VARCHAR(1024) NOT NULL DEFAULT '',\n  `song_id` VARCHAR(1024) NOT NULL DEFAULT '',\n  `quality` VARCHAR(1024) NOT NULL DEFAULT '',\n  PRIMARY KEY (`client_log_id`),\n  KEY `idx_fault_report_logs_scene_time` (`scene`, `occurred_at`),\n  KEY `idx_fault_report_logs_report_time` (`report_id`, `occurred_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `fault_report_logs` ADD CONSTRAINT `fk_fault_report_logs_0` FOREIGN KEY (`report_id`) REFERENCES `fault_reports` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "share_records",
    "columns": [
      {
        "name": "uuid",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "type",
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
        "name": "source_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "subject_key",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "title",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "description",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "cover_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "raw_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "sharer_user_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "sharer_snapshot_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'{}'"
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
        "name": "access_count",
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
        "name": "active_subject",
        "type": "VARCHAR(191)",
        "nullable": true,
        "generated": true
      }
    ],
    "primaryKey": [
      "uuid"
    ],
    "createSql": "CREATE TABLE `share_records` (\n  `uuid` VARCHAR(191) NOT NULL,\n  `type` VARCHAR(191) NOT NULL,\n  `source` VARCHAR(191) NOT NULL,\n  `source_id` VARCHAR(191) NOT NULL,\n  `subject_key` VARCHAR(191) NOT NULL DEFAULT '',\n  `title` LONGTEXT NOT NULL,\n  `description` LONGTEXT NOT NULL,\n  `cover_url` LONGTEXT NOT NULL,\n  `raw_json` LONGTEXT NOT NULL,\n  `sharer_user_id` VARCHAR(191) NOT NULL,\n  `sharer_snapshot_json` LONGTEXT NOT NULL,\n  `created_at` BIGINT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  `access_count` BIGINT NOT NULL DEFAULT 0,\n  `valid` BIGINT NOT NULL DEFAULT 1,\n  `invalidated_at` BIGINT NULL,\n  PRIMARY KEY (`uuid`),\n  `active_subject` VARCHAR(191) GENERATED ALWAYS AS (CASE WHEN `valid` = 1 THEN `subject_key` ELSE NULL END) STORED,\n  UNIQUE KEY `ux_share_records_active_subject` (`sharer_user_id`, `type`, `active_subject`),\n  KEY `idx_share_records_type_source` (`type`, `source`, `source_id`),\n  KEY `idx_share_records_valid_created` (`valid`, `created_at`),\n  KEY `idx_share_records_user_created` (`sharer_user_id`, `created_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "users",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "email",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "phone",
        "type": "VARCHAR(191)",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "username",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "password_hash",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "avatar",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "avatar_key",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'default'"
      },
      {
        "name": "vip_enabled",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "vip_expires_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "sync_version",
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
      },
      {
        "name": "last_login_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "nonempty_phone",
        "type": "VARCHAR(191)",
        "nullable": true,
        "generated": true
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `users` (\n  `id` VARCHAR(191) NOT NULL,\n  `email` VARCHAR(191) NOT NULL,\n  `phone` VARCHAR(191) NULL,\n  `username` VARCHAR(191) NOT NULL,\n  `password_hash` LONGTEXT NOT NULL,\n  `avatar` VARCHAR(1024) NOT NULL DEFAULT '',\n  `avatar_key` VARCHAR(1024) NOT NULL DEFAULT 'default',\n  `vip_enabled` BIGINT NOT NULL DEFAULT 0,\n  `vip_expires_at` BIGINT NULL,\n  `sync_version` BIGINT NOT NULL DEFAULT 0,\n  `created_at` BIGINT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  `last_login_at` BIGINT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_users_phone` (`phone`),\n  `nonempty_phone` VARCHAR(191) GENERATED ALWAYS AS (CASE WHEN `phone` IS NOT NULL AND `phone` <> '' THEN `phone` ELSE NULL END) STORED,\n  UNIQUE KEY `ux_users_phone` (`nonempty_phone`),\n  KEY `idx_users_username` (`username`),\n  KEY `idx_users_email` (`email`),\n  UNIQUE KEY `ux_users_username` (`username`),\n  UNIQUE KEY `ux_users_phone` (`phone`),\n  UNIQUE KEY `ux_users_email` (`email`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "announcement_reads",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "announcement_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "reader_key",
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
        "name": "user_snapshot_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'{}'"
      },
      {
        "name": "platform",
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
        "name": "device_snapshot_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'{}'"
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
        "name": "created_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "read_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `announcement_reads` (\n  `id` VARCHAR(191) NOT NULL,\n  `announcement_id` VARCHAR(191) NOT NULL,\n  `reader_key` VARCHAR(191) NOT NULL,\n  `user_id` VARCHAR(191) NULL,\n  `user_snapshot_json` LONGTEXT NOT NULL,\n  `platform` VARCHAR(191) NOT NULL,\n  `device_id` VARCHAR(191) NOT NULL,\n  `device_snapshot_json` LONGTEXT NOT NULL,\n  `client_ip` VARCHAR(1024) NOT NULL DEFAULT '',\n  `user_agent` LONGTEXT NOT NULL,\n  `created_at` BIGINT NOT NULL,\n  `read_at` BIGINT NOT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_announcement_reads_device_id` (`platform`, `device_id`),\n  KEY `idx_announcement_reads_user_id` (`user_id`),\n  KEY `idx_announcement_reads_announcement_read_at` (`announcement_id`, `read_at`, `id`),\n  UNIQUE KEY `ux_announcement_reads_announcement_id_reader_key` (`announcement_id`, `reader_key`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `announcement_reads` ADD CONSTRAINT `fk_announcement_reads_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION",
      "ALTER TABLE `announcement_reads` ADD CONSTRAINT `fk_announcement_reads_1` FOREIGN KEY (`announcement_id`) REFERENCES `announcements` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "direct_messages",
    "columns": [
      {
        "name": "id",
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
        "name": "android_device_id",
        "type": "VARCHAR(191)",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "desktop_device_id",
        "type": "VARCHAR(191)",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "content",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "created_by_admin",
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
        "name": "read_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "read_platform",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "read_device_id",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `direct_messages` (\n  `id` VARCHAR(191) NOT NULL,\n  `user_id` VARCHAR(191) NULL,\n  `android_device_id` VARCHAR(191) NULL,\n  `desktop_device_id` VARCHAR(191) NULL,\n  `content` LONGTEXT NOT NULL,\n  `created_by_admin` LONGTEXT NOT NULL,\n  `created_at` BIGINT NOT NULL,\n  `read_at` BIGINT NULL,\n  `read_platform` LONGTEXT NULL,\n  `read_device_id` LONGTEXT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_direct_messages_desktop_unread` (`desktop_device_id`, `read_at`, `created_at`, `id`),\n  KEY `idx_direct_messages_android_unread` (`android_device_id`, `read_at`, `created_at`, `id`),\n  KEY `idx_direct_messages_user_unread` (`user_id`, `read_at`, `created_at`, `id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `direct_messages` ADD CONSTRAINT `fk_direct_messages_0` FOREIGN KEY (`desktop_device_id`) REFERENCES `desktop_device_info` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION",
      "ALTER TABLE `direct_messages` ADD CONSTRAINT `fk_direct_messages_1` FOREIGN KEY (`android_device_id`) REFERENCES `device_info` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION",
      "ALTER TABLE `direct_messages` ADD CONSTRAINT `fk_direct_messages_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "listening_fragments",
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
        "name": "event_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "play_session_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "platform",
        "type": "LONGTEXT",
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
        "name": "track_duration_ms",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "start_ms",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "end_ms",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "active_duration_ms",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "terminal_reason",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "payload_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "received_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "user_id",
      "device_id",
      "event_id"
    ],
    "createSql": "CREATE TABLE `listening_fragments` (\n  `user_id` VARCHAR(191) NOT NULL,\n  `device_id` VARCHAR(191) NOT NULL,\n  `event_id` VARCHAR(191) NOT NULL,\n  `play_session_id` VARCHAR(191) NOT NULL,\n  `platform` LONGTEXT NOT NULL,\n  `source` VARCHAR(191) NOT NULL,\n  `song_id` VARCHAR(191) NOT NULL,\n  `title` VARCHAR(1024) NOT NULL DEFAULT '',\n  `artist` VARCHAR(1024) NOT NULL DEFAULT '',\n  `album` VARCHAR(1024) NOT NULL DEFAULT '',\n  `track_duration_ms` BIGINT NULL,\n  `start_ms` BIGINT NOT NULL,\n  `end_ms` BIGINT NOT NULL,\n  `active_duration_ms` BIGINT NOT NULL,\n  `terminal_reason` LONGTEXT NULL,\n  `payload_json` LONGTEXT NOT NULL,\n  `received_at` BIGINT NOT NULL,\n  PRIMARY KEY (`user_id`, `device_id`, `event_id`),\n  KEY `idx_listening_fragments_session` (`user_id`, `device_id`, `play_session_id`),\n  KEY `idx_listening_fragments_track_interval` (`user_id`, `source`, `song_id`, `start_ms`, `end_ms`),\n  KEY `idx_listening_fragments_user_interval` (`user_id`, `start_ms`, `end_ms`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `listening_fragments` ADD CONSTRAINT `fk_listening_fragments_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "listening_play_sessions",
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
        "name": "play_session_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "source",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "song_id",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "track_duration_ms",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "accumulated_ms",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "qualified_counted",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "completed_counted",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "natural_end_seen",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      }
    ],
    "primaryKey": [
      "user_id",
      "device_id",
      "play_session_id"
    ],
    "createSql": "CREATE TABLE `listening_play_sessions` (\n  `user_id` VARCHAR(191) NOT NULL,\n  `device_id` VARCHAR(191) NOT NULL,\n  `play_session_id` VARCHAR(191) NOT NULL,\n  `source` LONGTEXT NOT NULL,\n  `song_id` LONGTEXT NOT NULL,\n  `track_duration_ms` BIGINT NULL,\n  `accumulated_ms` BIGINT NOT NULL DEFAULT 0,\n  `qualified_counted` BIGINT NOT NULL DEFAULT 0,\n  `completed_counted` BIGINT NOT NULL DEFAULT 0,\n  `natural_end_seen` BIGINT NOT NULL DEFAULT 0,\n  PRIMARY KEY (`user_id`, `device_id`, `play_session_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `listening_play_sessions` ADD CONSTRAINT `fk_listening_play_sessions_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "user_listening_intervals",
    "columns": [
      {
        "name": "user_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "start_ms",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "end_ms",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "user_id",
      "start_ms",
      "end_ms"
    ],
    "createSql": "CREATE TABLE `user_listening_intervals` (\n  `user_id` VARCHAR(191) NOT NULL,\n  `start_ms` BIGINT NOT NULL,\n  `end_ms` BIGINT NOT NULL,\n  PRIMARY KEY (`user_id`, `start_ms`, `end_ms`),\n  KEY `idx_user_listening_intervals_range` (`user_id`, `start_ms`, `end_ms`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `user_listening_intervals` ADD CONSTRAINT `fk_user_listening_intervals_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "user_track_listening_intervals",
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
        "name": "start_ms",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "end_ms",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "user_id",
      "source",
      "song_id",
      "start_ms",
      "end_ms"
    ],
    "createSql": "CREATE TABLE `user_track_listening_intervals` (\n  `user_id` VARCHAR(191) NOT NULL,\n  `source` VARCHAR(191) NOT NULL,\n  `song_id` VARCHAR(191) NOT NULL,\n  `start_ms` BIGINT NOT NULL,\n  `end_ms` BIGINT NOT NULL,\n  PRIMARY KEY (`user_id`, `source`, `song_id`, `start_ms`, `end_ms`),\n  KEY `idx_user_track_listening_intervals_range` (`user_id`, `source`, `song_id`, `start_ms`, `end_ms`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `user_track_listening_intervals` ADD CONSTRAINT `fk_user_track_listening_intervals_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "user_listening_stats",
    "columns": [
      {
        "name": "user_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "total_ms",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "user_id"
    ],
    "createSql": "CREATE TABLE `user_listening_stats` (\n  `user_id` VARCHAR(191) NOT NULL,\n  `total_ms` BIGINT NOT NULL DEFAULT 0,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`user_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `user_listening_stats` ADD CONSTRAINT `fk_user_listening_stats_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  }
];
