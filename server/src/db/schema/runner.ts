import { upgradeMysqlFeedback, upgradeSqliteFeedback } from "./feedbackMigration";
import { validatePlaylistCoverSchema } from "./playlistCoverValidation";
import { validateSongDownloadSchema } from "./songDownloadValidation";
import { upgradeMysqlPlaylistCovers } from "./playlistCoverMigration";
import { upgradeMysqlSidebarMenus } from "./sidebarMenuMigration";
import { upgradeMysqlSongDownloads } from "./songDownloadMigration";
import { upgradeMysqlSync, upgradeSqliteSync } from "./syncMigration";
import { upgradeMysqlWebsiteAnalytics, upgradeSqliteWebsiteAnalytics } from "./websiteAnalyticsMigration";
import { ensureInstallationSchema, markTransferIncomplete } from "../installationStore";
import { createHash } from "node:crypto";
import { DatabaseError, DbClient } from "../core/types";
import { MYSQL_TABLES } from "./mysql/tables";
import { MYSQL_ARCHIVE_TABLES } from "./mysql/archives";
export { MYSQL_TABLES } from "./mysql/tables";
export { MYSQL_ARCHIVE_TABLES } from "./mysql/archives";
export const SCHEMA_VERSION = 8;
export const schemaFingerprint = createHash("sha256").update(JSON.stringify({ tables: MYSQL_TABLES, archives: MYSQL_ARCHIVE_TABLES })).digest("hex");
const ledgerSql = `CREATE TABLE schema_migrations (
 version BIGINT NOT NULL PRIMARY KEY, fingerprint VARCHAR(64) NOT NULL,
 status VARCHAR(16) NOT NULL, task_id VARCHAR(191) NOT NULL,
 created_objects_json LONGTEXT NOT NULL, started_at BIGINT NOT NULL, completed_at BIGINT NULL,
 error_code VARCHAR(64) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin ROW_FORMAT=DYNAMIC`;
interface MigrationRow { version: number; fingerprint: string; status: string }
async function assertMysqlVersion(client: DbClient): Promise<void> {
  const version = await client.queryOne<{ version: string }>("SELECT VERSION() AS version");
  if (!version?.version.startsWith("5.7.")) throw new DatabaseError("DB_VERSION", "当前方案仅允许 MySQL 5.7");
}
async function assertTransferReady(client: DbClient): Promise<void> {
  const table = client.dialect === "mysql"
    ? await client.queryOne("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='app_installation'")
    : await client.queryOne("SELECT name FROM sqlite_master WHERE type='table' AND name='app_installation'");
  if (!table) return;
  const marker = await client.queryOne<{transfer_status:string}>("SELECT transfer_status FROM app_installation WHERE id=1");
  if (!marker || marker.transfer_status !== "ready") throw new DatabaseError("DB_TRANSFER_INCOMPLETE", "数据库复制未完成，禁止启动业务或重新安装");
}
export async function assertSchemaCurrent(client: DbClient, allowIncompleteTransfer = false): Promise<void> {
  if (!allowIncompleteTransfer) await assertTransferReady(client);
  if (client.dialect !== "mysql") return;
  const row = await client.queryOne<MigrationRow>("SELECT version, fingerprint, status FROM schema_migrations ORDER BY version DESC LIMIT 1");
  if (!row || Number(row.version) !== SCHEMA_VERSION || row.status !== "applied") {
    throw new DatabaseError("DB_SCHEMA_NOT_READY", "MySQL Schema 未完成初始化或版本不匹配");
  }
  for (const table of MYSQL_TABLES.filter(table => ["users", "feedback", "site_visit_records", "download_records", "site_page_view_records", "playlist_cover_resources", "playlist_cover_refs", "song_download_quota_states", "song_download_batches", "song_download_records", "sidebar_menu_config", "sidebar_menu_icon_uploads"].includes(table.name))) {
    await validateRecoveryTable(client, table.name, table.createSql);
  }
  await validatePlaylistCoverSchema(client);
  await validateSongDownloadSchema(client);
  const legacyUvIndex = await client.queryOne("SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='site_visit_records' AND INDEX_NAME='ux_site_visit_day_visitor'");
  if (legacyUvIndex) throw new DatabaseError("DB_SCHEMA_NOT_READY", "旧 UV 唯一索引尚未移除，域名统计 Schema 不完整");
}
/** 仅用于已确认的空目标库。DDL隐式提交，失败保留账本和已创建对象，绝不自动删库。 */
export async function initializeSchema(client: DbClient, taskId = "manual-initialization", transferTaskId?: string): Promise<void> {
  if (client.dialect === "sqlite") {
    if (transferTaskId) await markTransferIncomplete(client, transferTaskId);
    else await assertTransferReady(client);
    await initializeSqliteSchemaMetadata(client); return;
  }
  if (!/^[a-zA-Z0-9_-]{1,191}$/.test(taskId)) throw new DatabaseError("DB_SCHEMA_TASK", "Schema 任务标识无效");
  await assertMysqlVersion(client);
  const tables = await client.query<{ name: string }>("SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE()");
  if (tables.length) throw new DatabaseError("DB_TARGET_NOT_EMPTY", "目标库必须为空；已有Schema也不能自动重新初始化");
  if (transferTaskId) await markTransferIncomplete(client, transferTaskId);
  await client.execute(ledgerSql);
  const created = ["schema_migrations"];
  await client.execute("INSERT INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at) VALUES(?,?,?,?,?,?)", [SCHEMA_VERSION, schemaFingerprint, "applying", taskId, JSON.stringify(created), Date.now()]);
  const record = () => client.execute("UPDATE schema_migrations SET created_objects_json=? WHERE version=?", [JSON.stringify(created), SCHEMA_VERSION]);
  try {
    for (const table of [...MYSQL_TABLES, ...MYSQL_ARCHIVE_TABLES]) {
      // 先登记意图；崩溃后不能将未记账对象误认为其他任务资产。
      created.push(table.name); await record();
      await client.execute(table.createSql);
    }
    for (const table of MYSQL_TABLES) for (const ddl of table.foreignSql) await client.execute(ddl);
    await ensureInstallationSchema(client);
    await client.execute("UPDATE schema_migrations SET status=?,completed_at=? WHERE version=?", ["applied", Date.now(), SCHEMA_VERSION]);
  } catch {
    await client.execute("UPDATE schema_migrations SET status=?,error_code=? WHERE version=?", ["failed", "DDL_FAILED", SCHEMA_VERSION]).catch(() => undefined);
    throw new DatabaseError("DB_SCHEMA_FAILED", "MySQL Schema 初始化失败；保留任务账本，禁止自动清理或重试覆盖");
  }
}
export const initializeMysqlSchema = initializeSchema;
/** SQLite业务结构由现有appDb先行升级，此处仅维护版本账本。 */
export async function initializeSqliteSchemaMetadata(client: DbClient): Promise<void> {
  if (client.dialect !== "sqlite") throw new DatabaseError("DB_SCHEMA_MODE", "仅适用于 SQLite");
  await client.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, fingerprint TEXT NOT NULL, status TEXT NOT NULL, started_at INTEGER NOT NULL, completed_at INTEGER)");
  await ensureInstallationSchema(client);
  await validatePlaylistCoverSchema(client);
  await validateSongDownloadSchema(client);
  await client.transaction(async tx => {
    const latest = await tx.queryOne<MigrationRow>("SELECT version,fingerprint,status FROM schema_migrations ORDER BY version DESC LIMIT 1");
    if (latest && ((Number(latest.version) < 1 || Number(latest.version) > SCHEMA_VERSION) || latest.status !== "applied")) {
      throw new DatabaseError("DB_SCHEMA_NOT_READY", "SQLite Schema 账本版本不匹配");
    }
    if (!latest || Number(latest.version) < SCHEMA_VERSION) await tx.execute("INSERT INTO schema_migrations(version,fingerprint,status,started_at,completed_at) VALUES(?,?,?,?,?)", [SCHEMA_VERSION, schemaFingerprint, "applied", Date.now(), Date.now()]);
  });
}


interface RecoveryLedger extends MigrationRow { task_id: string; created_objects_json: string }
interface MysqlColumn { name: string; type: string; nullable: string; extra: string }
interface MysqlIndex { name: string; column: string; position: number; nonUnique: number; prefix: number | null }
const normalizeMysqlType = (value: string) => value.toLowerCase().replace(/\b(bigint|int|integer|tinyint|smallint|mediumint)\(\d+\)/g, "$1").replace(/\binteger\b/g, "int").replace(/\s+/g, " ").trim();
const installationSql = `CREATE TABLE app_installation (
 id INTEGER PRIMARY KEY, installation_id VARCHAR(64) NOT NULL,
 initialized_at BIGINT NULL, transfer_status VARCHAR(16) NOT NULL,
 transfer_task_id VARCHAR(191) NULL, legacy_user_tokens INTEGER NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin`;
/** 仅认领与当前显式 DDL 一致的已创建对象，绝不通过 IF NOT EXISTS 掩盖结构冲突。 */
async function validateRecoveryTable(client: DbClient, name: string, ddl: string): Promise<void> {
  const columns = await client.query<MysqlColumn>("SELECT COLUMN_NAME AS name,COLUMN_TYPE AS type,IS_NULLABLE AS nullable,EXTRA AS extra FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION", [name]);
  const body = ddl.slice(ddl.indexOf("(") + 1, ddl.lastIndexOf(")"));
  const expected = [...body.matchAll(/(?:^|,\s*|\n\s*)`?([A-Za-z_][A-Za-z0-9_]*)`?\s+((?:BIGINT|INTEGER|INT|VARCHAR\(\d+\)|LONGTEXT|DOUBLE|DECIMAL\([\d,]+\)|TEXT)(?:\s+UNSIGNED)?)\s+([^\n]*?)(?=,\s*(?:\n|[A-Za-z_])|\n|$)/gi)];
  if (!expected.length || columns.length !== expected.length) throw new DatabaseError("DB_SCHEMA_RECOVERY", `表 ${name} 字段集合不匹配，禁止自动认领`);
  for (const match of expected) {
    const column = columns.find(item => item.name === match[1]);
    const nullable = !/NOT NULL|PRIMARY KEY/i.test(match[3]!.split(/GENERATED/i)[0]!);
    if (!column || normalizeMysqlType(column.type) !== normalizeMysqlType(match[2]!) || (column.nullable === "YES") !== nullable || /auto_increment/i.test(column.extra) !== /AUTO_INCREMENT/i.test(match[3]!)) throw new DatabaseError("DB_SCHEMA_RECOVERY", `表 ${name}.${match[1]} 类型或约束不匹配`);
  }
  const indexes = await client.query<MysqlIndex>("SELECT INDEX_NAME AS name,COLUMN_NAME AS `column`,SEQ_IN_INDEX AS position,NON_UNIQUE AS nonUnique,SUB_PART AS prefix FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY INDEX_NAME,SEQ_IN_INDEX", [name]);
  const required = [...ddl.matchAll(/(PRIMARY KEY|UNIQUE KEY\s+`([^`]+)`|KEY\s+`([^`]+)`)\s*\(([^)]+)\)/g)];
  for (const column of expected) if (/PRIMARY KEY/i.test(column[3]!)) required.push(["", "PRIMARY KEY", undefined, undefined, "`" + column[1] + "`"] as unknown as RegExpExecArray);
  for (const match of required) {
    const indexName = match[1] === "PRIMARY KEY" ? "PRIMARY" : (match[2] ?? match[3])!;
    const fields = [...match[4]!.matchAll(/`([^`]+)`/g)].map(item => item[1]);
    const actual = indexes.filter(item => item.name === indexName).sort((a,b)=>Number(a.position)-Number(b.position));
    if (actual.length !== fields.length || actual.some((item,i)=>item.column !== fields[i] || item.prefix !== null || Boolean(Number(item.nonUnique)) !== !/^(PRIMARY|UNIQUE)/.test(match[1]!))) throw new DatabaseError("DB_SCHEMA_RECOVERY", `表 ${name} 索引 ${indexName} 不匹配`);
  }
  const engine = await client.queryOne<{engine:string}>("SELECT ENGINE AS engine FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", [name]);
  if (engine?.engine.toLowerCase() !== "innodb") throw new DatabaseError("DB_SCHEMA_RECOVERY", `表 ${name} 不是 InnoDB`);
}
/** 显式复制/恢复可补建本版本中断的 DDL；普通启动仍严格拒绝半成品。 */
async function resumeTransferSchema(client: DbClient, taskId: string, tables: {name:string}[]): Promise<void> {
  const definitions = [...MYSQL_TABLES, ...MYSQL_ARCHIVE_TABLES];
  const allowed = new Set(["schema_migrations", "app_installation", ...definitions.map(table=>table.name)]);
  const existing = new Set(tables.map(table=>table.name));
  if (tables.some(table=>!allowed.has(table.name))) throw new DatabaseError("DB_SCHEMA_RECOVERY", "目标存在未受控表，禁止补建");
  // 在校验旧账本和旧任务标识之前，不更新安装标记。
  if (existing.has("app_installation")) await validateRecoveryTable(client, "app_installation", installationSql);
  const marker = existing.has("app_installation") ? await client.queryOne<{transfer_status:string;transfer_task_id:string|null}>("SELECT transfer_status,transfer_task_id FROM app_installation WHERE id=1") : null;
  if (marker && !["ready", "incomplete"].includes(marker.transfer_status)) throw new DatabaseError("DB_SCHEMA_RECOVERY", "目标安装标记无效");
  let ledger: RecoveryLedger | null = null;
  if (existing.has("schema_migrations")) {
    await validateRecoveryTable(client, "schema_migrations", ledgerSql);
    const rows = await client.query<RecoveryLedger>("SELECT version,fingerprint,status,task_id,created_objects_json FROM schema_migrations ORDER BY version DESC");
    if (rows.length > 1) throw new DatabaseError("DB_SCHEMA_RECOVERY", "中断账本包含非预期版本记录");
    ledger = rows[0] ?? null;
  }
  let created: string[];
  if (!ledger) {
    if (!existing.has("app_installation") || [...existing].some(name=>name!=="app_installation"&&name!=="schema_migrations") || (marker && (marker.transfer_status!=="incomplete" || !marker.transfer_task_id))) throw new DatabaseError("DB_SCHEMA_RECOVERY", "无账本目标不符合复制早期中断形态");
    created = ["schema_migrations"];
  } else {
    if (Number(ledger.version)!==SCHEMA_VERSION || ledger.fingerprint!==schemaFingerprint || !["applying","failed"].includes(ledger.status) || !/^[a-zA-Z0-9_-]{1,191}$/.test(ledger.task_id)) throw new DatabaseError("DB_SCHEMA_RECOVERY", "中断账本版本、指纹或状态不匹配");
    let recorded:unknown;
    try { recorded=JSON.parse(ledger.created_objects_json); } catch { throw new DatabaseError("DB_SCHEMA_RECOVERY", "中断账本对象清单无效"); }
    const order=["schema_migrations",...definitions.map(table=>table.name)];
    if (!Array.isArray(recorded) || !recorded.length || recorded.length>order.length || recorded.some((name,i)=>name!==order[i])) throw new DatabaseError("DB_SCHEMA_RECOVERY", "中断账本对象顺序不匹配");
    created=recorded as string[];
    if ([...existing].some(name=>name!=="app_installation"&&!created.includes(name))) throw new DatabaseError("DB_SCHEMA_RECOVERY", "发现未在中断账本登记的对象");
    if (marker && (marker.transfer_status!=="incomplete" || !marker.transfer_task_id)) throw new DatabaseError("DB_SCHEMA_RECOVERY", "中断账本缺少复制防护标记");
  }
  for (const table of definitions) if (existing.has(table.name)) await validateRecoveryTable(client,table.name,table.createSql);
  const constraints = await client.query<{tableName:string;name:string;columnName:string;refTable:string;refColumn:string;position:number;deleteRule:string;updateRule:string}>("SELECT k.TABLE_NAME AS tableName,k.CONSTRAINT_NAME AS name,k.COLUMN_NAME AS columnName,k.REFERENCED_TABLE_NAME AS refTable,k.REFERENCED_COLUMN_NAME AS refColumn,k.ORDINAL_POSITION AS position,r.DELETE_RULE AS deleteRule,r.UPDATE_RULE AS updateRule FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_NAME IS NOT NULL ORDER BY k.TABLE_NAME,k.CONSTRAINT_NAME,k.ORDINAL_POSITION");
  const foreign = MYSQL_TABLES.flatMap(table=>table.foreignSql.map(sql=>({table:table.name,sql,match:/CONSTRAINT\s+`([^`]+)`\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+`([^`]+)`\s*\(([^)]+)\)/i.exec(sql)})));
  for (const constraint of constraints) {
    const expected=foreign.find(item=>item.table===constraint.tableName&&item.match?.[1]===constraint.name);
    const index=Number(constraint.position)-1;
    const fields=(value:string)=>[...value.matchAll(/`([^`]+)`/g)].map(match=>match[1]);
    if (!expected?.match || expected.match[3]!==constraint.refTable || fields(expected.match[2]!)[index]!==constraint.columnName || fields(expected.match[4]!)[index]!==constraint.refColumn || constraint.deleteRule.replace("RESTRICT","NO ACTION")!==( /ON DELETE (NO ACTION|RESTRICT|CASCADE|SET NULL)/i.exec(expected.sql)?.[1] ?? "NO ACTION").replace("RESTRICT","NO ACTION") || constraint.updateRule.replace("RESTRICT","NO ACTION")!==( /ON UPDATE (NO ACTION|RESTRICT|CASCADE|SET NULL)/i.exec(expected.sql)?.[1] ?? "NO ACTION").replace("RESTRICT","NO ACTION")) throw new DatabaseError("DB_SCHEMA_RECOVERY", "目标存在不兼容外键");
  }
  await markTransferIncomplete(client,taskId);
  if (!existing.has("schema_migrations")) await client.execute(ledgerSql);
  if (!ledger) await client.execute("INSERT INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at) VALUES(?,?,?,?,?,?)",[SCHEMA_VERSION,schemaFingerprint,"applying",taskId,JSON.stringify(created),Date.now()]);
  else await client.execute("UPDATE schema_migrations SET status='applying',error_code=NULL WHERE version=?",[SCHEMA_VERSION]);
  try {
    for (const table of definitions) {
      if (!created.includes(table.name)) { created.push(table.name); await client.execute("UPDATE schema_migrations SET created_objects_json=? WHERE version=?",[JSON.stringify(created),SCHEMA_VERSION]); }
      if (!existing.has(table.name)) await client.execute(table.createSql);
    }
    for (const item of foreign) {
      if (!item.match) throw new DatabaseError("DB_SCHEMA_RECOVERY", "受控外键定义无法解析");
      if (!constraints.some(constraint=>constraint.tableName===item.table&&constraint.name===item.match![1])) await client.execute(item.sql);
    }
    await client.execute("UPDATE schema_migrations SET status='applied',completed_at=?,error_code=NULL WHERE version=?",[Date.now(),SCHEMA_VERSION]);
  } catch (error) {
    await client.execute("UPDATE schema_migrations SET status='failed',error_code='DDL_FAILED' WHERE version=?",[SCHEMA_VERSION]).catch(()=>undefined);
    throw error;
  }
}

/** 按库内 Schema 账本独立启动，不依赖本机迁移记录。 */
export async function prepareDatabaseSchema(client: DbClient, transferTaskId?: string): Promise<void> {
  if (client.dialect === "sqlite") {
    if (transferTaskId) await markTransferIncomplete(client, transferTaskId);
    else await assertTransferReady(client);
    const { CREATE_SQL } = await import("../appDb.js");
    const { APP_SHARE_TRACKING_SQL } = await import("../appShareTrackingSchema.js");
    await upgradeSqliteWebsiteAnalytics(client);
    await upgradeSqliteSync(client);
    await upgradeSqliteFeedback(client);
    for (const statement of (CREATE_SQL + APP_SHARE_TRACKING_SQL).split(";")) {
      if (statement.trim()) await client.execute(statement);
    }
    await initializeSqliteSchemaMetadata(client);
    return;
  }
  await assertMysqlVersion(client);
  const tables = await client.query<{ name: string }>("SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE()");
  if (!tables.length) await initializeSchema(client, "standalone-initialization", transferTaskId);
  else {
    const hasLedger = tables.some(table=>table.name === "schema_migrations");
    let row = hasLedger ? await client.queryOne<MigrationRow>("SELECT version,fingerprint,status FROM schema_migrations ORDER BY version DESC LIMIT 1") : null;
    if (transferTaskId && (!row || (row.status !== "applied" && !(((Number(row.version) === 3 && await client.queryOne("SELECT version FROM schema_migrations WHERE version=2 AND status='applied'")) || (Number(row.version) === 4 && await client.queryOne("SELECT version FROM schema_migrations WHERE version=3 AND status='applied'")) || (Number(row.version) === 5 && await client.queryOne("SELECT version FROM schema_migrations WHERE version=4 AND status='applied'")) || (Number(row.version) === 6 && await client.queryOne("SELECT version FROM schema_migrations WHERE version=5 AND status='applied'")) || (Number(row.version) === 7 && await client.queryOne("SELECT version FROM schema_migrations WHERE version=6 AND status='applied'")) || (Number(row.version) === 8 && await client.queryOne("SELECT version FROM schema_migrations WHERE version=7 AND status='applied'"))))))) {
      await resumeTransferSchema(client, transferTaskId, tables);
      return;
    }
    if (transferTaskId) {
      if (!row || (row.status !== "applied" && ![3,4,5,6,7,8].includes(Number(row.version))) || ![1,2,3,4,5,6,7,SCHEMA_VERSION].includes(Number(row.version))) throw new DatabaseError("DB_SCHEMA_RECOVERY", "目标 Schema 版本不可认领");
      if (tables.some(table=>table.name === "app_installation")) {
        const marker = await client.queryOne<{transfer_status:string;transfer_task_id:string|null}>("SELECT transfer_status,transfer_task_id FROM app_installation WHERE id=1");
        if (!marker || !["ready","incomplete"].includes(marker.transfer_status)) throw new DatabaseError("DB_SCHEMA_RECOVERY", "目标安装标记无效");
      }
      await markTransferIncomplete(client, transferTaskId);
    } else await assertTransferReady(client);
    if (row?.status === "applied" && Number(row.version) === 1) {
      // 升级仅新增安装元数据，不以旧代码包指纹决定准入。
      for (const table of MYSQL_TABLES.filter(table => !["site_page_view_records", "playlist_cover_resources", "playlist_cover_refs", "song_download_quota_states", "song_download_batches", "song_download_records", "sidebar_menu_config", "sidebar_menu_icon_uploads"].includes(table.name))) {
        const columns = await client.query<{name:string}>("SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", [table.name]);
        const actual = new Set(columns.map(column => column.name));
        if (table.columns.some(column => column.name !== "domain" && column.name !== "sync_log_floor" && !["user_id", "device_kind", "device_id"].includes(column.name) && !actual.has(column.name))) throw new DatabaseError("DB_SCHEMA_NOT_READY", `业务表 ${table.name} 缺少必要字段`);
      }
      await ensureInstallationSchema(client);
      await client.execute("INSERT INTO schema_migrations(version,fingerprint,status,task_id,created_objects_json,started_at,completed_at) VALUES(?,?,?,?,?,?,?)", [2, schemaFingerprint, "applied", "upgrade-v2-installation", JSON.stringify(["app_installation"]), Date.now(), Date.now()]);
    }
    row = await client.queryOne<MigrationRow>("SELECT version,fingerprint,status FROM schema_migrations ORDER BY version DESC LIMIT 1");
    if (row && ((Number(row.version) === 2 && row.status === "applied") || (Number(row.version) === 3 && row.status !== "applied"))) {
      await upgradeMysqlWebsiteAnalytics(client, schemaFingerprint, validateRecoveryTable);
    }
    row = await client.queryOne<MigrationRow>("SELECT version,fingerprint,status FROM schema_migrations ORDER BY version DESC LIMIT 1");
    if (row && ((Number(row.version) === 3 && row.status === "applied") || (Number(row.version) === 4 && row.status !== "applied"))) await upgradeMysqlSync(client, schemaFingerprint, validateRecoveryTable);
    row = await client.queryOne<MigrationRow>("SELECT version,fingerprint,status FROM schema_migrations ORDER BY version DESC LIMIT 1");
    if (row && ((Number(row.version) === 4 && row.status === "applied") || (Number(row.version) === 5 && row.status !== "applied"))) await upgradeMysqlPlaylistCovers(client, schemaFingerprint, validateRecoveryTable);
    row = await client.queryOne<MigrationRow>("SELECT version,fingerprint,status FROM schema_migrations ORDER BY version DESC LIMIT 1");
    if (row && ((Number(row.version) === 5 && row.status === "applied") || (Number(row.version) === 6 && row.status !== "applied"))) await upgradeMysqlSongDownloads(client, schemaFingerprint, validateRecoveryTable);
    row = await client.queryOne<MigrationRow>("SELECT version,fingerprint,status FROM schema_migrations ORDER BY version DESC LIMIT 1");
    if (row && ((Number(row.version) === 6 && row.status === "applied") || (Number(row.version) === 7 && row.status !== "applied"))) await upgradeMysqlFeedback(client, schemaFingerprint, validateRecoveryTable);
    row = await client.queryOne<MigrationRow>("SELECT version,fingerprint,status FROM schema_migrations ORDER BY version DESC LIMIT 1");
    if (row && ((Number(row.version) === 7 && row.status === "applied") || (Number(row.version) === 8 && row.status !== "applied"))) await upgradeMysqlSidebarMenus(client, schemaFingerprint, validateRecoveryTable);
    await assertSchemaCurrent(client, Boolean(transferTaskId));
  }
}
