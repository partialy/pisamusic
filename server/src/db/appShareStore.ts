import { getAppDb } from "./appDb";

export type AppShareConfig = {
  appName: string;
  versionOverride: string;
  iconFileId: string | null;
  description: string;
  qrCodeText: string;
  copyTemplate: string;
  updatedAt: number;
};
export const APP_SHARE_DEFAULTS: AppShareConfig = {
  appName: "Pisa Music", versionOverride: "", iconFileId: null,
  description: "发现更多好音乐", qrCodeText: "https://pisamusic.partialy.cn/download/",
  copyTemplate: "分享 Pisa Music，发现更多好音乐！\n{url}", updatedAt: 0,
};
export function readAppShareConfig(): AppShareConfig {
  const row = getAppDb().prepare("SELECT config_json, updated_at FROM app_share_config WHERE id = 1").get() as { config_json: string; updated_at: number } | undefined;
  return row ? { ...JSON.parse(row.config_json), updatedAt: row.updated_at } : { ...APP_SHARE_DEFAULTS };
}
export function saveAppShareConfig(input: Omit<AppShareConfig, "updatedAt">): AppShareConfig {
  const db = getAppDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const now = Date.now();
    db.prepare("UPDATE file_records SET referenced_by = '[]' WHERE usage_type = 'app-share-icon'").run();
    if (input.iconFileId) db.prepare("UPDATE file_records SET referenced_by = ? WHERE id = ?").run(JSON.stringify([{ type: "app-share-icon", id: "1" }]), input.iconFileId);
    db.prepare("INSERT INTO app_share_config(id, config_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json, updated_at=excluded.updated_at").run(JSON.stringify(input), now);
    db.exec("COMMIT");
    return { ...input, updatedAt: now };
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}
export function rememberAppShareUpload(key: string, input: unknown, expiresAt: number): void {
  const db = getAppDb();
  db.prepare("DELETE FROM app_share_icon_uploads WHERE expires_at < ? AND file_id IS NULL").run(Date.now());
  db.prepare("INSERT INTO app_share_icon_uploads(object_key,input_json,expires_at) VALUES (?,?,?)").run(key, JSON.stringify(input), expiresAt);
}
export function readAppShareUpload(key: string) {
  return getAppDb().prepare("SELECT input_json,expires_at,file_id FROM app_share_icon_uploads WHERE object_key=?").get(key) as { input_json: string; expires_at: number; file_id: string | null } | undefined;
}
export function completeAppShareUpload(key: string, id: string): void {
  getAppDb().prepare("UPDATE app_share_icon_uploads SET file_id=? WHERE object_key=?").run(id,key);
}
