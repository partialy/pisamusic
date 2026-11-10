import { SchemaTable } from '../types';
export const tables1: readonly SchemaTable[] = [
  {
    "name": "device_info",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "fingerprint",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "device_name",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "brand",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "model",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "os_version",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "sdk_version",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "app_version",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "app_version_code",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "locked",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "lock_end_time",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER",
        "default": "NULL"
      },
      {
        "name": "first_seen_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "last_active_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "first_seen_ip",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "last_seen_ip",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "last_country_code",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "last_timezone",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "last_locale",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "extra_info",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'{}'"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `device_info` (\n  `id` VARCHAR(191) NOT NULL,\n  `fingerprint` VARCHAR(191) NOT NULL,\n  `device_name` LONGTEXT NOT NULL,\n  `brand` VARCHAR(191) NOT NULL,\n  `model` VARCHAR(191) NOT NULL,\n  `os_version` LONGTEXT NOT NULL,\n  `sdk_version` BIGINT NOT NULL,\n  `app_version` LONGTEXT NOT NULL,\n  `app_version_code` BIGINT NOT NULL,\n  `locked` BIGINT NOT NULL DEFAULT 0,\n  `lock_end_time` BIGINT NULL DEFAULT NULL,\n  `first_seen_at` BIGINT NOT NULL,\n  `last_active_at` BIGINT NOT NULL,\n  `first_seen_ip` LONGTEXT NULL,\n  `last_seen_ip` LONGTEXT NULL,\n  `last_country_code` LONGTEXT NULL,\n  `last_timezone` LONGTEXT NULL,\n  `last_locale` LONGTEXT NULL,\n  `extra_info` VARCHAR(1024) NOT NULL DEFAULT '{}',\n  PRIMARY KEY (`id`),\n  KEY `idx_device_info_brand_model` (`brand`, `model`),\n  KEY `idx_device_info_last_active` (`last_active_at`),\n  UNIQUE KEY `ux_device_info_fingerprint` (`fingerprint`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "desktop_device_info",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "fingerprint",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "device_name",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "hostname",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "os_name",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "os_version",
        "type": "LONGTEXT",
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
        "name": "arch",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "app_version",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "locked",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "lock_end_time",
        "type": "BIGINT",
        "nullable": true,
        "sqliteType": "INTEGER",
        "default": "NULL"
      },
      {
        "name": "first_seen_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "last_active_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "first_seen_ip",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "last_seen_ip",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      },
      {
        "name": "extra_info",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'{}'"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `desktop_device_info` (\n  `id` VARCHAR(191) NOT NULL,\n  `fingerprint` VARCHAR(191) NOT NULL,\n  `device_name` LONGTEXT NOT NULL,\n  `hostname` LONGTEXT NOT NULL,\n  `os_name` LONGTEXT NOT NULL,\n  `os_version` LONGTEXT NOT NULL,\n  `platform` VARCHAR(191) NOT NULL,\n  `arch` VARCHAR(191) NOT NULL,\n  `app_version` LONGTEXT NOT NULL,\n  `locked` BIGINT NOT NULL DEFAULT 0,\n  `lock_end_time` BIGINT NULL DEFAULT NULL,\n  `first_seen_at` BIGINT NOT NULL,\n  `last_active_at` BIGINT NOT NULL,\n  `first_seen_ip` LONGTEXT NULL,\n  `last_seen_ip` LONGTEXT NULL,\n  `extra_info` VARCHAR(1024) NOT NULL DEFAULT '{}',\n  PRIMARY KEY (`id`),\n  KEY `idx_desktop_device_info_platform_arch` (`platform`, `arch`),\n  KEY `idx_desktop_device_info_last_active` (`last_active_at`),\n  UNIQUE KEY `ux_desktop_device_info_fingerprint` (`fingerprint`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "app_settings",
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "app_available",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "1"
      },
      {
        "name": "unavailable_reason",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "''"
      },
      {
        "name": "bootstrap_version",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'v1.0.0'"
      },
      {
        "name": "bootstrap_updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "gateway_secret",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'partialypartialypartialypartialy'"
      },
      {
        "name": "gateway_as",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'yixivip'"
      },
      {
        "name": "email_service_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'https://gateway.partialy.cn/auth-service/api/send/email'"
      },
      {
        "name": "email_provider",
        "type": "VARCHAR(1024)",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'aliyun'"
      },
      {
        "name": "email_providers_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'[{\"code\":\"aliyun\",\"name\":\"阿里云\"},{\"code\":\"resend\",\"name\":\"Resend\"}]'"
      },
      {
        "name": "updater_enabled",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "1"
      },
      {
        "name": "updater_feed_base_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT",
        "default": "'https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64'"
      },
      {
        "name": "updater_check_startup",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "1"
      },
      {
        "name": "updater_startup_delay",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "15000"
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
      "id"
    ],
    "createSql": "CREATE TABLE `app_settings` (\n  `id` BIGINT NOT NULL,\n  `app_available` BIGINT NOT NULL DEFAULT 1,\n  `unavailable_reason` VARCHAR(1024) NOT NULL DEFAULT '',\n  `bootstrap_version` VARCHAR(1024) NOT NULL DEFAULT 'v1.0.0',\n  `bootstrap_updated_at` BIGINT NOT NULL DEFAULT 0,\n  `gateway_secret` VARCHAR(1024) NOT NULL DEFAULT 'partialypartialypartialypartialy',\n  `gateway_as` VARCHAR(1024) NOT NULL DEFAULT 'yixivip',\n  `email_service_url` LONGTEXT NOT NULL,\n  `email_provider` VARCHAR(1024) NOT NULL DEFAULT 'aliyun',\n  `email_providers_json` LONGTEXT NOT NULL,\n  `updater_enabled` BIGINT NOT NULL DEFAULT 1,\n  `updater_feed_base_url` LONGTEXT NOT NULL,\n  `updater_check_startup` BIGINT NOT NULL DEFAULT 1,\n  `updater_startup_delay` BIGINT NOT NULL DEFAULT 15000,\n  `created_at` BIGINT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "bootstrap_endpoints",
    "columns": [
      {
        "name": "key",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "value",
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
      "key"
    ],
    "createSql": "CREATE TABLE `bootstrap_endpoints` (\n  `key` VARCHAR(191) NOT NULL,\n  `value` LONGTEXT NOT NULL,\n  `sort_order` BIGINT NOT NULL DEFAULT 0,\n  PRIMARY KEY (`key`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "content_pages",
    "columns": [
      {
        "name": "code",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "title",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "content",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "version",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "1"
      },
      {
        "name": "updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "code"
    ],
    "createSql": "CREATE TABLE `content_pages` (\n  `code` VARCHAR(191) NOT NULL,\n  `title` LONGTEXT NOT NULL,\n  `content` LONGTEXT NOT NULL,\n  `version` BIGINT NOT NULL DEFAULT 1,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`code`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "app_share_config",
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "config_json",
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
      "id"
    ],
    "createSql": "CREATE TABLE `app_share_config` (\n  `id` BIGINT NOT NULL,\n  `config_json` LONGTEXT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "app_share_icon_uploads",
    "columns": [
      {
        "name": "object_key",
        "type": "VARCHAR(512)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "input_json",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "expires_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "file_id",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
      }
    ],
    "primaryKey": [
      "object_key"
    ],
    "createSql": "CREATE TABLE `app_share_icon_uploads` (\n  `object_key` VARCHAR(512) NOT NULL,\n  `input_json` LONGTEXT NOT NULL,\n  `expires_at` BIGINT NOT NULL,\n  `file_id` LONGTEXT NULL,\n  PRIMARY KEY (`object_key`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "about_config",
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "app_name",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "website_label",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "website_url",
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
        "name": "team",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "copyright",
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
      "id"
    ],
    "createSql": "CREATE TABLE `about_config` (\n  `id` BIGINT NOT NULL,\n  `app_name` LONGTEXT NOT NULL,\n  `website_label` LONGTEXT NOT NULL,\n  `website_url` LONGTEXT NOT NULL,\n  `description` LONGTEXT NOT NULL,\n  `team` LONGTEXT NOT NULL,\n  `copyright` LONGTEXT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "current_update",
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "latest_version",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "update_time",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "force_update",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "download_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "official_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "update_content",
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
      "id"
    ],
    "createSql": "CREATE TABLE `current_update` (\n  `id` BIGINT NOT NULL,\n  `latest_version` LONGTEXT NOT NULL,\n  `update_time` LONGTEXT NOT NULL,\n  `force_update` BIGINT NOT NULL DEFAULT 0,\n  `download_url` LONGTEXT NOT NULL,\n  `official_url` LONGTEXT NOT NULL,\n  `update_content` LONGTEXT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "release_info",
    "columns": [
      {
        "name": "platform",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "latest_version",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "update_time",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "force_update",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "download_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "official_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "update_content",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "platform_label",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "file_size_text",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "available",
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
      "platform"
    ],
    "createSql": "CREATE TABLE `release_info` (\n  `platform` VARCHAR(191) NOT NULL,\n  `latest_version` LONGTEXT NOT NULL,\n  `update_time` LONGTEXT NOT NULL,\n  `force_update` BIGINT NOT NULL DEFAULT 0,\n  `download_url` LONGTEXT NOT NULL,\n  `official_url` LONGTEXT NOT NULL,\n  `update_content` LONGTEXT NOT NULL,\n  `platform_label` LONGTEXT NOT NULL,\n  `file_size_text` LONGTEXT NOT NULL,\n  `available` BIGINT NOT NULL DEFAULT 0,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`platform`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "discover_config",
    "columns": [
      {
        "name": "id",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      },
      {
        "name": "url",
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
      "id"
    ],
    "createSql": "CREATE TABLE `discover_config` (\n  `id` BIGINT NOT NULL,\n  `url` LONGTEXT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "dynamic_configs",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "type",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "content",
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
        "name": "updated_at",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER"
      }
    ],
    "primaryKey": [
      "id"
    ],
    "createSql": "CREATE TABLE `dynamic_configs` (\n  `id` VARCHAR(191) NOT NULL,\n  `type` LONGTEXT NOT NULL,\n  `content` LONGTEXT NOT NULL,\n  `created_at` BIGINT NOT NULL,\n  `updated_at` BIGINT NOT NULL,\n  PRIMARY KEY (`id`),\n  KEY `idx_dynamic_configs_updated_at` (`updated_at`, `id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  },
  {
    "name": "update_history",
    "columns": [
      {
        "name": "id",
        "type": "VARCHAR(191)",
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
        "name": "version",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "update_time",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "force_update",
        "type": "BIGINT",
        "nullable": false,
        "sqliteType": "INTEGER",
        "default": "0"
      },
      {
        "name": "download_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "official_url",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "update_content",
        "type": "LONGTEXT",
        "nullable": false,
        "sqliteType": "TEXT"
      },
      {
        "name": "release_file_id",
        "type": "LONGTEXT",
        "nullable": true,
        "sqliteType": "TEXT"
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
    "createSql": "CREATE TABLE `update_history` (\n  `id` VARCHAR(191) NOT NULL,\n  `platform` VARCHAR(1024) NOT NULL DEFAULT 'android',\n  `version` LONGTEXT NOT NULL,\n  `update_time` LONGTEXT NOT NULL,\n  `force_update` BIGINT NOT NULL DEFAULT 0,\n  `download_url` LONGTEXT NOT NULL,\n  `official_url` LONGTEXT NOT NULL,\n  `update_content` LONGTEXT NOT NULL,\n  `release_file_id` LONGTEXT NULL,\n  `created_at` BIGINT NOT NULL,\n  `deleted_at` BIGINT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC",
    "foreignSql": []
  }
];
