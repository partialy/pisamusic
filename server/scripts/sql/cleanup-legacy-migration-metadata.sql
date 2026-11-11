-- 适用：已部署独立数据库版本、schema_migrations 最新版本为 2 且 applied。
-- 执行前停止服务并备份；在正确业务库执行。本脚本不创建管理员、不改业务数据。
-- 未升级或缺少账本时自动跳过，不能用本脚本绕过失败/未完成复制标记。
SELECT DATABASE() AS current_database;
SET @has_ledger = (SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='schema_migrations');
SET @cleanup_sql = IF(@has_ledger=1,
  'DELETE old FROM schema_migrations old JOIN schema_migrations current_version ON current_version.version=2 AND current_version.status=''applied'' WHERE old.version<2',
  'SELECT ''未发现Schema账本，跳过清理'' AS message');
PREPARE cleanup_statement FROM @cleanup_sql;
EXECUTE cleanup_statement;
DEALLOCATE PREPARE cleanup_statement;

-- v2仍使用账本的兼容字段，但旧迁移任务ID、对象清单和错误内容已无运行用途。
SET @cleanup_sql = IF(@has_ledger=1,
  'UPDATE schema_migrations SET task_id=''schema-v2'',created_objects_json=''[]'',error_code=NULL WHERE version=2 AND status=''applied''',
  'SELECT ''未发现Schema账本，跳过清理'' AS message');
PREPARE cleanup_statement FROM @cleanup_sql;
EXECUTE cleanup_statement;
DEALLOCATE PREPARE cleanup_statement;

-- 以下是可选的历史归档数据清理，默认不执行。
-- 归档保留旧SQLite原始历史行，仅用于追溯，不承担当前业务职责。
-- 确认不需要历史数据并已备份后，可逐条取消注释；保留容器表，供双向复制使用。
-- DELETE FROM legacy_archive_json_imports;
-- DELETE FROM legacy_archive_listen_together_user_records;

-- 必须保留：schema_migrations 的当前版本行、app_installation 全表。
-- app_installation 是当前安装/复制完整性元数据，不是旧迁移垃圾。
-- 不得手动把 incomplete 改为 ready；请重新执行复制或恢复完整备份。
-- 本机 data/operations/state.json 旧启用标记已不读取，不需要SQL处理。
