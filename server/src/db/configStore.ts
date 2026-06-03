import { DatabaseSync } from "node:sqlite";
import { getAppDb } from "./appDb";

export type AppUpdate = {
  latestVersion: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
};

export type ReleasePlatform = "android" | "desktop";

export type ReleaseFileStatus = "uploaded" | "deleted";

export type ReleaseFileInfo = {
  id: string;
  fileRecordId?: string | null;
  historyId: string | null;
  platform: ReleasePlatform;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
  status: ReleaseFileStatus;
  createdAt: number;
  deletedAt: number | null;
  desktopUpdateAsset?: DesktopUpdateAssetInfo;
};

export type DesktopUpdateAssetType = "latest-yml" | "installer" | "blockmap";

export type DesktopUpdateAssetInfo = {
  id: string;
  fileRecordId?: string | null;
  version: string;
  platform: "win32";
  arch: "x64";
  fileType: DesktopUpdateAssetType;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  status: ReleaseFileStatus;
  active: boolean;
  createdAt: number;
  deletedAt: number | null;
  releaseFile?: ReleaseFileInfo | null;
};

export type FileRecordUsageType = "release-package" | "desktop-update";

export type FileRecordInfo = {
  id: string;
  usageType: FileRecordUsageType;
  platform: string;
  version: string;
  assetType: string;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
  status: ReleaseFileStatus;
  referencedBy: string[];
  createdAt: number;
  deletedAt: number | null;
};

export type FileRecordListQuery = {
  status?: ReleaseFileStatus | "all";
  usageType?: FileRecordUsageType | "all";
  platform?: string;
  version?: string;
  keyword?: string;
  offset?: number;
  limit?: number;
};

export type FileRecordListResult = {
  items: FileRecordInfo[];
  total: number;
  offset: number;
  limit: number;
};

export type ReleaseInfo = AppUpdate & {
  platformLabel: string;
  fileSizeText: string;
  available: boolean;
};

export type ReleaseConfig = Record<ReleasePlatform, ReleaseInfo>;

export type GatewaySignConfig = {
  secret: string;
  as: string;
};

export type DesktopUpdaterConfig = {
  enabled: boolean;
  feedBaseUrl: string;
  checkOnStartup: boolean;
  startupDelayMs: number;
};

export type AvailabilityConfig = {
  appAvailable: boolean;
  unavailableReason: string;
};

export type EmailProviderConfig = {
  code: string;
  name: string;
};

export type EmailConfig = {
  serviceUrl: string;
  provider: string;
  providers: EmailProviderConfig[];
};

export type BootstrapConfig = {
  version: string;
  updatedAt: number;
  endpoints: Record<string, string>;
  gatewaySign?: GatewaySignConfig;
  updater?: {
    desktop?: DesktopUpdaterConfig;
  };
};

export type TextContentConfig = {
  title: string;
  content: string;
};

export type AboutConfig = {
  appName: string;
  websiteLabel: string;
  websiteUrl: string;
  description: string;
  team: string;
  copyright: string;
};

export type DiscoverConfig = {
  url: string;
  updatedAt: number;
};

export type AppConfig = {
  availability: AvailabilityConfig;
  email: EmailConfig;
  bootstrap: BootstrapConfig;
  update: AppUpdate;
  releases: ReleaseConfig;
  agreement: TextContentConfig;
  privacy: TextContentConfig;
  about: AboutConfig;
  discover: DiscoverConfig;
  encryption?: {
    plaintextPaths: string[];
  };
};

export type EditableAppConfigSections = {
  availability?: AvailabilityConfig;
  email?: EmailConfig;
  bootstrap?: Partial<BootstrapConfig>;
  releases?: Partial<ReleaseConfig>;
  agreement?: TextContentConfig;
  privacy?: TextContentConfig;
  about?: AboutConfig;
  discover?: DiscoverConfig;
};

export type UpdateHistoryItem = {
  id: string;
  platform: ReleasePlatform;
  version: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
  releaseFileId?: string | null;
  releaseFile?: ReleaseFileInfo | null;
};

const RELEASE_PLATFORMS: ReleasePlatform[] = ["android", "desktop"];
const DEFAULT_DESKTOP_UPDATE_FEED = "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64";
const DEFAULT_EMAIL_SERVICE_URL = "https://gateway.partialy.cn/auth-service/api/send/email";
const DEFAULT_EMAIL_PROVIDER = "aliyun";
const DEFAULT_EMAIL_PROVIDERS: EmailProviderConfig[] = [
  { code: "aliyun", name: "???" },
  { code: "resend", name: "Resend" },
];

export type Announcement = {
  id: string;
  content: string;
  time: string;
  publisher: string;
  confirmText: string;
  showEveryTime?: boolean;
  showGotoButton: boolean;
  gotoUrl?: string;
};

export type AdminUser = {
  username: string;
  passwordHash: string;
};

export type FeedbackItem = {
  id: string;
  createdAt: string;
  feedback_type: string;
  description: string;
  contact: string | null;
  device: Record<string, unknown>;
  imagePaths: string[];
};

const DEFAULT_APP_CONFIG: AppConfig = {
  availability: {
    appAvailable: true,
    unavailableReason: "Service is under maintenance",
  },
  email: {
    serviceUrl: DEFAULT_EMAIL_SERVICE_URL,
    provider: DEFAULT_EMAIL_PROVIDER,
    providers: DEFAULT_EMAIL_PROVIDERS,
  },
  bootstrap: {
    version: "v1.0.0",
    updatedAt: 0,
    endpoints: {},
    gatewaySign: {
      secret: "partialypartialypartialypartialy",
      as: "yixivip",
    },
    updater: {
      desktop: {
        enabled: true,
        feedBaseUrl: DEFAULT_DESKTOP_UPDATE_FEED,
        checkOnStartup: true,
        startupDelayMs: 15000,
      },
    },
  },
  update: {
    latestVersion: "v0.0.0",
    updateTime: "",
    forceUpdate: false,
    downloadUrl: "",
    officialUrl: "",
    updateContent: "",
  },
  releases: {
    android: {
      latestVersion: "v0.0.0",
      updateTime: "",
      forceUpdate: false,
      downloadUrl: "",
      officialUrl: "https://pisamusic.partialy.cn",
      updateContent: "",
      platformLabel: "Android",
      fileSizeText: "",
      available: false,
    },
    desktop: {
      latestVersion: "v0.0.0",
      updateTime: "",
      forceUpdate: false,
      downloadUrl: "",
      officialUrl: "https://pisamusic.partialy.cn",
      updateContent: "PC ???????",
      platformLabel: "PC ?",
      fileSizeText: "",
      available: false,
    },
  },
  agreement: { title: "", content: "" },
  privacy: { title: "", content: "" },
  about: {
    appName: "PisaMusic",
    websiteLabel: "",
    websiteUrl: "",
    description: "",
    team: "",
    copyright: "",
  },
  discover: {
    url: "USE_LOCAL_FILE",
    updatedAt: 0,
  },
  encryption: {
    plaintextPaths: [],
  },
};

function boolFromDb(value: unknown): boolean {
  return Number(value) !== 0;
}

function boolToDb(value: boolean): number {
  return value ? 1 : 0;
}

function releaseFromUpdate(update: AppUpdate, platform: ReleasePlatform): ReleaseInfo {
  const defaults = DEFAULT_APP_CONFIG.releases[platform];
  return {
    ...update,
    platformLabel: defaults.platformLabel,
    fileSizeText: defaults.fileSizeText,
    available: Boolean(update.downloadUrl),
  };
}

function appUpdateFromRelease(release: ReleaseInfo): AppUpdate {
  return {
    latestVersion: release.latestVersion,
    updateTime: release.updateTime,
    forceUpdate: release.forceUpdate,
    downloadUrl: release.downloadUrl,
    officialUrl: release.officialUrl,
    updateContent: release.updateContent,
  };
}

function normalizeRelease(platform: ReleasePlatform, release?: Partial<ReleaseInfo>, fallbackUpdate?: AppUpdate): ReleaseInfo {
  const defaults = fallbackUpdate ? releaseFromUpdate(fallbackUpdate, platform) : DEFAULT_APP_CONFIG.releases[platform];
  const next = {
    ...defaults,
    ...(release ?? {}),
  };
  return {
    latestVersion: next.latestVersion ?? "",
    updateTime: next.updateTime ?? "",
    forceUpdate: Boolean(next.forceUpdate),
    downloadUrl: next.downloadUrl ?? "",
    officialUrl: next.officialUrl ?? "",
    updateContent: next.updateContent ?? "",
    platformLabel: next.platformLabel || DEFAULT_APP_CONFIG.releases[platform].platformLabel,
    fileSizeText: next.fileSizeText ?? "",
    available: Boolean(next.available) && Boolean(next.downloadUrl),
  };
}

function normalizeDesktopUpdaterConfig(input?: Partial<DesktopUpdaterConfig>): DesktopUpdaterConfig {
  const defaults = DEFAULT_APP_CONFIG.bootstrap.updater?.desktop ?? {
    enabled: true,
    feedBaseUrl: DEFAULT_DESKTOP_UPDATE_FEED,
    checkOnStartup: true,
    startupDelayMs: 15000,
  };
  const next = {
    ...defaults,
    ...(input ?? {}),
  };
  return {
    enabled: Boolean(next.enabled),
    feedBaseUrl: next.feedBaseUrl || DEFAULT_DESKTOP_UPDATE_FEED,
    checkOnStartup: Boolean(next.checkOnStartup),
    startupDelayMs: Number.isFinite(Number(next.startupDelayMs)) ? Math.max(0, Number(next.startupDelayMs)) : defaults.startupDelayMs,
  };
}

function normalizeEmailProviders(input?: EmailProviderConfig[]): EmailProviderConfig[] {
  const source = input?.length ? input : DEFAULT_EMAIL_PROVIDERS;
  const seen = new Set<string>();
  const providers: EmailProviderConfig[] = [];
  for (const item of source) {
    const code = item.code.trim();
    const name = item.name.trim();
    if (!code || !name || seen.has(code)) continue;
    seen.add(code);
    providers.push({ code, name });
  }
  return providers.length ? providers : DEFAULT_EMAIL_PROVIDERS;
}

function normalizeEmailConfig(input?: Partial<EmailConfig>): EmailConfig {
  const providers = normalizeEmailProviders(input?.providers);
  const provider = input?.provider && providers.some((item) => item.code === input.provider) ? input.provider : providers[0].code;
  return {
    serviceUrl: input?.serviceUrl || DEFAULT_EMAIL_SERVICE_URL,
    provider,
    providers,
  };
}

function parseEmailProviders(raw?: string | null): EmailProviderConfig[] {
  if (!raw) return DEFAULT_EMAIL_PROVIDERS;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_EMAIL_PROVIDERS;
    return normalizeEmailProviders(
      parsed
        .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item))
        .map((item) => ({ code: String(item.code ?? ""), name: String(item.name ?? "") })),
    );
  } catch {
    return DEFAULT_EMAIL_PROVIDERS;
  }
}

function runInTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

type FileRecordRow = {
  id: string;
  usage_type: string;
  platform: string;
  version: string;
  asset_type: string;
  provider: string;
  bucket: string;
  object_key: string;
  hash: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  download_url: string;
  status: string;
  referenced_by: string;
  created_at: number;
  deleted_at: number | null;
};

type FileRecordReferenceType = "history" | "current-release" | "active-desktop-update";

type FileRecordReference = {
  type: FileRecordReferenceType;
  id?: string;
  platform?: ReleasePlatform | "win32";
  version?: string;
  fileName?: string;
};

const DESKTOP_UPDATE_PLATFORM = "win32/x64";

function buildReleaseDownloadPath(id: string): string {
  return "/api/config/release-files/" + encodeURIComponent(id) + "/download";
}

function parseFileReferences(raw: string): FileRecordReference[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];
  try {
    const value = JSON.parse(text) as unknown;
    if (!Array.isArray(value)) return legacyFileReferences(text);
    return value
      .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
      .map((item) => ({
        type: item.type === "current-release" || item.type === "active-desktop-update" || item.type === "history" ? item.type : "history",
        id: typeof item.id === "string" ? item.id : undefined,
        platform: item.platform === "android" || item.platform === "desktop" || item.platform === "win32" ? item.platform : undefined,
        version: typeof item.version === "string" ? item.version : undefined,
        fileName: typeof item.fileName === "string" ? item.fileName : undefined,
      }));
  } catch {
    return legacyFileReferences(text);
  }
}

function legacyFileReferences(value: string): FileRecordReference[] {
  if (!value) return [];
  if (value === "active-desktop-update") return [{ type: "active-desktop-update", platform: "win32" }];
  return [{ type: "history", id: value }];
}

function fileReferenceKey(ref: FileRecordReference): string {
  return [ref.type, ref.id ?? "", ref.platform ?? "", ref.version ?? "", ref.fileName ?? ""].join("|");
}

function serializeFileReferences(refs: FileRecordReference[]): string {
  const unique = new Map<string, FileRecordReference>();
  for (const ref of refs) unique.set(fileReferenceKey(ref), ref);
  return JSON.stringify([...unique.values()]);
}

function fileReferenceLabel(ref: FileRecordReference): string {
  if (ref.type === "current-release") return "??" + (ref.platform === "desktop" ? "PC" : "Android") + "????";
  if (ref.type === "active-desktop-update") return "?? PC ????" + (ref.version ? " " + ref.version : "") + (ref.fileName ? " " + ref.fileName : "");
  return ref.id ? "???? " + ref.id : "????";
}

function hasFileReference(refs: FileRecordReference[], type: FileRecordReferenceType, predicate: (ref: FileRecordReference) => boolean = () => true): boolean {
  return refs.some((ref) => ref.type === type && predicate(ref));
}

function releasePlatformFromRecord(record: Pick<FileRecordInfo, "platform">): ReleasePlatform {
  return record.platform === "android" ? "android" : "desktop";
}

function isInstallerRecord(record: Pick<FileRecordInfo, "assetType">): boolean {
  return record.assetType === "installer";
}

function isDesktopUpdateRecord(record: Pick<FileRecordInfo, "platform" | "assetType" | "version">): boolean {
  return Boolean(record.version) && (record.platform === DESKTOP_UPDATE_PLATFORM || record.platform === "desktop") && (record.assetType === "latest-yml" || record.assetType === "installer" || record.assetType === "blockmap");
}

function canonicalDownloadUrlForRecord(record: Pick<FileRecordInfo, "id" | "assetType">): string {
  return isInstallerRecord(record) ? buildReleaseDownloadPath(record.id) : "";
}

function normalizeRecordPlatform(input: { usageType: FileRecordUsageType; platform: string; assetType: string; version: string }): string {
  if (input.assetType === "latest-yml" || input.assetType === "blockmap") return DESKTOP_UPDATE_PLATFORM;
  if (input.usageType === "desktop-update") return DESKTOP_UPDATE_PLATFORM;
  if (input.platform === "desktop" && input.version && input.assetType === "installer") return DESKTOP_UPDATE_PLATFORM;
  return input.platform;
}

function mapFileRecord(row?: FileRecordRow | null): FileRecordInfo | null {
  if (!row) return null;
  const refs = parseFileReferences(row.referenced_by);
  return {
    id: row.id,
    usageType: row.usage_type === "desktop-update" ? "desktop-update" : "release-package",
    platform: row.platform,
    version: row.version,
    assetType: row.asset_type,
    provider: "qiniu",
    bucket: row.bucket,
    objectKey: row.object_key,
    hash: row.hash,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size) || 0,
    downloadUrl: row.download_url,
    status: row.status === "deleted" ? "deleted" : "uploaded",
    referencedBy: refs.map(fileReferenceLabel),
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function releaseFileFromRecord(record?: FileRecordInfo | null): ReleaseFileInfo | null {
  if (!record || !isInstallerRecord(record)) return null;
  return {
    id: record.id,
    fileRecordId: record.id,
    historyId: null,
    platform: releasePlatformFromRecord(record),
    provider: "qiniu",
    bucket: record.bucket,
    objectKey: record.objectKey,
    hash: record.hash,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    downloadUrl: canonicalDownloadUrlForRecord(record),
    status: record.status,
    createdAt: record.createdAt,
    deletedAt: record.deletedAt,
  };
}

function desktopAssetFromRecord(record?: FileRecordInfo | null): DesktopUpdateAssetInfo | null {
  if (!record || !isDesktopUpdateRecord(record)) return null;
  const fileType = record.assetType === "latest-yml" || record.assetType === "blockmap" ? record.assetType : "installer";
  return {
    id: record.id,
    fileRecordId: record.id,
    version: record.version,
    platform: "win32",
    arch: "x64",
    fileType,
    provider: "qiniu",
    bucket: record.bucket,
    objectKey: record.objectKey,
    hash: record.hash,
    fileName: record.fileName,
    mimeType: record.mimeType,
    fileSize: record.fileSize,
    status: record.status,
    active: record.referencedBy.some((label) => label.startsWith("?? PC ????")),
    createdAt: record.createdAt,
    deletedAt: record.deletedAt,
    releaseFile: fileType === "installer" ? releaseFileFromRecord(record) : undefined,
  };
}

function readFileRecordByIdWithDb(db: DatabaseSync, id: string): FileRecordInfo | null {
  const row = db.prepare("SELECT * FROM file_records WHERE id = ?").get(id) as FileRecordRow | undefined;
  return mapFileRecord(row);
}

function readFileRecordRowById(db: DatabaseSync, id: string): FileRecordRow | null {
  return (db.prepare("SELECT * FROM file_records WHERE id = ?").get(id) as FileRecordRow | undefined) ?? null;
}

function readFileRecordByProviderKey(provider: "qiniu", bucket: string, objectKey: string): FileRecordInfo | null {
  const row = getAppDb()
    .prepare("SELECT * FROM file_records WHERE provider = ? AND bucket = ? AND object_key = ?")
    .get(provider, bucket, objectKey) as FileRecordRow | undefined;
  return mapFileRecord(row);
}

function updateFileReferences(db: DatabaseSync, id: string, updater: (refs: FileRecordReference[]) => FileRecordReference[]): void {
  const row = readFileRecordRowById(db, id);
  if (!row) throw new Error("???????");
  const refs = updater(parseFileReferences(row.referenced_by));
  db.prepare("UPDATE file_records SET referenced_by = ? WHERE id = ?").run(serializeFileReferences(refs), id);
}

function addFileReference(db: DatabaseSync, id: string, ref: FileRecordReference): void {
  updateFileReferences(db, id, (refs) => [...refs.filter((item) => fileReferenceKey(item) !== fileReferenceKey(ref)), ref]);
}

function removeFileReferences(db: DatabaseSync, predicate: (ref: FileRecordReference, row: FileRecordRow) => boolean): void {
  const rows = db.prepare("SELECT * FROM file_records WHERE referenced_by <> ''").all() as FileRecordRow[];
  for (const row of rows) {
    const refs = parseFileReferences(row.referenced_by);
    const next = refs.filter((ref) => !predicate(ref, row));
    if (next.length !== refs.length) {
      db.prepare("UPDATE file_records SET referenced_by = ? WHERE id = ?").run(serializeFileReferences(next), row.id);
    }
  }
}

function downloadUrlBelongsToReleaseFile(downloadUrl: string, file: ReleaseFileInfo): boolean {
  return downloadUrl === file.downloadUrl || downloadUrl.includes(buildReleaseDownloadPath(file.id));
}

export function replaceAppConfig(config: AppConfig) {
  const db = getAppDb();
  runInTransaction(db, () => {
    const now = Date.now();
    db.prepare(
      `INSERT INTO app_settings (
        id, app_available, unavailable_reason, bootstrap_version, bootstrap_updated_at,
        gateway_secret, gateway_as, email_service_url, email_provider, email_providers_json, updater_enabled, updater_feed_base_url,
        updater_check_startup, updater_startup_delay, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        app_available = excluded.app_available,
        unavailable_reason = excluded.unavailable_reason,
        bootstrap_version = excluded.bootstrap_version,
        bootstrap_updated_at = excluded.bootstrap_updated_at,
        gateway_secret = excluded.gateway_secret,
        gateway_as = excluded.gateway_as,
        email_service_url = excluded.email_service_url,
        email_provider = excluded.email_provider,
        email_providers_json = excluded.email_providers_json,
        updater_enabled = excluded.updater_enabled,
        updater_feed_base_url = excluded.updater_feed_base_url,
        updater_check_startup = excluded.updater_check_startup,
        updater_startup_delay = excluded.updater_startup_delay,
        updated_at = excluded.updated_at`,
    ).run(
      boolToDb(config.availability.appAvailable),
      config.availability.unavailableReason,
      config.bootstrap.version,
      config.bootstrap.updatedAt,
      config.bootstrap.gatewaySign?.secret ?? DEFAULT_APP_CONFIG.bootstrap.gatewaySign?.secret ?? "",
      config.bootstrap.gatewaySign?.as ?? DEFAULT_APP_CONFIG.bootstrap.gatewaySign?.as ?? "",
      normalizeEmailConfig(config.email).serviceUrl,
      normalizeEmailConfig(config.email).provider,
      JSON.stringify(normalizeEmailConfig(config.email).providers),
      boolToDb(normalizeDesktopUpdaterConfig(config.bootstrap.updater?.desktop).enabled),
      normalizeDesktopUpdaterConfig(config.bootstrap.updater?.desktop).feedBaseUrl,
      boolToDb(normalizeDesktopUpdaterConfig(config.bootstrap.updater?.desktop).checkOnStartup),
      normalizeDesktopUpdaterConfig(config.bootstrap.updater?.desktop).startupDelayMs,
      now,
      now,
    );

    replaceEndpoints(db, config.bootstrap.endpoints);
    replaceContentPage(db, "agreement", config.agreement);
    replaceContentPage(db, "privacy", config.privacy);
    replaceAbout(db, config.about);
    replaceCurrentUpdate(db, config.update);
    replaceReleases(db, {
      android: normalizeRelease("android", config.releases?.android, config.update),
      desktop: normalizeRelease("desktop", config.releases?.desktop),
    });
    replaceDiscover(db, config.discover ?? DEFAULT_APP_CONFIG.discover);
    replacePlaintextPathsWithDb(db, config.encryption?.plaintextPaths ?? []);
  });
}

function replaceEndpoints(db: DatabaseSync, endpoints: Record<string, string>) {
  db.prepare("DELETE FROM bootstrap_endpoints").run();
  const insert = db.prepare("INSERT INTO bootstrap_endpoints (key, value, sort_order) VALUES (?, ?, ?)");
  Object.entries(endpoints).forEach(([key, value], index) => insert.run(key, value, index));
}

function replaceContentPage(db: DatabaseSync, code: string, page: TextContentConfig) {
  db.prepare(
    `INSERT INTO content_pages (code, title, content, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       updated_at = excluded.updated_at`,
  ).run(code, page.title, page.content, Date.now());
}

function replaceAbout(db: DatabaseSync, about: AboutConfig) {
  db.prepare(
    `INSERT INTO about_config (
      id, app_name, website_label, website_url, description, team, copyright, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      app_name = excluded.app_name,
      website_label = excluded.website_label,
      website_url = excluded.website_url,
      description = excluded.description,
      team = excluded.team,
      copyright = excluded.copyright,
      updated_at = excluded.updated_at`,
  ).run(
    about.appName,
    about.websiteLabel,
    about.websiteUrl,
    about.description,
    about.team,
    about.copyright,
    Date.now(),
  );
}

function replaceCurrentUpdate(db: DatabaseSync, update: AppUpdate) {
  db.prepare(
    `INSERT INTO current_update (
      id, latest_version, update_time, force_update, download_url, official_url, update_content, updated_at
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      latest_version = excluded.latest_version,
      update_time = excluded.update_time,
      force_update = excluded.force_update,
      download_url = excluded.download_url,
      official_url = excluded.official_url,
      update_content = excluded.update_content,
      updated_at = excluded.updated_at`,
  ).run(
    update.latestVersion,
    update.updateTime,
    boolToDb(update.forceUpdate),
    update.downloadUrl,
    update.officialUrl,
    update.updateContent,
    Date.now(),
  );
}

function replaceReleases(db: DatabaseSync, releases: ReleaseConfig) {
  for (const platform of RELEASE_PLATFORMS) {
    const release = normalizeRelease(platform, releases[platform], platform === "android" ? appUpdateFromRelease(releases.android) : undefined);
    db.prepare(
      `INSERT INTO release_info (
        platform, latest_version, update_time, force_update, download_url, official_url,
        update_content, platform_label, file_size_text, available, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(platform) DO UPDATE SET
        latest_version = excluded.latest_version,
        update_time = excluded.update_time,
        force_update = excluded.force_update,
        download_url = excluded.download_url,
        official_url = excluded.official_url,
        update_content = excluded.update_content,
        platform_label = excluded.platform_label,
        file_size_text = excluded.file_size_text,
        available = excluded.available,
        updated_at = excluded.updated_at`,
    ).run(
      platform,
      release.latestVersion,
      release.updateTime,
      boolToDb(release.forceUpdate),
      release.downloadUrl,
      release.officialUrl,
      release.updateContent,
      release.platformLabel,
      release.fileSizeText,
      boolToDb(release.available),
      Date.now(),
    );
  }
}

function replaceDiscover(db: DatabaseSync, discover: DiscoverConfig) {
  db.prepare(
    `INSERT INTO discover_config (id, url, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       url = excluded.url,
       updated_at = excluded.updated_at`,
  ).run(discover.url, discover.updatedAt);
}

export function readAppConfig(): AppConfig {
  const db = getAppDb();
  const settings = db.prepare("SELECT * FROM app_settings WHERE id = 1").get() as
    | {
        app_available: number;
        unavailable_reason: string;
        bootstrap_version: string;
        bootstrap_updated_at: number;
        gateway_secret: string;
        gateway_as: string;
        email_service_url: string;
        email_provider: string;
        email_providers_json: string;
        updater_enabled: number;
        updater_feed_base_url: string;
        updater_check_startup: number;
        updater_startup_delay: number;
      }
    | undefined;
  const endpoints = db
    .prepare("SELECT key, value FROM bootstrap_endpoints ORDER BY sort_order ASC, key ASC")
    .all() as { key: string; value: string }[];
  const pages = db.prepare("SELECT code, title, content FROM content_pages").all() as {
    code: string;
    title: string;
    content: string;
  }[];
  const about = db.prepare("SELECT * FROM about_config WHERE id = 1").get() as
    | {
        app_name: string;
        website_label: string;
        website_url: string;
        description: string;
        team: string;
        copyright: string;
      }
    | undefined;
  const update = db.prepare("SELECT * FROM current_update WHERE id = 1").get() as
    | {
        latest_version: string;
        update_time: string;
        force_update: number;
        download_url: string;
        official_url: string;
        update_content: string;
      }
    | undefined;
  const releaseRows = db.prepare("SELECT * FROM release_info").all() as {
    platform: ReleasePlatform;
    latest_version: string;
    update_time: string;
    force_update: number;
    download_url: string;
    official_url: string;
    update_content: string;
    platform_label: string;
    file_size_text: string;
    available: number;
  }[];
  const discover = db.prepare("SELECT * FROM discover_config WHERE id = 1").get() as
    | {
        url: string;
        updated_at: number;
      }
    | undefined;
  const pageByCode = new Map(pages.map((page) => [page.code, page]));
  const currentUpdate: AppUpdate = update
    ? {
        latestVersion: update.latest_version,
        updateTime: update.update_time,
        forceUpdate: boolFromDb(update.force_update),
        downloadUrl: update.download_url,
        officialUrl: update.official_url,
        updateContent: update.update_content,
      }
    : DEFAULT_APP_CONFIG.update;
  const releases: ReleaseConfig = {
    android: normalizeRelease("android", undefined, currentUpdate),
    desktop: normalizeRelease("desktop"),
  };
  for (const row of releaseRows) {
    if (row.platform !== "android" && row.platform !== "desktop") continue;
    releases[row.platform] = normalizeRelease(row.platform, {
      latestVersion: row.latest_version,
      updateTime: row.update_time,
      forceUpdate: boolFromDb(row.force_update),
      downloadUrl: row.download_url,
      officialUrl: row.official_url,
      updateContent: row.update_content,
      platformLabel: row.platform_label,
      fileSizeText: row.file_size_text,
      available: boolFromDb(row.available),
    });
  }

  return {
    availability: {
      appAvailable: settings ? boolFromDb(settings.app_available) : DEFAULT_APP_CONFIG.availability.appAvailable,
      unavailableReason: settings?.unavailable_reason ?? DEFAULT_APP_CONFIG.availability.unavailableReason,
    },
    email: normalizeEmailConfig({
      serviceUrl: settings?.email_service_url ?? DEFAULT_APP_CONFIG.email.serviceUrl,
      provider: settings?.email_provider ?? DEFAULT_APP_CONFIG.email.provider,
      providers: parseEmailProviders(settings?.email_providers_json),
    }),
    bootstrap: {
      version: settings?.bootstrap_version ?? DEFAULT_APP_CONFIG.bootstrap.version,
      updatedAt: settings?.bootstrap_updated_at ?? DEFAULT_APP_CONFIG.bootstrap.updatedAt,
      endpoints: Object.fromEntries(endpoints.map((row) => [row.key, row.value])),
      gatewaySign: {
        secret: settings?.gateway_secret ?? DEFAULT_APP_CONFIG.bootstrap.gatewaySign?.secret ?? "",
        as: settings?.gateway_as ?? DEFAULT_APP_CONFIG.bootstrap.gatewaySign?.as ?? "",
      },
      updater: {
        desktop: normalizeDesktopUpdaterConfig({
          enabled: settings ? boolFromDb(settings.updater_enabled) : undefined,
          feedBaseUrl: settings?.updater_feed_base_url,
          checkOnStartup: settings ? boolFromDb(settings.updater_check_startup) : undefined,
          startupDelayMs: settings?.updater_startup_delay,
        }),
      },
    },
    update: currentUpdate,
    releases,
    agreement: pageByCode.get("agreement") ?? DEFAULT_APP_CONFIG.agreement,
    privacy: pageByCode.get("privacy") ?? DEFAULT_APP_CONFIG.privacy,
    about: about
      ? {
          appName: about.app_name,
          websiteLabel: about.website_label,
          websiteUrl: about.website_url,
          description: about.description,
          team: about.team,
          copyright: about.copyright,
        }
      : DEFAULT_APP_CONFIG.about,
    discover: discover
      ? {
          url: discover.url,
          updatedAt: discover.updated_at,
        }
      : DEFAULT_APP_CONFIG.discover,
    encryption: {
      plaintextPaths: readPlaintextPaths(),
    },
  };
}

export function shouldBlock(config: AppConfig): { blocked: boolean; reason: string } {
  if (config.availability.appAvailable) return { blocked: false, reason: "" };
  return {
    blocked: true,
    reason: config.availability.unavailableReason || "??????",
  };
}

export function saveAppConfigSections(sections: EditableAppConfigSections): AppConfig {
  const current = readAppConfig();
  const next: AppConfig = {
    ...current,
    availability: sections.availability ?? current.availability,
    email: normalizeEmailConfig(sections.email ?? current.email),
    bootstrap: {
      ...current.bootstrap,
      ...(sections.bootstrap ?? {}),
      endpoints: sections.bootstrap?.endpoints ?? current.bootstrap.endpoints,
      gatewaySign: sections.bootstrap?.gatewaySign ?? current.bootstrap.gatewaySign,
      updater: {
        desktop: normalizeDesktopUpdaterConfig(sections.bootstrap?.updater?.desktop ?? current.bootstrap.updater?.desktop),
      },
    },
    update: sections.releases?.android ? appUpdateFromRelease(normalizeRelease("android", sections.releases.android, current.update)) : current.update,
    releases: {
      android: normalizeRelease("android", sections.releases?.android ?? current.releases.android, current.update),
      desktop: normalizeRelease("desktop", sections.releases?.desktop ?? current.releases.desktop),
    },
    agreement: sections.agreement ?? current.agreement,
    privacy: sections.privacy ?? current.privacy,
    about: sections.about ?? current.about,
    discover: sections.discover ?? current.discover,
  };
  replaceAppConfig(next);
  return readAppConfig();
}

type CreateFileRecordInput = Omit<FileRecordInfo, "status" | "createdAt" | "deletedAt" | "referencedBy"> & {
  referencedBy?: string[];
};

export function readReleaseFileById(id: string): ReleaseFileInfo | null {
  const record = readFileRecordByIdWithDb(getAppDb(), id);
  return releaseFileFromRecord(record);
}

export function createFileRecord(input: CreateFileRecordInput): FileRecordInfo {
  const db = getAppDb();
  const now = Date.now();
  const platform = normalizeRecordPlatform(input);
  const downloadUrl = input.assetType === "installer" ? buildReleaseDownloadPath(input.id) : "";
  db.prepare(
    `INSERT INTO file_records (
      id, usage_type, platform, version, asset_type, provider, bucket, object_key,
      hash, file_name, mime_type, file_size, download_url, status, referenced_by, created_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, ?, NULL)
    ON CONFLICT(provider, bucket, object_key) DO UPDATE SET
      usage_type = CASE
        WHEN excluded.usage_type = 'desktop-update' OR file_records.usage_type = 'desktop-update' THEN 'desktop-update'
        ELSE excluded.usage_type
      END,
      platform = CASE WHEN excluded.platform <> '' THEN excluded.platform ELSE file_records.platform END,
      version = CASE WHEN excluded.version <> '' THEN excluded.version ELSE file_records.version END,
      asset_type = CASE WHEN excluded.asset_type <> '' THEN excluded.asset_type ELSE file_records.asset_type END,
      hash = excluded.hash,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      file_size = excluded.file_size,
      download_url = CASE WHEN excluded.asset_type = 'installer' THEN file_records.download_url ELSE '' END,
      status = 'uploaded',
      deleted_at = NULL`,
  ).run(
    input.id,
    input.usageType,
    platform,
    input.version,
    input.assetType,
    input.provider,
    input.bucket,
    input.objectKey,
    input.hash,
    input.fileName,
    input.mimeType,
    input.fileSize,
    downloadUrl,
    serializeFileReferences([]),
    now,
  );
  const saved = readFileRecordByProviderKey(input.provider, input.bucket, input.objectKey);
  if (!saved) throw new Error("文件记录保存失败");
  const canonicalDownloadUrl = canonicalDownloadUrlForRecord(saved);
  if (saved.downloadUrl !== canonicalDownloadUrl) {
    db.prepare("UPDATE file_records SET download_url = ? WHERE id = ?").run(canonicalDownloadUrl, saved.id);
    return readFileRecordByIdWithDb(db, saved.id) ?? saved;
  }
  return saved;
}

export function createReleaseUploadRecord(input: {
  id: string;
  platform: ReleasePlatform;
  version?: string;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): ReleaseFileInfo {
  const record = createFileRecord({
    id: input.id,
    usageType: "release-package",
    platform: input.platform,
    version: input.version ?? "",
    assetType: "installer",
    provider: input.provider,
    bucket: input.bucket,
    objectKey: input.objectKey,
    hash: input.hash,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    downloadUrl: "",
  });
  const releaseFile = releaseFileFromRecord(record);
  if (!releaseFile) throw new Error("安装包文件保存失败");
  const desktopUpdateAsset = desktopAssetFromRecord(record);
  return desktopUpdateAsset ? { ...releaseFile, desktopUpdateAsset } : releaseFile;
}

export function createDesktopUpdateUploadRecord(input: {
  id: string;
  version: string;
  platform: "win32";
  arch: "x64";
  fileType: DesktopUpdateAssetType;
  provider: "qiniu";
  bucket: string;
  objectKey: string;
  hash: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): DesktopUpdateAssetInfo {
  const record = createFileRecord({
    id: input.id,
    usageType: "desktop-update",
    platform: `${input.platform}/${input.arch}`,
    version: input.version,
    assetType: input.fileType,
    provider: input.provider,
    bucket: input.bucket,
    objectKey: input.objectKey,
    hash: input.hash,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    downloadUrl: "",
  });
  const asset = desktopAssetFromRecord(record);
  if (!asset) throw new Error("自动更新文件保存失败");
  return asset;
}

export function readDesktopUpdateAssets(version: string, platform = "win32", arch = "x64"): DesktopUpdateAssetInfo[] {
  const db = getAppDb();
  const rows = db
    .prepare(
      `SELECT * FROM file_records
       WHERE version = ?
         AND status = 'uploaded'
         AND asset_type IN ('latest-yml', 'installer', 'blockmap')
         AND (platform = ? OR (asset_type = 'installer' AND platform = 'desktop'))
       ORDER BY created_at DESC`,
    )
    .all(version, `${platform}/${arch}`) as FileRecordRow[];
  return rows.map((row) => desktopAssetFromRecord(mapFileRecord(row))).filter((asset): asset is DesktopUpdateAssetInfo => Boolean(asset));
}

export function activateDesktopUpdateVersion(version: string, platform = "win32", arch = "x64"): DesktopUpdateAssetInfo[] {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const assets = readDesktopUpdateAssets(version, platform, arch);
    const hasLatest = assets.some((asset) => asset.fileType === "latest-yml" && asset.fileName === "latest.yml");
    const hasInstaller = assets.some((asset) => asset.fileType === "installer");
    if (!hasLatest) throw new Error("缺少 latest.yml，请先上传 electron-builder 生成的 latest.yml");
    if (!hasInstaller) throw new Error("缺少安装包 EXE，请先上传与 latest.yml 对应的 Windows 安装包");
    removeFileReferences(db, (ref, row) => ref.type === "active-desktop-update" && (row.platform === `${platform}/${arch}` || row.platform === "desktop"));
    for (const asset of assets) {
      addFileReference(db, asset.id, {
        type: "active-desktop-update",
        platform: "win32",
        version,
        fileName: asset.fileName,
      });
    }
    return readDesktopUpdateAssets(version, platform, arch).map((asset) => ({ ...asset, active: true }));
  });
}

export function readActiveDesktopUpdateAsset(fileName: string, platform = "win32", arch = "x64"): DesktopUpdateAssetInfo | null {
  const db = getAppDb();
  const rows = db
    .prepare(
      `SELECT * FROM file_records
       WHERE status = 'uploaded'
         AND file_name = ?
         AND asset_type IN ('latest-yml', 'installer', 'blockmap')
         AND (platform = ? OR (asset_type = 'installer' AND platform = 'desktop'))
         AND referenced_by LIKE '%active-desktop-update%'
       ORDER BY created_at DESC`,
    )
    .all(fileName, `${platform}/${arch}`) as FileRecordRow[];
  for (const row of rows) {
    const refs = parseFileReferences(row.referenced_by);
    if (hasFileReference(refs, "active-desktop-update", (ref) => !ref.platform || ref.platform === "win32")) {
      return desktopAssetFromRecord(mapFileRecord(row));
    }
  }
  return null;
}

export function readFileRecordById(id: string): FileRecordInfo | null {
  return readFileRecordByIdWithDb(getAppDb(), id);
}

export function listFileRecords(query: FileRecordListQuery = {}): FileRecordListResult {
  const db = getAppDb();
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const offset = Math.max(0, Number(query.offset) || 0);
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (query.status && query.status !== "all") {
    where.push("status = ?");
    params.push(query.status);
  }
  if (query.usageType && query.usageType !== "all") {
    where.push("usage_type = ?");
    params.push(query.usageType);
  }
  if (query.platform?.trim()) {
    where.push("platform LIKE ?");
    params.push(`%${query.platform.trim()}%`);
  }
  if (query.version?.trim()) {
    where.push("version = ?");
    params.push(query.version.trim());
  }
  if (query.keyword?.trim()) {
    where.push("(file_name LIKE ? OR object_key LIKE ?)");
    const keyword = `%${query.keyword.trim()}%`;
    params.push(keyword, keyword);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = db.prepare(`SELECT COUNT(*) AS total FROM file_records ${whereSql}`).get(...params) as { total: number };
  const rows = db
    .prepare(
      `SELECT * FROM file_records ${whereSql}
       ORDER BY created_at DESC, rowid DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset) as FileRecordRow[];
  return {
    items: rows.map((row) => mapFileRecord(row)).filter((item): item is FileRecordInfo => Boolean(item)),
    total: Number(totalRow.total) || 0,
    offset,
    limit,
  };
}

export function findFileRecordDeleteBlockers(id: string): string[] {
  const db = getAppDb();
  const row = readFileRecordRowById(db, id);
  if (!row || row.status === "deleted") return [];
  const refs = parseFileReferences(row.referenced_by);
  return Array.from(
    new Set(
      refs
        .filter((ref) => ref.type === "current-release" || ref.type === "active-desktop-update")
        .map(fileReferenceLabel),
    ),
  );
}

export function markFileRecordDeleted(id: string): FileRecordInfo {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const file = readFileRecordByIdWithDb(db, id);
    if (!file) throw new Error("文件记录不存在");
    const blockers = findFileRecordDeleteBlockers(id);
    if (blockers.length) throw new Error(`文件正在被引用，不能删除：${blockers.join("、")}`);
    const now = Date.now();
    db.prepare("UPDATE file_records SET status = 'deleted', referenced_by = ?, deleted_at = ? WHERE id = ?").run(serializeFileReferences([]), now, id);
    const deleted = readFileRecordByIdWithDb(db, id);
    if (!deleted) throw new Error("文件状态更新失败");
    return deleted;
  });
}

export function readReleaseFileForHistory(historyId: string): ReleaseFileInfo | null {
  const db = getAppDb();
  const row = db
    .prepare(
      `SELECT f.*
       FROM update_history h
       JOIN file_records f ON f.id = h.release_file_id
       WHERE h.id = ?`,
    )
    .get(historyId) as FileRecordRow | undefined;
  const releaseFile = releaseFileFromRecord(mapFileRecord(row));
  return releaseFile ? { ...releaseFile, historyId } : null;
}

export function markReleaseFileDeletedForHistory(historyId: string): ReleaseFileInfo {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const file = readReleaseFileForHistory(historyId);
    if (!file) throw new Error("该发布记录没有可删除的七牛安装包");
    if (file.provider !== "qiniu") throw new Error("该安装包不是七牛上传文件");
    const blockers = findFileRecordDeleteBlockers(file.id);
    if (blockers.length) throw new Error(`安装包正在被引用，不能删除：${blockers.join("、")}`);

    const now = Date.now();
    db.prepare("UPDATE file_records SET status = 'deleted', referenced_by = ?, deleted_at = ? WHERE id = ?").run(serializeFileReferences([]), now, file.id);
    const deleted = readReleaseFileById(file.id);
    if (!deleted) throw new Error("安装包文件状态更新失败");
    return { ...deleted, historyId };
  });
}

function findDesktopInstallerForVersion(version: string): ReleaseFileInfo | null {
  const asset = readDesktopUpdateAssets(version).find((item) => item.fileType === "installer");
  return asset?.releaseFile ?? null;
}

export function publishUpdate(
  update: AppUpdate,
  historyId: string,
  platform: ReleasePlatform = "android",
  releaseFileId?: string | null,
): UpdateHistoryItem {
  const db = getAppDb();
  const current = readAppConfig();
  const initialRelease = normalizeRelease(platform, update, platform === "android" ? update : undefined);
  const releaseFile = releaseFileId
    ? readReleaseFileById(releaseFileId)
    : platform === "desktop" && initialRelease.available
      ? findDesktopInstallerForVersion(initialRelease.latestVersion)
      : null;
  if (releaseFileId && !releaseFile) throw new Error("????????");
  if (releaseFile && releaseFile.status !== "uploaded") throw new Error("???????????????");
  if (releaseFile && releaseFile.platform !== platform) throw new Error("???????????????");
  const release = releaseFile
    ? normalizeRelease(platform, { ...update, downloadUrl: releaseFile.downloadUrl }, platform === "android" ? { ...update, downloadUrl: releaseFile.downloadUrl } : undefined)
    : initialRelease;
  const item: UpdateHistoryItem = {
    id: historyId,
    platform,
    version: release.latestVersion,
    updateTime: release.updateTime,
    forceUpdate: release.forceUpdate,
    downloadUrl: release.downloadUrl,
    officialUrl: release.officialUrl,
    updateContent: release.updateContent,
    releaseFileId: releaseFile?.id ?? null,
    releaseFile: releaseFile ? { ...releaseFile, historyId } : null,
  };
  runInTransaction(db, () => {
    if (platform === "android") {
      replaceCurrentUpdate(db, appUpdateFromRelease(release));
    }
    replaceReleases(db, {
      android: platform === "android" ? release : current.releases.android,
      desktop: platform === "desktop" ? release : current.releases.desktop,
    });
    insertUpdateHistory(db, item);
    removeFileReferences(db, (ref) => ref.type === "current-release" && ref.platform === platform);
    if (releaseFile) {
      addFileReference(db, releaseFile.id, { type: "history", id: historyId, platform, version: release.latestVersion });
      addFileReference(db, releaseFile.id, { type: "current-release", platform, version: release.latestVersion });
    }
  });
  return item;
}

function releaseMatchesHistory(release: ReleaseInfo, item: UpdateHistoryItem): boolean {
  return (
    release.latestVersion === item.version &&
    release.updateTime === item.updateTime &&
    release.forceUpdate === item.forceUpdate &&
    release.downloadUrl === item.downloadUrl &&
    release.officialUrl === item.officialUrl &&
    release.updateContent === item.updateContent
  );
}

export function updatePublishedUpdate(
  historyId: string,
  update: AppUpdate,
  platform: ReleasePlatform = "android",
  releaseFileId?: string | null,
): UpdateHistoryItem {
  const db = getAppDb();
  const current = readAppConfig();
  const existing = readUpdateHistory().find((item) => item.id === historyId);
  if (!existing) throw new Error("发布记录不存在");
  if (existing.platform !== platform) throw new Error("发布记录平台不能修改");

  const releaseFile = releaseFileId ? readReleaseFileById(releaseFileId) : null;
  if (releaseFileId && !releaseFile) throw new Error("安装包文件不存在");
  if (releaseFile && releaseFile.status !== "uploaded") throw new Error("安装包文件已删除");
  if (releaseFile && releaseFile.platform !== platform) throw new Error("安装包文件平台不匹配");

  const initialRelease = normalizeRelease(platform, update, platform === "android" ? update : undefined);
  const release = releaseFile
    ? normalizeRelease(platform, { ...update, downloadUrl: releaseFile.downloadUrl }, platform === "android" ? { ...update, downloadUrl: releaseFile.downloadUrl } : undefined)
    : initialRelease;
  const shouldSyncCurrent = releaseMatchesHistory(current.releases[platform], existing);
  const currentRelease = shouldSyncCurrent && !release.fileSizeText
    ? { ...release, fileSizeText: current.releases[platform].fileSizeText }
    : release;

  runInTransaction(db, () => {
    db.prepare(
      `UPDATE update_history
       SET version = ?, update_time = ?, force_update = ?, download_url = ?, official_url = ?, update_content = ?, release_file_id = ?
       WHERE id = ?`,
    ).run(
      release.latestVersion,
      release.updateTime,
      boolToDb(release.forceUpdate),
      release.downloadUrl,
      release.officialUrl,
      release.updateContent,
      releaseFile?.id ?? null,
      historyId,
    );

    removeFileReferences(db, (ref) => ref.type === "history" && ref.id === historyId);
    if (releaseFile) {
      addFileReference(db, releaseFile.id, { type: "history", id: historyId, platform, version: release.latestVersion });
    }

    if (shouldSyncCurrent) {
      if (platform === "android") {
        replaceCurrentUpdate(db, appUpdateFromRelease(currentRelease));
      }
      replaceReleases(db, {
        android: platform === "android" ? currentRelease : current.releases.android,
        desktop: platform === "desktop" ? currentRelease : current.releases.desktop,
      });
      removeFileReferences(db, (ref) => ref.type === "current-release" && ref.platform === platform);
      if (releaseFile) {
        addFileReference(db, releaseFile.id, { type: "current-release", platform, version: release.latestVersion });
      }
    }
  });

  const updated = readUpdateHistory().find((item) => item.id === historyId);
  if (!updated) throw new Error("发布记录更新失败");
  return updated;
}

export function insertUpdateHistory(db: DatabaseSync, item: UpdateHistoryItem, createdAt = Date.now()) {
  db.prepare(
    `INSERT OR IGNORE INTO update_history (
      id, platform, version, update_time, force_update, download_url, official_url, update_content, release_file_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    item.id,
    item.platform,
    item.version,
    item.updateTime,
    boolToDb(item.forceUpdate),
    item.downloadUrl,
    item.officialUrl,
    item.updateContent,
    item.releaseFileId ?? null,
    createdAt,
  );
}

export function readUpdateHistory(): UpdateHistoryItem[] {
  const db = getAppDb();
  const rows = db
    .prepare(
      `SELECT h.*, f.id AS file_id, f.usage_type, f.platform AS file_platform, f.version AS file_version,
        f.asset_type, f.provider, f.bucket, f.object_key, f.hash, f.file_name, f.mime_type,
        f.file_size, f.download_url AS file_download_url, f.status, f.referenced_by, f.created_at AS file_created_at,
        f.deleted_at AS file_deleted_at
       FROM update_history h
       LEFT JOIN file_records f ON f.id = h.release_file_id
       ORDER BY h.created_at ASC, h.rowid ASC`,
    )
    .all() as Array<{
      id: string;
      platform?: ReleasePlatform;
      version: string;
      update_time: string;
      force_update: number;
      download_url: string;
      official_url: string;
      update_content: string;
      release_file_id: string | null;
      file_id: string | null;
      usage_type: string | null;
      file_platform: string | null;
      file_version: string | null;
      asset_type: string | null;
      provider: string | null;
      bucket: string | null;
      object_key: string | null;
      hash: string | null;
      file_name: string | null;
      mime_type: string | null;
      file_size: number | null;
      file_download_url: string | null;
      status: string | null;
      referenced_by: string | null;
      file_created_at: number | null;
      file_deleted_at: number | null;
    }>;
  return rows.map((row) => {
    const releaseFile = row.file_id
      ? releaseFileFromRecord(mapFileRecord({
          id: row.file_id,
          usage_type: row.usage_type ?? "release-package",
          platform: row.file_platform ?? "desktop",
          version: row.file_version ?? "",
          asset_type: row.asset_type ?? "installer",
          provider: row.provider ?? "qiniu",
          bucket: row.bucket ?? "",
          object_key: row.object_key ?? "",
          hash: row.hash ?? "",
          file_name: row.file_name ?? "",
          mime_type: row.mime_type ?? "",
          file_size: row.file_size ?? 0,
          download_url: row.file_download_url ?? "",
          status: row.status ?? "uploaded",
          referenced_by: row.referenced_by ?? "",
          created_at: row.file_created_at ?? 0,
          deleted_at: row.file_deleted_at,
        }))
      : null;
    return {
      id: row.id,
      platform: row.platform === "desktop" ? "desktop" : "android",
      version: row.version,
      updateTime: row.update_time,
      forceUpdate: boolFromDb(row.force_update),
      downloadUrl: releaseFile?.downloadUrl ?? row.download_url,
      officialUrl: row.official_url,
      updateContent: row.update_content,
      releaseFileId: row.release_file_id,
      releaseFile: releaseFile ? { ...releaseFile, historyId: row.id } : null,
    };
  });
}
export function readAnnouncements(): Announcement[] {
  const db = getAppDb();
  const rows = db.prepare("SELECT * FROM announcements ORDER BY sort_order ASC, rowid ASC").all() as {
    id: string;
    content: string;
    time: string;
    publisher: string;
    confirm_text: string;
    show_every_time: number;
    show_goto_button: number;
    goto_url: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    time: row.time,
    publisher: row.publisher,
    confirmText: row.confirm_text,
    showEveryTime: boolFromDb(row.show_every_time),
    showGotoButton: boolFromDb(row.show_goto_button),
    gotoUrl: row.goto_url ?? "",
  }));
}

export function saveAnnouncement(announcement: Announcement): Announcement {
  const db = getAppDb();
  const existing = db.prepare("SELECT sort_order FROM announcements WHERE id = ?").get(announcement.id) as
    | { sort_order: number }
    | undefined;
  const maxRow = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM announcements").get() as {
    max_order: number;
  };
  const sortOrder = existing?.sort_order ?? maxRow.max_order + 1;
  db.prepare(
    `INSERT INTO announcements (
      id, content, time, publisher, confirm_text, show_every_time, show_goto_button, goto_url, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      content = excluded.content,
      time = excluded.time,
      publisher = excluded.publisher,
      confirm_text = excluded.confirm_text,
      show_every_time = excluded.show_every_time,
      show_goto_button = excluded.show_goto_button,
      goto_url = excluded.goto_url`,
  ).run(
    announcement.id,
    announcement.content,
    announcement.time,
    announcement.publisher,
    announcement.confirmText,
    boolToDb(Boolean(announcement.showEveryTime)),
    boolToDb(announcement.showGotoButton),
    announcement.gotoUrl ?? "",
    sortOrder,
  );
  return announcement;
}

export function deleteAnnouncement(id: string): boolean {
  const db = getAppDb();
  const result = db.prepare("DELETE FROM announcements WHERE id = ?").run(id);
  return result.changes > 0;
}

export function insertAnnouncement(db: DatabaseSync, announcement: Announcement, sortOrder: number) {
  db.prepare(
    `INSERT OR IGNORE INTO announcements (
      id, content, time, publisher, confirm_text, show_every_time, show_goto_button, goto_url, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    announcement.id,
    announcement.content,
    announcement.time,
    announcement.publisher,
    announcement.confirmText,
    boolToDb(Boolean(announcement.showEveryTime)),
    boolToDb(announcement.showGotoButton),
    announcement.gotoUrl ?? "",
    sortOrder,
  );
}

export function readPlaintextPaths(): string[] {
  const db = getAppDb();
  const rows = db
    .prepare("SELECT path FROM encryption_plaintext_paths ORDER BY sort_order ASC, path ASC")
    .all() as { path: string }[];
  return rows.map((row) => row.path);
}

export function replacePlaintextPaths(paths: string[]) {
  const db = getAppDb();
  runInTransaction(db, () => replacePlaintextPathsWithDb(db, paths));
}

function replacePlaintextPathsWithDb(db: DatabaseSync, paths: string[]) {
  db.prepare("DELETE FROM encryption_plaintext_paths").run();
  const insert = db.prepare("INSERT INTO encryption_plaintext_paths (path, sort_order) VALUES (?, ?)");
  paths.forEach((path, index) => insert.run(path, index));
}

export function readAdminUser(username: string): AdminUser | null {
  const db = getAppDb();
  const row = db.prepare("SELECT username, password_hash FROM admin_users WHERE username = ?").get(username) as
    | { username: string; password_hash: string }
    | undefined;
  return row ? { username: row.username, passwordHash: row.password_hash } : null;
}

export function readAnyAdminUser(): AdminUser | null {
  const db = getAppDb();
  const row = db.prepare("SELECT username, password_hash FROM admin_users ORDER BY rowid ASC LIMIT 1").get() as
    | { username: string; password_hash: string }
    | undefined;
  return row ? { username: row.username, passwordHash: row.password_hash } : null;
}

export function upsertAdminUser(user: AdminUser) {
  const db = getAppDb();
  db.prepare(
    `INSERT INTO admin_users (username, password_hash, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(username) DO UPDATE SET
       password_hash = excluded.password_hash,
       updated_at = excluded.updated_at`,
  ).run(user.username, user.passwordHash, Date.now());
}

export function insertFeedback(item: FeedbackItem) {
  const db = getAppDb();
  runInTransaction(db, () => {
    db.prepare(
      `INSERT OR IGNORE INTO feedback (
        id, created_at, feedback_type, description, contact, device_json
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      item.id,
      item.createdAt,
      item.feedback_type,
      item.description,
      item.contact,
      JSON.stringify(item.device ?? {}),
    );
    const insertImage = db.prepare(
      `INSERT INTO feedback_images (feedback_id, image_path, sort_order)
       SELECT ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM feedback_images WHERE feedback_id = ? AND image_path = ?
       )`,
    );
    item.imagePaths.forEach((imagePath, index) => {
      insertImage.run(item.id, imagePath, index, item.id, imagePath);
    });
  });
}
