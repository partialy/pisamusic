import {
  readAppConfig,
  shouldBlock,
  type Announcement,
  type AppConfig,
  type AppUpdate,
  type BootstrapConfig,
  type ReleaseInfo,
} from "../db/configStore";
import { verifyUserToken } from "../middleware/requireUserJwt";
import { readHydratedAnnouncements } from "./announcementService";
import {
  reportAndroidDevice,
  reportDesktopDevice,
  type AndroidDeviceReportResult,
  type DesktopDeviceReportResult,
  type DeviceReportResult,
} from "./deviceReportService";
import {
  listUnreadForIdentity,
  type DirectMessageUnreadPage,
} from "./directMessageService";
import {
  parseSidebarMenuSchemaVersion,
  readPublicSidebarMenu,
  type PublicSidebarMenuConfig,
} from "./sidebarMenuService";
import {
  issueUserAuthToken,
  type UserAuthTokenResult,
} from "./userTokenService";

export class StartupServiceBlockedError extends Error {
  readonly code = -233;
}

export class StartupValidationError extends Error {}

export type StartupAgreementPayload = {
  version: number;
  acceptedUpToDate: boolean;
  title: string;
  content: string;
};

export type StartupAccountPayload = {
  status: "none" | "refreshed" | "expired";
  session: UserAuthTokenResult | null;
};

export type AndroidStartupResult = {
  bootstrap: BootstrapConfig;
  update: AppUpdate;
  agreement: StartupAgreementPayload;
  device: AndroidDeviceReportResult;
  announcements: Announcement[];
  account: StartupAccountPayload;
  unreadMessages: DirectMessageUnreadPage;
  sidebarMenu: PublicSidebarMenuConfig;
};

export type DesktopStartupResult = {
  serverTime: number;
  bootstrap: BootstrapConfig;
  update: ReleaseInfo;
  agreement: StartupAgreementPayload;
  device: DesktopDeviceReportResult;
  announcements: Announcement[];
  account: StartupAccountPayload;
  unreadMessages: DirectMessageUnreadPage;
};

export type ExecuteStartupInput = {
  rawBody: unknown;
  clientIp: string;
  bearerToken: string;
  absolutizeUrl: (url: string) => string;
};

export type ExecuteAndroidStartupInput = ExecuteStartupInput;
export type ExecuteDesktopStartupInput = ExecuteStartupInput;

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function parseOptionalVersion(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    return Number.parseInt(value.trim(), 10);
  }
  return null;
}

function buildAgreementPayload(
  cfg: AppConfig,
  rawAgreementVersion: unknown,
): StartupAgreementPayload {
  const clientAgreementVersion = parseOptionalVersion(rawAgreementVersion);
  const acceptedUpToDate =
    clientAgreementVersion !== null && clientAgreementVersion === cfg.agreement.version;

  return acceptedUpToDate
    ? {
        version: cfg.agreement.version,
        acceptedUpToDate: true,
        title: "",
        content: "",
      }
    : {
        version: cfg.agreement.version,
        acceptedUpToDate: false,
        title: cfg.agreement.title,
        content: cfg.agreement.content,
      };
}

async function executeStartupCommon<TDevice extends DeviceReportResult>(params: {
  input: ExecuteStartupInput;
  deviceKind: "android" | "desktop";
  reportDevice: (rawDevice: unknown, ip: string) => Promise<TDevice>;
}) {
  const cfg = await readAppConfig();
  const blockState = shouldBlock(cfg);
  if (blockState.blocked) {
    throw new StartupServiceBlockedError(blockState.reason);
  }

  const body = asObject(params.input.rawBody);
  if (!body.device || typeof body.device !== "object" || Array.isArray(body.device)) {
    throw new StartupValidationError("缺少 device 上报参数");
  }

  const rawToken = params.input.bearerToken.trim();
  const [device, authedUser, announcements] = await Promise.all([
    params.reportDevice(body.device, params.input.clientIp),
    rawToken ? verifyUserToken(rawToken) : Promise.resolve(null),
    readHydratedAnnouncements({ enabledOnly: true }),
  ]);

  const [account, unreadMessages] = await Promise.all([
    resolveAccountPayload(rawToken, authedUser),
    listUnreadForIdentity(
      {
        userId: authedUser?.id ?? null,
        device: { kind: params.deviceKind, id: device.id },
      },
      body.unreadMessageLimit ?? body.directMessageLimit,
    ),
  ]);

  return {
    cfg,
    device,
    announcements,
    account,
    unreadMessages,
    agreement: buildAgreementPayload(cfg, body.agreementVersion),
  };
}

/**
 * Android 冷启动聚合服务：
 * 在单次请求内完成停服检查、设备上报、账号静默刷新、未读专属消息查询与核心配置组装。
 */
export async function executeAndroidStartup(
  input: ExecuteAndroidStartupInput,
): Promise<AndroidStartupResult> {
  const body = asObject(input.rawBody);
  const schemaVersion = parseSidebarMenuSchemaVersion(body.sidebarMenuSchemaVersion);
  const [common, sidebarMenu] = await Promise.all([
    executeStartupCommon({
      input,
      deviceKind: "android",
      reportDevice: reportAndroidDevice,
    }),
    readPublicSidebarMenu(input.absolutizeUrl, schemaVersion),
  ]);

  const update: AppUpdate = {
    ...common.cfg.update,
    downloadUrl: input.absolutizeUrl(common.cfg.update.downloadUrl),
  };

  return {
    bootstrap: common.cfg.bootstrap,
    update,
    agreement: common.agreement,
    device: common.device,
    announcements: common.announcements,
    account: common.account,
    unreadMessages: common.unreadMessages,
    sidebarMenu,
  };
}

/**
 * PC 桌面端冷启动聚合服务：
 * 复用统一初始化流程并返回桌面端发布配置（releases.desktop）。
 */
export async function executeDesktopStartup(
  input: ExecuteDesktopStartupInput,
): Promise<DesktopStartupResult> {
  const common = await executeStartupCommon({
    input,
    deviceKind: "desktop",
    reportDevice: reportDesktopDevice,
  });

  const desktopRelease = common.cfg.releases.desktop;
  const update: ReleaseInfo = {
    ...desktopRelease,
    downloadUrl: input.absolutizeUrl(desktopRelease.downloadUrl),
  };

  return {
    serverTime: Date.now(),
    bootstrap: common.cfg.bootstrap,
    update,
    agreement: common.agreement,
    device: common.device,
    announcements: common.announcements,
    account: common.account,
    unreadMessages: common.unreadMessages,
  };
}

async function resolveAccountPayload(
  rawToken: string,
  authedUser: Awaited<ReturnType<typeof verifyUserToken>>,
): Promise<StartupAccountPayload> {
  if (!rawToken) {
    return { status: "none", session: null };
  }
  if (!authedUser) {
    return { status: "expired", session: null };
  }
  const session = await issueUserAuthToken(authedUser);
  return { status: "refreshed", session };
}
