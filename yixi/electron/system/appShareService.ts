import { identityRevision } from "../account/accountIdentity";
import {
  getAccountSession, getDesktopDeviceClientId, getDesktopDeviceMessageToken,
  refreshAccountSession, refreshDesktopDeviceMessageToken, requestSystem, resolveSystemAssetUrl,
} from "./systemClient";
import type { AppShareConfig, AppShareResult } from "../../src/types/appShare";

// 仅 main 内存缓存，键绑定长期设备与账号；不缓存 JWT、设备 Token 或请求对象。
const cache = new Map<string, AppShareConfig>();
const requests = new Map<string, number>();

export async function getAppShare(): Promise<AppShareResult> {
  let revision = identityRevision();
  const deviceId = getDesktopDeviceClientId();
  let session = getAccountSession();
  const accountId = session.loggedIn ? session.user.id : "";
  const key = JSON.stringify([deviceId, accountId]);
  const generation = (requests.get(key) ?? 0) + 1;
  requests.set(key, generation);
  const isCurrent = () => revision === identityRevision() && deviceId === getDesktopDeviceClientId();
  try {
    let deviceToken = getDesktopDeviceMessageToken()?.trim();
    if (!deviceToken) deviceToken = await refreshDesktopDeviceMessageToken();
    if (!isCurrent()) throw new Error("身份已变化，请重新获取推广信息");
    const request = () => requestSystem<AppShareConfig>("/api/config/app-share", {
      token: session.loggedIn ? session.token : null,
      headers: { "x-pm-device-token": deviceToken! },
      recordFailure: false,
    });
    let response = await request();
    if (!isCurrent()) throw new Error("身份已变化，请重新获取推广信息");
    if (response.code === 401) {
      // 仅修复合法身份后重试一次，绝不删 Header 降为游客。
      deviceToken = await refreshDesktopDeviceMessageToken();
      if (!isCurrent()) throw new Error("身份已变化，请重新获取推广信息");
      if (session.loggedIn) {
        const previousRevision = revision;
        session = await refreshAccountSession();
        if (!session.loggedIn || session.user.id !== accountId ||
          identityRevision() !== previousRevision + 1 || deviceId !== getDesktopDeviceClientId()) {
          throw new Error("账号身份已变化，请重新获取推广信息");
        }
        revision = identityRevision();
      }
      response = await request();
    }
    if (!isCurrent()) throw new Error("身份已变化，请重新获取推广信息");
    if (!response.success || response.code !== 0 || !response.data) {
      if (response.code === 401) throw new Error("设备或账号身份校验失败，请重新登录或重新连接服务后重试");
      throw new Error(`获取推广信息失败（${response.code}）：${response.msg || "请确认服务端支持 PC 推广分享"}`);
    }
    const raw = response.data;
    const text = (value: unknown) => typeof value === "string" ? value : "";
    const config: AppShareConfig = {
      appName: text(raw.appName), version: text(raw.version),
      iconUrl: resolveSystemAssetUrl(text(raw.iconUrl)), description: text(raw.description),
      qrCodeText: text(raw.qrCodeText), copyText: text(raw.copyText),
      updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : 0,
      shareCode: text(raw.shareCode), trackingEnabled: raw.trackingEnabled === true,
    };
    if (requests.get(key) === generation) cache.set(key, config);
    return { identityRevision: revision, config, verified: true, cached: false, error: "" };
  } catch (error) {
    // 身份变化时连旧身份缓存也不返回，避免迟到数据进入新账号界面。
    if (!isCurrent()) return { identityRevision: revision, config: null, verified: false, cached: false, error: "身份已变化，请重新获取推广信息" };
    const config = cache.get(key) ?? null;
    return { identityRevision: revision, config, verified: false, cached: !!config, error: error instanceof Error ? error.message : "获取失败，请重新连接服务后重试" };
  }
}
