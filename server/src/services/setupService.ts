import { randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { getAppDb } from "../db/appDb";
import { ensureInstallationSchema, readInstallation } from "../db/installationStore";
import { configManager } from "../config/configManager";
import { CONFIG_DEFINITIONS } from "../config/configDefinitions";

let setupToken = "";
export class SetupError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
export async function initializeInstallation(): Promise<void> {
  const db = getAppDb();
  const table = db.dialect === "mysql"
    ? await db.queryOne("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='app_installation'")
    : await db.queryOne("SELECT name FROM sqlite_master WHERE type='table' AND name='app_installation'");
  if (table && (await readInstallation(db))?.transfer_status === "incomplete") return;
  await ensureInstallationSchema(db);
  const installation = await readInstallation(db);
  if (installation?.transfer_status === "incomplete") return;
  const admin = await db.queryOne("SELECT username FROM admin_users LIMIT 1");
  if (!installation?.initialized_at && admin) {
    await db.execute("UPDATE app_installation SET initialized_at=?,legacy_user_tokens=1 WHERE id=1 AND initialized_at IS NULL", [Date.now()]);
  }
  if (!(await readInstallation(db))?.initialized_at) {
    setupToken = process.env.SETUP_TOKEN?.trim() || randomBytes(32).toString("hex");
    if (!process.env.SETUP_TOKEN?.trim()) console.log(`[setup] 首次安装令牌（仅本次进程有效）: ${setupToken}`);
  }
}
export async function isInstallationReady(): Promise<boolean> {
  const item = await readInstallation();
  return Boolean(item?.initialized_at && item.transfer_status === "ready");
}
export async function setupStatus() {
  const item = await readInstallation();
  return { initialized: Boolean(item?.initialized_at && item.transfer_status === "ready"), installationId: item?.installation_id,
    databaseType: getAppDb().dialect === "mysql" ? "MYSQL" : "SQLITE", transferStatus: item?.transfer_status ?? null, requiresSetupToken: true };
}
export async function completeSetup(input: Record<string, unknown>) {
  const provided = typeof input.setupToken === "string" ? input.setupToken : "";
  if (!setupToken || Buffer.byteLength(provided) !== Buffer.byteLength(setupToken) || !timingSafeEqual(Buffer.from(provided), Buffer.from(setupToken))) {
    throw new SetupError("安装令牌无效，请使用服务器环境变量或启动日志中的令牌", 403);
  }
  const username = String(input.username ?? "").trim();
  const password = typeof input.password === "string" ? input.password : "";
  if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username)) throw new SetupError("管理员用户名需为3至64位字母、数字或 _ . -", 400);
  if (password.length < 8 || Buffer.byteLength(password) > 72) throw new SetupError("密码至少8位且不超过72字节", 400);
  if (password !== input.confirmPassword) throw new SetupError("两次密码不一致", 400);
  const passwordHash = await bcrypt.hash(password, 12);
  const db = getAppDb();
  await db.transaction(async tx => {
    const item = await tx.queryOne<{ initialized_at: number | null; transfer_status: string }>(`SELECT initialized_at,transfer_status FROM app_installation WHERE id=1${db.dialect === "mysql" ? " FOR UPDATE" : ""}`);
    if (!item || item.initialized_at || item.transfer_status !== "ready") throw new SetupError("当前数据库已安装或存在未完成迁移，禁止安装", 409);
    if (await tx.queryOne("SELECT username FROM admin_users LIMIT 1")) throw new SetupError("管理员已存在，禁止重复安装", 409);
    const now = Date.now();
    await tx.execute("INSERT INTO admin_users(username,password_hash,updated_at) VALUES(?,?,?)", [username, passwordHash, now]);
    for (const def of CONFIG_DEFINITIONS) {
      await tx.execute(`${db.dialect === "mysql" ? "INSERT IGNORE" : "INSERT OR IGNORE"} INTO runtime_configs (` + "`key`" + ",name,value_json,updated_at) VALUES(?,?,?,?)", [def.key, def.label, JSON.stringify(def.defaultValue), now]);
    }
    const insertMissing = db.dialect === "mysql" ? "INSERT IGNORE" : "INSERT OR IGNORE";
    await tx.execute(`${insertMissing} INTO listening_level_config(id,version,updated_at) VALUES(1,1,0)`);
    await tx.execute(`${insertMissing} INTO listening_level_rules(level,min_minutes,max_minutes,created_at,updated_at) VALUES(1,0,NULL,0,0)`);
    await tx.execute("UPDATE app_installation SET initialized_at=?,legacy_user_tokens=0 WHERE id=1", [now]);
  });
  setupToken = "";
  try {
    await configManager.initialize();
  } catch {
    throw new SetupError("安装已完成，但运行配置加载失败，请重启服务", 503);
  }
  return setupStatus();
}
