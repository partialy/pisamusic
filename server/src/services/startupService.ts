import {
  readAppConfig,
  shouldBlock,
  type Announcement,
  type AppUpdate,
  type BootstrapConfig,
} from "../db/configStore";
import { verifyUserToken } from "../middleware/requireUserJwt";
import { readHydratedAnnouncements } from "./announcementService";
import {
  reportAndroidDevice,
  type AndroidDeviceReportResult,
} from "./deviceReportService";
import {
  listUnreadForIdentity,
  type DirectMessageUnreadPage,
} from "./directMessageService";
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
};

export type ExecuteAndroidStartupInput = {
  rawBody: unknown;
  clientIp: string;
  bearerToken: string;
  absolutizeUrl: (url: string) => string;
};

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

/**
 * Android 冷启动聚合服务：
 * 在单次请求内完成停服检查、设备上报、账号静默刷新、未读专属消息查询与核心配置组装。
 */
export async function executeAndroidStartup(
  input: ExecuteAndroidStartupInput,
): Promise<AndroidStartupResult> {
  const cfg = await readAppConfig();
  const blockState = shouldBlock(cfg);
  if (blockState.blocked) {
    throw new StartupServiceBlockedError(blockState.reason);
  }

  const body = asObject(input.rawBody);
  if (!body.device || typeof body.device !== "object" || Array.isArray(body.device)) {
    throw new StartupValidationError("缺少 device 上报参数");
  }

  const device = await reportAndroidDevice(body.device, input.clientIp);
  const rawToken = input.bearerToken.trim();
  const authedUser = rawToken ? await verifyUserToken(rawToken) : null;

  const [account, unreadMessages, announcements] = await Promise.all([
    resolveAccountPayload(rawToken, authedUser),
    listUnreadForIdentity(
      {
        userId: authedUser?.id ?? null,
        device: { kind: "android", id: device.id },
      },
      body.unreadMessageLimit,
    ),
    readHydratedAnnouncements({ enabledOnly: true }),
  ]);

  const clientAgreementVersion = parseOptionalVersion(body.agreementVersion);
  const acceptedUpToDate =
    clientAgreementVersion !== null && clientAgreementVersion === cfg.agreement.version;

  const agreement: StartupAgreementPayload = acceptedUpToDate
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

  const update: AppUpdate = {
    ...cfg.update,
    downloadUrl: input.absolutizeUrl(cfg.update.downloadUrl),
  };

  return {
    bootstrap: cfg.bootstrap,
    update,
    agreement,
    device,
    announcements,
    account,
    unreadMessages,
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
