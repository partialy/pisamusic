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
  description: "发现更多好音乐", qrCodeText: "https://pisamusic.partialy.cn/app-share/",
  copyTemplate: "分享 Pisa Music，发现更多好音乐！\n{url}", updatedAt: 0,
};
export async function readAppShareConfig(): Promise<AppShareConfig> {
  const row = (await getAppDb().queryOne("SELECT config_json, updated_at FROM app_share_config WHERE id = 1", [])) as { config_json: string; updated_at: number } | undefined;
  return row ? { ...JSON.parse(row.config_json), updatedAt: row.updated_at } : { ...APP_SHARE_DEFAULTS };
}
export async function saveAppShareConfig(input: Omit<AppShareConfig, "updatedAt">): Promise<AppShareConfig> {
  const db = getAppDb();
  return (await db.transaction(async () => {
    const now = Date.now();
    (await db.execute("UPDATE file_records SET referenced_by = '[]' WHERE usage_type = 'app-share-icon'", []));
    if (input.iconFileId) (await db.execute("UPDATE file_records SET referenced_by = ? WHERE id = ?", [JSON.stringify([{ type: "app-share-icon", id: "1" }]), input.iconFileId]));
    (await db.execute(db.dialect === "mysql" ? "INSERT INTO app_share_config(id, config_json, updated_at) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE config_json=VALUES(config_json), updated_at=VALUES(updated_at)" : "INSERT INTO app_share_config(id, config_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json, updated_at=excluded.updated_at", [JSON.stringify(input), now]));

    return { ...input, updatedAt: now };
  }));
}
export async function rememberAppShareUpload(key: string, input: unknown, expiresAt: number): Promise<void> {
  const db = getAppDb();
  (await db.execute("DELETE FROM app_share_icon_uploads WHERE expires_at < ? AND file_id IS NULL", [Date.now()]));
  (await db.execute("INSERT INTO app_share_icon_uploads(object_key,input_json,expires_at) VALUES (?,?,?)", [key, JSON.stringify(input), expiresAt]));
}
export async function readAppShareUpload(key: string) {
  return (await getAppDb().queryOne("SELECT input_json,expires_at,file_id FROM app_share_icon_uploads WHERE object_key=?", [key])) as { input_json: string; expires_at: number; file_id: string | null } | undefined;
}
export async function completeAppShareUpload(key: string, id: string): Promise<void> {
  (await getAppDb().execute("UPDATE app_share_icon_uploads SET file_id=? WHERE object_key=?", [id, key]));
}
