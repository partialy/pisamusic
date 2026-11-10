import { SchemaTable } from '../types';
export const tables2: readonly SchemaTable[] = [
  {
    "name": "file_records",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "usage_type",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "owner_type",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'system'"
      },
      {
        "name": "owner_user_id",
        "type": "VARCHAR(191)",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "owner_snapshot_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'{}'"
      },
      {
        "name": "platform",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "version",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "asset_type",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "provider",
        "type": "VARCHAR(32)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'qiniu'"
      },
      {
        "name": "bucket",
        "type": "VARCHAR(128)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "object_key",
        "type": "VARCHAR(512)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "hash",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "file_name",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "mime_type",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "file_size",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "download_url",
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
        "default": "'uploaded'"
      },
      {
        "name": "referenced_by",
        "type": "VARCHAR(1024)",
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
        "name": "deleted_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `file_records` (\n  `id` VARCHAR(191) NOT NULL,\n  `usage_type` VARCHAR(191) NOT NULL,\n  `owner_type` VARCHAR(191) NOT NULL DEFAULT 'system',\n  `owner_user_id` VARCHAR(191) NULL,\n  `owner_snapshot_json` LONGTEXT NOT NULL,\n  `platform` VARCHAR(191) NOT NULL DEFAULT '',\n  `version` VARCHAR(191) NOT NULL DEFAULT '',\n  `asset_type` VARCHAR(1024) NOT NULL DEFAULT '',\n  `provider` VARCHAR(32) NOT NULL DEFAULT 'qiniu',\n  `bucket` VARCHAR(128) NOT NULL,\n  `object_key` VARCHAR(512) NOT NULL,\n  `hash` VARCHAR(1024) NOT NULL DEFAULT '',\n  `file_name` LONGTEXT NOT NULL,\n  `mime_type` VARCHAR(1024) NOT NULL DEFAULT '',\n  `file_size` BIGINT NOT NULL DEFAULT 0,\n  `download_url` LONGTEXT NOT NULL,\n  `status` VARCHAR(191) NOT NULL DEFAULT 'uploaded',\n  `referenced_by` VARCHAR(1024) NOT NULL DEFAULT '',\n  `created_at` BIGINT NOT NULL,\n  `deleted_at` BIGINT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_file_records_owner` (`owner_type`, `owner_user_id`, `created_at`),\n  KEY `idx_file_records_usage` (`usage_type`, `platform`, `version`),\n  KEY `idx_file_records_status` (`status`),\n  UNIQUE KEY `ux_file_records_provider_key` (`provider`, `bucket`, `object_key`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "cloud_music_tracks",
    "columns": [
      {
        "name": "uuid",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "status",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'temp'"
      },
      {
        "name": "upload_state",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'reserved'"
      },
      {
        "name": "status_reason",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "title",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "artist",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'未知歌手'"
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
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "format",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "codec",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "bitrate",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "sample_rate",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "channels",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "year",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "track_no",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "lyrics_format",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "metadata_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'{}'"
      },
      {
        "name": "reviewed_by",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "reviewed_at",
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
      },
      {
        "name": "deleted_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "uuid"
    ],
    "createSql": "CREATE TABLE `cloud_music_tracks` (\n  `uuid` VARCHAR(191) NOT NULL,\n  `status` VARCHAR(191) NOT NULL DEFAULT 'temp',\n  `upload_state` VARCHAR(1024) NOT NULL DEFAULT 'reserved',\n  `status_reason` VARCHAR(1024) NOT NULL DEFAULT '',\n  `title` VARCHAR(191) NOT NULL DEFAULT '',\n  `artist` VARCHAR(191) NOT NULL DEFAULT '未知歌手',\n  `album` VARCHAR(1024) NOT NULL DEFAULT '',\n  `duration_ms` BIGINT NOT NULL DEFAULT 0,\n  `format` VARCHAR(1024) NOT NULL DEFAULT '',\n  `codec` VARCHAR(1024) NOT NULL DEFAULT '',\n  `bitrate` BIGINT NOT NULL DEFAULT 0,\n  `sample_rate` BIGINT NOT NULL DEFAULT 0,\n  `channels` BIGINT NOT NULL DEFAULT 0,\n  `year` BIGINT NULL,\n  `track_no` BIGINT NULL,\n  `lyrics_format` LONGTEXT NULL,\n  `metadata_json` LONGTEXT NOT NULL,\n  `reviewed_by` VARCHAR(1024) NOT NULL DEFAULT '',\n  `reviewed_at` BIGINT NULL,\n  `created_at` BIGINT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  `deleted_at` BIGINT NULL,\n  PRIMARY KEY (`uuid`),\n  KEY `idx_cloud_music_title_artist` (`title`, `artist`),\n  KEY `idx_cloud_music_status_updated` (`status`, `updated_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "cloud_music_assets",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "track_uuid",
        "type": "VARCHAR(191)",
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
        "name": "kind",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "state",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'pending'"
      },
      {
        "name": "is_current",
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
        "name": "deleted_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      },
      {
        "name": "current_kind",
        "type": "VARCHAR(191)",
        "nullable": true,
        "generated": true
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `cloud_music_assets` (\n  `id` VARCHAR(191) NOT NULL,\n  `track_uuid` VARCHAR(191) NOT NULL,\n  `file_record_id` VARCHAR(191) NOT NULL,\n  `kind` VARCHAR(191) NOT NULL,\n  `state` VARCHAR(191) NOT NULL DEFAULT 'pending',\n  `is_current` BIGINT NOT NULL DEFAULT 0,\n  `created_at` BIGINT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  `deleted_at` BIGINT NULL,\n  PRIMARY KEY (`id`),\n  `current_kind` VARCHAR(191) GENERATED ALWAYS AS (CASE WHEN `is_current` = 1 AND `deleted_at` IS NULL THEN `kind` ELSE NULL END) STORED,\n  UNIQUE KEY `ux_cloud_music_current_asset` (`track_uuid`, `current_kind`),\n  KEY `idx_cloud_music_assets_track` (`track_uuid`, `kind`, `state`, `created_at`),\n  UNIQUE KEY `ux_cloud_music_assets_file_record_id` (`file_record_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `cloud_music_assets` ADD CONSTRAINT `fk_cloud_music_assets_0` FOREIGN KEY (`file_record_id`) REFERENCES `file_records` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION",
      "ALTER TABLE `cloud_music_assets` ADD CONSTRAINT `fk_cloud_music_assets_1` FOREIGN KEY (`track_uuid`) REFERENCES `cloud_music_tracks` (`uuid`) ON DELETE NO ACTION ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "announcements",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "content_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "time",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "publisher",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "confirm_text",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "show_every_time",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "show_goto_button",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "goto_url",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "sort_order",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "enabled",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "1"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `announcements` (\n  `id` VARCHAR(191) NOT NULL,\n  `content_json` LONGTEXT NOT NULL,\n  `time` LONGTEXT NOT NULL,\n  `publisher` LONGTEXT NOT NULL,\n  `confirm_text` LONGTEXT NOT NULL,\n  `show_every_time` BIGINT NOT NULL DEFAULT 0,\n  `show_goto_button` BIGINT NOT NULL DEFAULT 0,\n  `goto_url` LONGTEXT NULL,\n  `sort_order` BIGINT NOT NULL DEFAULT 0,\n  `enabled` BIGINT NOT NULL DEFAULT 1,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "encryption_plaintext_paths",
    "columns": [
      {
        "name": "path",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "sort_order",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      }
    ],
    "primaryKey": [
      "path"
    ],
    "createSql": "CREATE TABLE `encryption_plaintext_paths` (\n  `path` VARCHAR(191) NOT NULL,\n  `sort_order` BIGINT NOT NULL DEFAULT 0,\n  PRIMARY KEY (`path`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "admin_users",
    "columns": [
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
        "name": "updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "username"
    ],
    "createSql": "CREATE TABLE `admin_users` (\n  `username` VARCHAR(191) NOT NULL,\n  `password_hash` LONGTEXT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`username`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "feedback",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "created_at",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "feedback_type",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "description",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "contact",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "device_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'{}'"
      },
      {
        "name": "status",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'pending'"
      },
      {
        "name": "processed_at",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `feedback` (\n  `id` VARCHAR(191) NOT NULL,\n  `created_at` VARCHAR(191) NOT NULL,\n  `feedback_type` LONGTEXT NOT NULL,\n  `description` LONGTEXT NOT NULL,\n  `contact` LONGTEXT NULL,\n  `device_json` LONGTEXT NOT NULL,\n  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',\n  `processed_at` LONGTEXT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_feedback_status_created_at` (`status`, `created_at`),\n  KEY `idx_feedback_created_at` (`created_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "feedback_images",
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "autoIncrement": true
      },
      {
        "name": "feedback_id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "image_path",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "sort_order",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `feedback_images` (\n  `id` BIGINT NOT NULL AUTO_INCREMENT,\n  `feedback_id` VARCHAR(191) NOT NULL,\n  `image_path` LONGTEXT NOT NULL,\n  `sort_order` BIGINT NOT NULL DEFAULT 0,\n  PRIMARY KEY (`id`),\n  KEY `idx_feedback_images_feedback_id` (`feedback_id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `feedback_images` ADD CONSTRAINT `fk_feedback_images_0` FOREIGN KEY (`feedback_id`) REFERENCES `feedback` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION"
    ]
  },
  {
    "name": "fault_reports",
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
        "name": "scene",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "platform",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'android'"
      },
      {
        "name": "arch",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "app_version",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "app_version_code",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "os_version",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "sdk_int",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "brand",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "model",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "network_type",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "log_count",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "status",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'pending'"
      },
      {
        "name": "created_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "processed_at",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `fault_reports` (\n  `id` VARCHAR(191) NOT NULL,\n  `user_id` VARCHAR(191) NULL,\n  `scene` LONGTEXT NOT NULL,\n  `platform` VARCHAR(1024) NOT NULL DEFAULT 'android',\n  `arch` VARCHAR(1024) NOT NULL DEFAULT '',\n  `app_version` VARCHAR(1024) NOT NULL DEFAULT '',\n  `app_version_code` BIGINT NOT NULL DEFAULT 0,\n  `os_version` VARCHAR(1024) NOT NULL DEFAULT '',\n  `sdk_int` BIGINT NOT NULL DEFAULT 0,\n  `brand` VARCHAR(1024) NOT NULL DEFAULT '',\n  `model` VARCHAR(1024) NOT NULL DEFAULT '',\n  `network_type` VARCHAR(1024) NOT NULL DEFAULT '',\n  `log_count` BIGINT NOT NULL DEFAULT 0,\n  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',\n  `created_at` BIGINT NOT NULL,\n  `processed_at` BIGINT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_fault_reports_user_created` (`user_id`, `created_at`),\n  KEY `idx_fault_reports_status_created` (`status`, `created_at`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": [
      "ALTER TABLE `fault_reports` ADD CONSTRAINT `fk_fault_reports_0` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION"
    ]
  }
];
