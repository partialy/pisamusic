import type { AnnouncementItem, ApiResponse, BootstrapConfigData, FeedbackPayload, SystemStatus } from "@shared/system";
import { fetchSystemJson } from "@main/utils/http";
import { normalizeBaseUrl } from "@main/utils/normalize";

const DEFAULT_BASE_CANDIDATES = [
  process.env.PM_SYSTEM_BASE_URL,
  "http://localhost:53380/",
  "https://pm-server.hs.partialy.cn/",
].filter((value): value is string => Boolean(value));

let systemBaseUrl = normalizeBaseUrl(DEFAULT_BASE_CANDIDATES[0]);
let bootstrapConfig: BootstrapConfigData | null = null;

export function getSystemStatus(): SystemStatus {
  return {
    baseUrl: systemBaseUrl,
    configLoaded: bootstrapConfig !== null,
    updatedAt: bootstrapConfig?.updatedAt,
  };
}

export function getBootstrapConfig(): BootstrapConfigData | null {
  return bootstrapConfig;
}

export async function refreshBootstrapConfig(): Promise<BootstrapConfigData> {
  let lastError: unknown;
  for (const candidate of DEFAULT_BASE_CANDIDATES) {
    try {
      const base = normalizeBaseUrl(candidate);
      const response = await fetchSystemJson<ApiResponse<BootstrapConfigData>>(new URL("api/config/bootstrap", base).toString());
      assertOk(response, "配置下发失败");
      systemBaseUrl = base;
      bootstrapConfig = normalizeBootstrap(response.data);
      return bootstrapConfig;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("配置下发失败");
}

export async function ensureBootstrapConfig(): Promise<BootstrapConfigData> {
  return bootstrapConfig ?? refreshBootstrapConfig();
}

export async function getAnnouncements(): Promise<AnnouncementItem[]> {
  const response = await fetchSystemJson<ApiResponse<AnnouncementItem[]>>(
    new URL("api/config/announcements", systemBaseUrl).toString(),
  );
  assertOk(response, "公告获取失败");
  return response.data;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  const form = new FormData();
  form.set("description", payload.content);
  form.set("feedback_type", "suggestion");
  form.set("contact", payload.contact ?? "");
  form.set("device", JSON.stringify({ platform: process.platform, app: "PisaMusic Desktop" }));
  const response = await fetchSystemJson<ApiResponse<unknown>>(new URL("api/feedback", systemBaseUrl).toString(), {
    method: "POST",
    body: form,
  });
  assertOk(response, "反馈提交失败");
}

function assertOk<T>(response: ApiResponse<T>, fallback: string): void {
  if (response.success === false || response.code !== 0) {
    throw new Error(response.msg || fallback);
  }
}

function normalizeBootstrap(data: BootstrapConfigData): BootstrapConfigData {
  const endpoints = data.endpoints;
  return {
    ...data,
    endpoints: {
      kgBaseUrl: normalizeBaseUrl(endpoints.kgBaseUrl),
      wyBaseUrl: normalizeBaseUrl(endpoints.wyBaseUrl),
      proxyBaseUrl: normalizeBaseUrl(endpoints.proxyBaseUrl),
      kwBaseUrl: normalizeBaseUrl(endpoints.kwBaseUrl),
      kgSongUrl: endpoints.kgSongUrl.trim(),
      wySongUrl: endpoints.wySongUrl.trim(),
      wySongUrlV1: endpoints.wySongUrlV1.trim(),
    },
    gatewaySign: {
      secret: data.gatewaySign?.secret || "partialypartialypartialypartialy",
      as: data.gatewaySign?.as || "yixivip",
    },
  };
}
