import type { DbTransaction } from "../core/types";
import { getAppDb } from "../appDb";
import { normalizePlainTextContent } from "../plainTextContent";
import { readPlaintextPaths } from "../security/encryptionStore";

export type AppUpdate = {
  latestVersion: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
};

export type ReleasePlatform = "android" | "desktop";

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
  version: number;
};

export type EditableTextContentConfig = Omit<TextContentConfig, "version">;

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
  agreement?: EditableTextContentConfig;
  privacy?: EditableTextContentConfig;
  about?: AboutConfig;
  discover?: DiscoverConfig;
};

export const RELEASE_PLATFORMS: ReleasePlatform[] = ["android", "desktop"];
export const DEFAULT_DESKTOP_UPDATE_FEED = "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64";
export const DEFAULT_EMAIL_SERVICE_URL = "https://gateway.partialy.cn/auth-service/api/send/email";
export const DEFAULT_EMAIL_PROVIDER = "aliyun";
export const DEFAULT_EMAIL_PROVIDERS: EmailProviderConfig[] = [
  { code: "aliyun", name: "阿里云" },
  { code: "resend", name: "Resend" },
];

export const DEFAULT_APP_CONFIG: AppConfig = {
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
    version: "1.0.0",
    updatedAt: 0,
    endpoints: {
      auth: "https://gateway.partialy.cn/auth-service",
      music: "https://gateway.partialy.cn/music-service",
      stream: "https://gateway.partialy.cn/stream-service",
      account: "https://gateway.partialy.cn/account-service",
      config: "https://pm.hs.partialy.cn/api/config/get",
      checkUpdate: "https://pm.hs.partialy.cn/api/config/releases",
      contentAgreement: "https://pm.hs.partialy.cn/api/config/content/agreement",
      contentPrivacy: "https://pm.hs.partialy.cn/api/config/content/privacy",
      contentAbout: "https://pm.hs.partialy.cn/api/config/content/about",
      discover: "https://pm.hs.partialy.cn/music/discover.html",
      sharePlaylist: "https://pm.hs.partialy.cn/scan?type=playlist-share&uuid={uuid}",
      shareSong: "https://pm.hs.partialy.cn/scan?type=music-share&uuid={uuid}",
      fileUpload: "https://pm.hs.partialy.cn/api/upload",
      feedback: "https://pm.hs.partialy.cn/api/feedback",
      faultReport: "https://pm.hs.partialy.cn/api/fault-reports",
      deviceRegister: "https://pm.hs.partialy.cn/api/device/register",
      deviceActivity: "https://pm.hs.partialy.cn/api/device/activity",
      desktopDeviceRegister: "https://pm.hs.partialy.cn/api/desktop-device/register",
      desktopDeviceActivity: "https://pm.hs.partialy.cn/api/desktop-device/activity",
      directMessagePull: "https://pm.hs.partialy.cn/api/direct-messages/pull",
      directMessageAck: "https://pm.hs.partialy.cn/api/direct-messages/ack",
      realtime: "https://pm.hs.partialy.cn",
      websiteDownload: "https://pm.hs.partialy.cn/api/config/download/android",
      analyticsPv: "https://pm.hs.partialy.cn/api/analytics/page-view",
      analyticsVisit: "https://pm.hs.partialy.cn/api/analytics/site-visit",
      syncChanges: "https://pm.hs.partialy.cn/api/sync/changes",
      syncStats: "https://pm.hs.partialy.cn/api/sync/stats",
      cloudMusicPublicSummary: "https://pm.hs.partialy.cn/api/cloud-music/summary",
      cloudMusicPublicSearch: "https://pm.hs.partialy.cn/api/cloud-music/search",
      cloudMusicPublicDetail: "https://pm.hs.partialy.cn/api/cloud-music/tracks",
      cloudMusicPublicPlay: "https://pm.hs.partialy.cn/api/cloud-music/play",
      cloudMusicPublicCover: "https://pm.hs.partialy.cn/api/cloud-music/cover",
      cloudMusicPublicLyrics: "https://pm.hs.partialy.cn/api/cloud-music/lyrics",
      cloudMusicUserUploadSession: "https://pm.hs.partialy.cn/api/cloud-music/submit/upload-session",
      cloudMusicUserAssetReserve: "https://pm.hs.partialy.cn/api/cloud-music/submit/assets/reserve",
      cloudMusicUserAssetConfirm: "https://pm.hs.partialy.cn/api/cloud-music/submit/assets/confirm",
      cloudMusicUserCoverDelete: "https://pm.hs.partialy.cn/api/cloud-music/submit/cover/delete",
      cloudMusicUserSubmit: "https://pm.hs.partialy.cn/api/cloud-music/submit",
      cloudMusicUserHistory: "https://pm.hs.partialy.cn/api/cloud-music/submit/history",
      cloudMusicUserResubmit: "https://pm.hs.partialy.cn/api/cloud-music/submit/resubmit",
    },
    gatewaySign: {
      secret: "gateway-sign-secret",
      as: "client",
    },
    updater: {
      desktop: {
        enabled: true,
        feedBaseUrl: DEFAULT_DESKTOP_UPDATE_FEED,
        checkOnStartup: true,
        startupDelayMs: 3000,
      },
    },
  },
  update: {
    latestVersion: "1.0.0",
    updateTime: "2026-03-01",
    forceUpdate: false,
    downloadUrl: "",
    officialUrl: "https://pm.hs.partialy.cn",
    updateContent: "初始版本发布",
  },
  releases: {
    android: {
      latestVersion: "1.0.0",
      updateTime: "2026-03-01",
      forceUpdate: false,
      downloadUrl: "",
      officialUrl: "https://pm.hs.partialy.cn",
      updateContent: "初始版本发布",
      platformLabel: "Android",
      fileSizeText: "",
      available: false,
    },
    desktop: {
      latestVersion: "1.0.0",
      updateTime: "2026-03-01",
      forceUpdate: false,
      downloadUrl: "",
      officialUrl: "https://pm.hs.partialy.cn",
      updateContent: "初始版本发布",
      platformLabel: "Windows PC",
      fileSizeText: "",
      available: false,
    },
  },
  agreement: {
    title: "用户协议",
    content: "欢迎使用披萨音乐。请在使用本服务前仔细阅读本协议全部内容。",
    version: 1,
  },
  privacy: {
    title: "隐私政策",
    content: "我们重视您的隐私保护。本政策将向您说明我们如何收集、使用和保护您的个人信息。",
    version: 1,
  },
  about: {
    appName: "披萨音乐",
    websiteLabel: "官方网站",
    websiteUrl: "https://pm.hs.partialy.cn",
    description: "一款开源、纯净、跨平台的音乐播放客户端与配套服务端。",
    team: "Partialy Studio",
    copyright: "© 2026 Partialy. All rights reserved.",
  },
  discover: {
    url: "https://pm.hs.partialy.cn/music/discover.html",
    updatedAt: 0,
  },
};

export function boolFromDb(value: unknown): boolean {
  return Number(value) !== 0;
}

export function boolToDb(value: boolean): number {
  return value ? 1 : 0;
}

export function releaseFromUpdate(update: AppUpdate, platform: ReleasePlatform): ReleaseInfo {
  const defaults = DEFAULT_APP_CONFIG.releases[platform];
  return {
    ...update,
    platformLabel: defaults.platformLabel,
    fileSizeText: defaults.fileSizeText,
    available: Boolean(update.downloadUrl),
  };
}

export function appUpdateFromRelease(release: ReleaseInfo): AppUpdate {
  return {
    latestVersion: release.latestVersion,
    updateTime: release.updateTime,
    forceUpdate: release.forceUpdate,
    downloadUrl: release.downloadUrl,
    officialUrl: release.officialUrl,
    updateContent: release.updateContent,
  };
}

export function normalizeRelease(
  platform: ReleasePlatform,
  release?: Partial<ReleaseInfo>,
  fallbackUpdate?: AppUpdate,
): ReleaseInfo {
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

export function normalizeDesktopUpdaterConfig(input?: Partial<DesktopUpdaterConfig>): DesktopUpdaterConfig {
  const fallback = DEFAULT_APP_CONFIG.bootstrap.updater?.desktop;
  return {
    enabled: typeof input?.enabled === "boolean" ? input.enabled : (fallback?.enabled ?? true),
    feedBaseUrl:
      typeof input?.feedBaseUrl === "string" && input.feedBaseUrl.trim()
        ? input.feedBaseUrl.trim()
        : (fallback?.feedBaseUrl ?? DEFAULT_DESKTOP_UPDATE_FEED),
    checkOnStartup:
      typeof input?.checkOnStartup === "boolean" ? input.checkOnStartup : (fallback?.checkOnStartup ?? true),
    startupDelayMs:
      typeof input?.startupDelayMs === "number" && Number.isFinite(input.startupDelayMs) && input.startupDelayMs >= 0
        ? input.startupDelayMs
        : (fallback?.startupDelayMs ?? 3000),
  };
}

export function normalizeEmailProviders(input?: EmailProviderConfig[]): EmailProviderConfig[] {
  if (!Array.isArray(input)) return DEFAULT_EMAIL_PROVIDERS;
  const list = input
    .map((item) => ({
      code: typeof item?.code === "string" ? item.code.trim() : "",
      name: typeof item?.name === "string" ? item.name.trim() : "",
    }))
    .filter((item) => Boolean(item.code && item.name));
  return list.length ? list : DEFAULT_EMAIL_PROVIDERS;
}

export function normalizeEmailConfig(input?: Partial<EmailConfig>): EmailConfig {
  const providers = normalizeEmailProviders(input?.providers);
  const provider = typeof input?.provider === "string" && input.provider.trim() ? input.provider.trim() : DEFAULT_EMAIL_PROVIDER;
  const matchedProvider = providers.some((item) => item.code === provider) ? provider : (providers[0]?.code ?? DEFAULT_EMAIL_PROVIDER);
  return {
    serviceUrl: typeof input?.serviceUrl === "string" && input.serviceUrl.trim() ? input.serviceUrl.trim() : DEFAULT_EMAIL_SERVICE_URL,
    provider: matchedProvider,
    providers,
  };
}

export function parseEmailProviders(raw?: string | null): EmailProviderConfig[] {
  if (!raw) return DEFAULT_EMAIL_PROVIDERS;
  try {
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return DEFAULT_EMAIL_PROVIDERS;
    return normalizeEmailProviders(
      list.map((item) => {
        if (!item || typeof item !== "object") return { code: "", name: "" };
        const record = item as Record<string, unknown>;
        return {
          code: typeof record.code === "string" ? record.code : "",
          name: typeof record.name === "string" ? record.name : "",
        };
      }),
    );
  } catch {
    return DEFAULT_EMAIL_PROVIDERS;
  }
}

export async function replaceAppConfig(config: AppConfig): Promise<void> {
  await getAppDb().transaction(async (tx) => {
    await replaceAppConfigWithDb(tx, config);
  });
}

export async function replaceAppConfigWithDb(db: DbTransaction, config: AppConfig): Promise<void> {
  const now = Date.now();
  await db.execute(
    db.dialect === "mysql"
      ? `INSERT INTO app_settings (
          id, app_available, unavailable_reason, bootstrap_version, bootstrap_updated_at,
          gateway_secret, gateway_as, email_service_url, email_provider, email_providers_json, updater_enabled, updater_feed_base_url,
          updater_check_startup, updater_startup_delay, created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          app_available = VALUES(app_available),
          unavailable_reason = VALUES(unavailable_reason),
          bootstrap_version = VALUES(bootstrap_version),
          bootstrap_updated_at = VALUES(bootstrap_updated_at),
          gateway_secret = VALUES(gateway_secret),
          gateway_as = VALUES(gateway_as),
          email_service_url = VALUES(email_service_url),
          email_provider = VALUES(email_provider),
          email_providers_json = VALUES(email_providers_json),
          updater_enabled = VALUES(updater_enabled),
          updater_feed_base_url = VALUES(updater_feed_base_url),
          updater_check_startup = VALUES(updater_check_startup),
          updater_startup_delay = VALUES(updater_startup_delay),
          updated_at = VALUES(updated_at)`
      : `INSERT INTO app_settings (
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
    [
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
    ],
  );

  await db.execute("DELETE FROM bootstrap_endpoints", []);
  const entries = Object.entries(config.bootstrap.endpoints);
  for (let index = 0; index < entries.length; index += 1) {
    const [key, value] = entries[index];
    await db.execute(
      db.dialect === "mysql"
        ? "INSERT INTO bootstrap_endpoints (`key`, value, sort_order) VALUES (?, ?, ?)"
        : "INSERT INTO bootstrap_endpoints (key, value, sort_order) VALUES (?, ?, ?)",
      [key, value, index],
    );
  }

  await replaceContentPage(db, "agreement", config.agreement);
  await replaceContentPage(db, "privacy", config.privacy);
  await replaceAbout(db, config.about);
  await replaceCurrentUpdate(db, config.update);
  await replaceReleases(db, config.releases);
  await replaceDiscover(db, config.discover);
}

export async function replaceContentPage(db: DbTransaction, code: string, page: TextContentConfig): Promise<void> {
  const content = normalizePlainTextContent(page.content);
  const current = (await db.queryOne("SELECT title, content, version FROM content_pages WHERE code = ?", [code])) as
    | { title: string; content: string; version: number }
    | undefined;
  const changed = !current || current.title !== page.title || current.content !== content;
  const currentVersion =
    current && Number.isSafeInteger(current.version) && current.version > 0 ? current.version : 1;
  if (changed && current && currentVersion >= Number.MAX_SAFE_INTEGER) {
    throw new Error(`${code} 版本号已达到上限`);
  }
  const version = changed ? (current ? currentVersion + 1 : 1) : currentVersion;
  await db.execute(
    db.dialect === "mysql"
      ? `INSERT INTO content_pages (code, title, content, version, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           title = VALUES(title),
           content = VALUES(content),
           version = VALUES(version),
           updated_at = VALUES(updated_at)`
      : `INSERT INTO content_pages (code, title, content, version, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           version = excluded.version,
           updated_at = excluded.updated_at`,
    [code, page.title, content, version, Date.now()],
  );
}

export async function replaceAbout(db: DbTransaction, about: AboutConfig): Promise<void> {
  await db.execute(
    db.dialect === "mysql"
      ? `INSERT INTO about_config (
          id, app_name, website_label, website_url, description, team, copyright, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          app_name = VALUES(app_name),
          website_label = VALUES(website_label),
          website_url = VALUES(website_url),
          description = VALUES(description),
          team = VALUES(team),
          copyright = VALUES(copyright),
          updated_at = VALUES(updated_at)`
      : `INSERT INTO about_config (
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
    [
      about.appName,
      about.websiteLabel,
      about.websiteUrl,
      about.description,
      about.team,
      about.copyright,
      Date.now(),
    ],
  );
}

export async function replaceCurrentUpdate(db: DbTransaction, update: AppUpdate): Promise<void> {
  await db.execute(
    db.dialect === "mysql"
      ? `INSERT INTO current_update (
          id, latest_version, update_time, force_update, download_url, official_url, update_content, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          latest_version = VALUES(latest_version),
          update_time = VALUES(update_time),
          force_update = VALUES(force_update),
          download_url = VALUES(download_url),
          official_url = VALUES(official_url),
          update_content = VALUES(update_content),
          updated_at = VALUES(updated_at)`
      : `INSERT INTO current_update (
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
    [
      update.latestVersion,
      update.updateTime,
      boolToDb(update.forceUpdate),
      update.downloadUrl,
      update.officialUrl,
      update.updateContent,
      Date.now(),
    ],
  );
}

export async function replaceReleases(db: DbTransaction, releases: ReleaseConfig): Promise<void> {
  for (const platform of RELEASE_PLATFORMS) {
    const release = normalizeRelease(
      platform,
      releases[platform],
      platform === "android" ? appUpdateFromRelease(releases.android) : undefined,
    );
    await db.execute(
      db.dialect === "mysql"
        ? `INSERT INTO release_info (
            platform, latest_version, update_time, force_update, download_url, official_url,
            update_content, platform_label, file_size_text, available, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            latest_version = VALUES(latest_version),
            update_time = VALUES(update_time),
            force_update = VALUES(force_update),
            download_url = VALUES(download_url),
            official_url = VALUES(official_url),
            update_content = VALUES(update_content),
            platform_label = VALUES(platform_label),
            file_size_text = VALUES(file_size_text),
            available = VALUES(available),
            updated_at = VALUES(updated_at)`
        : `INSERT INTO release_info (
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
      [
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
      ],
    );
  }
}

export async function replaceDiscover(db: DbTransaction, discover: DiscoverConfig): Promise<void> {
  await db.execute(
    db.dialect === "mysql"
      ? `INSERT INTO discover_config (id, url, updated_at)
         VALUES (1, ?, ?)
         ON DUPLICATE KEY UPDATE
           url = VALUES(url),
           updated_at = VALUES(updated_at)`
      : `INSERT INTO discover_config (id, url, updated_at)
         VALUES (1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           url = excluded.url,
           updated_at = excluded.updated_at`,
    [discover.url, discover.updatedAt],
  );
}

export async function readAppConfig(): Promise<AppConfig> {
  return await getAppDb().transaction(readAppConfigWithDb);
}

export async function readAppConfigWithDb(db: DbTransaction): Promise<AppConfig> {
  const settings = (await db.queryOne("SELECT * FROM app_settings WHERE id = 1", [])) as
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
  const endpoints = (await db.query(
    "SELECT `key`, value FROM bootstrap_endpoints ORDER BY sort_order ASC, `key` ASC",
    [],
  )) as { key: string; value: string }[];
  const pages = (await db.query("SELECT code, title, content, version FROM content_pages", [])) as {
    code: string;
    title: string;
    content: string;
    version: number;
  }[];
  const about = (await db.queryOne("SELECT * FROM about_config WHERE id = 1", [])) as
    | {
        app_name: string;
        website_label: string;
        website_url: string;
        description: string;
        team: string;
        copyright: string;
      }
    | undefined;
  const update = (await db.queryOne("SELECT * FROM current_update WHERE id = 1", [])) as
    | {
        latest_version: string;
        update_time: string;
        force_update: number;
        download_url: string;
        official_url: string;
        update_content: string;
      }
    | undefined;
  const releaseRows = (await db.query("SELECT * FROM release_info", [])) as {
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
  const discover = (await db.queryOne("SELECT * FROM discover_config WHERE id = 1", [])) as
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
      plaintextPaths: await readPlaintextPaths(db),
    },
  };
}

export function shouldBlock(config: AppConfig): { blocked: boolean; reason: string } {
  if (config.availability.appAvailable) return { blocked: false, reason: "" };
  return {
    blocked: true,
    reason: config.availability.unavailableReason || "服务维护中",
  };
}

export async function saveAppConfigSections(sections: EditableAppConfigSections): Promise<AppConfig> {
  return await getAppDb().transaction(async (tx) => await saveAppConfigSectionsWithDb(tx, sections));
}

export async function saveAppConfigSectionsWithDb(
  db: DbTransaction,
  sections: EditableAppConfigSections,
): Promise<AppConfig> {
  const current = await readAppConfigWithDb(db);
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
        desktop: normalizeDesktopUpdaterConfig(
          sections.bootstrap?.updater?.desktop ?? current.bootstrap.updater?.desktop,
        ),
      },
    },
    update: sections.releases?.android
      ? appUpdateFromRelease(normalizeRelease("android", sections.releases.android, current.update))
      : current.update,
    releases: {
      android: normalizeRelease("android", sections.releases?.android ?? current.releases.android, current.update),
      desktop: normalizeRelease("desktop", sections.releases?.desktop ?? current.releases.desktop),
    },
    agreement: sections.agreement
      ? { ...sections.agreement, version: current.agreement.version }
      : current.agreement,
    privacy: sections.privacy ? { ...sections.privacy, version: current.privacy.version } : current.privacy,
    about: sections.about ?? current.about,
    discover: sections.discover ?? current.discover,
  };
  await replaceAppConfigWithDb(db, next);
  return await readAppConfigWithDb(db);
}
