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
};

export type DesktopUpdateAssetType = "latest-yml" | "installer" | "blockmap";

export type DesktopUpdateAssetInfo = {
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
  status: ReleaseFileStatus;
  active: boolean;
  createdAt: number;
  deletedAt: number | null;
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
      updateContent: "PC 版正在准备中。",
      platformLabel: "PC 版",
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

type ReleaseFileRow = {
  id: string;
  history_id: string | null;
  platform: ReleasePlatform;
  provider: string;
  bucket: string;
  object_key: string;
  hash: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  download_url: string;
  status: string;
  created_at: number;
  deleted_at: number | null;
};

type DesktopUpdateAssetRow = {
  id: string;
  version: string;
  platform: string;
  arch: string;
  file_type: string;
  provider: string;
  bucket: string;
  object_key: string;
  hash: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  status: string;
  active: number;
  created_at: number;
  deleted_at: number | null;
};

function mapReleaseFile(row?: ReleaseFileRow | null): ReleaseFileInfo | null {
  if (!row) return null;
  return {
    id: row.id,
    historyId: row.history_id,
    platform: row.platform === "desktop" ? "desktop" : "android",
    provider: "qiniu",
    bucket: row.bucket,
    objectKey: row.object_key,
    hash: row.hash,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size) || 0,
    downloadUrl: row.download_url,
    status: row.status === "deleted" ? "deleted" : "uploaded",
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function mapDesktopUpdateAsset(row?: DesktopUpdateAssetRow | null): DesktopUpdateAssetInfo | null {
  if (!row) return null;
  const fileType = row.file_type === "latest-yml" || row.file_type === "blockmap" ? row.file_type : "installer";
  return {
    id: row.id,
    version: row.version,
    platform: "win32",
    arch: "x64",
    fileType,
    provider: "qiniu",
    bucket: row.bucket,
    objectKey: row.object_key,
    hash: row.hash,
    fileName: row.file_name,
    mimeType: row.mime_type,
    fileSize: Number(row.file_size) || 0,
    status: row.status === "deleted" ? "deleted" : "uploaded",
    active: boolFromDb(row.active),
    createdAt: row.created_at,
    deletedAt: row.deleted_at,
  };
}

function readReleaseFileByIdWithDb(db: DatabaseSync, id: string): ReleaseFileInfo | null {
  const row = db.prepare("SELECT * FROM release_files WHERE id = ?").get(id) as ReleaseFileRow | undefined;
  return mapReleaseFile(row);
}

function downloadUrlBelongsToReleaseFile(downloadUrl: string, file: ReleaseFileInfo): boolean {
  return downloadUrl === file.downloadUrl || downloadUrl.includes(`/api/config/release-files/${encodeURIComponent(file.id)}/download`);
}

export function replaceAppConfig(config: AppConfig) {
  const db = getAppDb();
  runInTransaction(db, () => {
    const now = Date.now();
    db.prepare(
      `INSERT INTO app_settings (
        id, app_available, unavailable_reason, bootstrap_version, bootstrap_updated_at,
        gateway_secret, gateway_as, updater_enabled, updater_feed_base_url,
        updater_check_startup, updater_startup_delay, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        app_available = excluded.app_available,
        unavailable_reason = excluded.unavailable_reason,
        bootstrap_version = excluded.bootstrap_version,
        bootstrap_updated_at = excluded.bootstrap_updated_at,
        gateway_secret = excluded.gateway_secret,
        gateway_as = excluded.gateway_as,
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
    reason: config.availability.unavailableReason || "服务暂不可用",
  };
}

export function saveAppConfigSections(sections: EditableAppConfigSections): AppConfig {
  const current = readAppConfig();
  const next: AppConfig = {
    ...current,
    availability: sections.availability ?? current.availability,
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

export function createReleaseFile(input: Omit<ReleaseFileInfo, "historyId" | "status" | "createdAt" | "deletedAt">): ReleaseFileInfo {
  const db = getAppDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO release_files (
      id, history_id, platform, provider, bucket, object_key, hash, file_name,
      mime_type, file_size, download_url, status, created_at, deleted_at
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', ?, NULL)`,
  ).run(
    input.id,
    input.platform,
    input.provider,
    input.bucket,
    input.objectKey,
    input.hash,
    input.fileName,
    input.mimeType,
    input.fileSize,
    input.downloadUrl,
    now,
  );
  const saved = readReleaseFileByIdWithDb(db, input.id);
  if (!saved) throw new Error("安装包文件保存失败");
  return saved;
}

export function readReleaseFileById(id: string): ReleaseFileInfo | null {
  return readReleaseFileByIdWithDb(getAppDb(), id);
}

export function createDesktopUpdateAsset(input: Omit<DesktopUpdateAssetInfo, "status" | "active" | "createdAt" | "deletedAt">): DesktopUpdateAssetInfo {
  const db = getAppDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO desktop_update_assets (
      id, version, platform, arch, file_type, provider, bucket, object_key,
      hash, file_name, mime_type, file_size, status, active, created_at, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', 0, ?, NULL)`,
  ).run(
    input.id,
    input.version,
    input.platform,
    input.arch,
    input.fileType,
    input.provider,
    input.bucket,
    input.objectKey,
    input.hash,
    input.fileName,
    input.mimeType,
    input.fileSize,
    now,
  );
  const row = db.prepare("SELECT * FROM desktop_update_assets WHERE id = ?").get(input.id) as DesktopUpdateAssetRow | undefined;
  const saved = mapDesktopUpdateAsset(row);
  if (!saved) throw new Error("自动更新文件保存失败");
  return saved;
}

export function readDesktopUpdateAssets(version: string, platform = "win32", arch = "x64"): DesktopUpdateAssetInfo[] {
  const db = getAppDb();
  const rows = db
    .prepare(
      `SELECT * FROM desktop_update_assets
       WHERE version = ? AND platform = ? AND arch = ? AND status = 'uploaded'
       ORDER BY created_at DESC`,
    )
    .all(version, platform, arch) as DesktopUpdateAssetRow[];
  return rows.map((row) => mapDesktopUpdateAsset(row)!).filter(Boolean);
}

export function activateDesktopUpdateVersion(version: string, platform = "win32", arch = "x64"): DesktopUpdateAssetInfo[] {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const assets = readDesktopUpdateAssets(version, platform, arch);
    const hasLatest = assets.some((asset) => asset.fileType === "latest-yml" && asset.fileName === "latest.yml");
    const hasInstaller = assets.some((asset) => asset.fileType === "installer");
    if (!hasLatest) throw new Error("缺少 latest.yml");
    if (!hasInstaller) throw new Error("缺少安装包");
    db.prepare("UPDATE desktop_update_assets SET active = 0 WHERE platform = ? AND arch = ?").run(platform, arch);
    db.prepare("UPDATE desktop_update_assets SET active = 1 WHERE version = ? AND platform = ? AND arch = ? AND status = 'uploaded'").run(version, platform, arch);
    return readDesktopUpdateAssets(version, platform, arch).map((asset) => ({ ...asset, active: true }));
  });
}

export function readActiveDesktopUpdateAsset(fileName: string, platform = "win32", arch = "x64"): DesktopUpdateAssetInfo | null {
  const db = getAppDb();
  const row = db
    .prepare(
      `SELECT * FROM desktop_update_assets
       WHERE platform = ? AND arch = ? AND active = 1 AND status = 'uploaded' AND file_name = ?
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(platform, arch, fileName) as DesktopUpdateAssetRow | undefined;
  return mapDesktopUpdateAsset(row);
}

export function readReleaseFileForHistory(historyId: string): ReleaseFileInfo | null {
  const db = getAppDb();
  const row = db
    .prepare(
      `SELECT f.*
       FROM update_history h
       JOIN release_files f ON f.id = h.release_file_id
       WHERE h.id = ?`,
    )
    .get(historyId) as ReleaseFileRow | undefined;
  return mapReleaseFile(row);
}

export function markReleaseFileDeletedForHistory(historyId: string): ReleaseFileInfo {
  const db = getAppDb();
  return runInTransaction(db, () => {
    const file = readReleaseFileForHistory(historyId);
    if (!file) throw new Error("该发布记录没有可删除的七牛安装包");
    if (file.provider !== "qiniu") throw new Error("该安装包不是七牛上传文件");

    const now = Date.now();
    db.prepare("UPDATE release_files SET status = 'deleted', deleted_at = ? WHERE id = ?").run(now, file.id);

    const current = readAppConfig();
    const release = current.releases[file.platform];
    if (downloadUrlBelongsToReleaseFile(release.downloadUrl, file)) {
      const clearedRelease: ReleaseInfo = {
        ...release,
        downloadUrl: "",
        fileSizeText: "",
        available: false,
      };
      if (file.platform === "android") {
        replaceCurrentUpdate(db, {
          ...appUpdateFromRelease(release),
          downloadUrl: "",
        });
      }
      replaceReleases(db, {
        android: file.platform === "android" ? clearedRelease : current.releases.android,
        desktop: file.platform === "desktop" ? clearedRelease : current.releases.desktop,
      });
    }

    const deleted = readReleaseFileByIdWithDb(db, file.id);
    if (!deleted) throw new Error("安装包文件状态更新失败");
    return deleted;
  });
}

export function publishUpdate(
  update: AppUpdate,
  historyId: string,
  platform: ReleasePlatform = "android",
  releaseFileId?: string | null,
): UpdateHistoryItem {
  const db = getAppDb();
  const current = readAppConfig();
  const release = normalizeRelease(platform, update, platform === "android" ? update : undefined);
  const releaseFile = releaseFileId ? readReleaseFileByIdWithDb(db, releaseFileId) : null;
  if (releaseFileId && !releaseFile) throw new Error("安装包文件不存在");
  if (releaseFile && releaseFile.status !== "uploaded") throw new Error("安装包文件已删除，不能关联发布");
  if (releaseFile && releaseFile.platform !== platform) throw new Error("安装包文件平台与发布平台不一致");
  if (releaseFile && !downloadUrlBelongsToReleaseFile(update.downloadUrl, releaseFile)) throw new Error("安装包文件链接与发布下载地址不一致");
  const item: UpdateHistoryItem = {
    id: historyId,
    platform,
    version: update.latestVersion,
    updateTime: update.updateTime,
    forceUpdate: update.forceUpdate,
    downloadUrl: update.downloadUrl,
    officialUrl: update.officialUrl,
    updateContent: update.updateContent,
    releaseFileId: releaseFile?.id ?? null,
    releaseFile,
  };
  runInTransaction(db, () => {
    if (platform === "android") {
      replaceCurrentUpdate(db, update);
    }
    replaceReleases(db, {
      android: platform === "android" ? release : current.releases.android,
      desktop: platform === "desktop" ? release : current.releases.desktop,
    });
    insertUpdateHistory(db, item);
    if (releaseFile) {
      db.prepare("UPDATE release_files SET history_id = ? WHERE id = ?").run(historyId, releaseFile.id);
    }
  });
  return item;
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
      `SELECT
        h.id, h.platform, h.version, h.update_time, h.force_update, h.download_url,
        h.official_url, h.update_content, h.release_file_id,
        f.id AS file_id, f.history_id AS file_history_id, f.platform AS file_platform,
        f.provider, f.bucket, f.object_key, f.hash, f.file_name, f.mime_type,
        f.file_size, f.download_url AS file_download_url, f.status, f.created_at,
        f.deleted_at
       FROM update_history h
       LEFT JOIN release_files f ON f.id = h.release_file_id
       ORDER BY h.created_at ASC, h.rowid ASC`,
    )
    .all() as {
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
      file_history_id: string | null;
      file_platform: ReleasePlatform | null;
      provider: string | null;
      bucket: string | null;
      object_key: string | null;
      hash: string | null;
      file_name: string | null;
      mime_type: string | null;
      file_size: number | null;
      file_download_url: string | null;
      status: string | null;
      created_at: number | null;
      deleted_at: number | null;
    }[];
  return rows.map((row) => {
    const releaseFile = row.file_id
      ? mapReleaseFile({
          id: row.file_id,
          history_id: row.file_history_id,
          platform: row.file_platform === "desktop" ? "desktop" : "android",
          provider: row.provider ?? "qiniu",
          bucket: row.bucket ?? "",
          object_key: row.object_key ?? "",
          hash: row.hash ?? "",
          file_name: row.file_name ?? "",
          mime_type: row.mime_type ?? "",
          file_size: row.file_size ?? 0,
          download_url: row.file_download_url ?? "",
          status: row.status ?? "uploaded",
          created_at: row.created_at ?? 0,
          deleted_at: row.deleted_at,
        })
      : null;
    return {
      id: row.id,
      platform: row.platform === "desktop" ? "desktop" : "android",
      version: row.version,
      updateTime: row.update_time,
      forceUpdate: boolFromDb(row.force_update),
      downloadUrl: row.download_url,
      officialUrl: row.official_url,
      updateContent: row.update_content,
      releaseFileId: row.release_file_id,
      releaseFile,
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
