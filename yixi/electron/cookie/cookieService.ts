import { randomUUID } from "node:crypto";
import { copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { BrowserWindow, app, dialog, type Cookie, type Session } from "electron";
import { getRuntimeEndpointsCached, requestSignedGateway } from "../system/systemClient";
import { logger } from "../utils/logger";
import { parseCookieHeader, UserCookieStore } from "./cookieStore";
import { buildUrl, requestSignedGatewayWithCookie } from "./cookieRequest";
import type {
  CookieAccountProfile,
  CookieSource,
  CookieDebugApiResult,
  CookieFileExportResult,
  KgQrLoginSnapshot,
  KgQrLoginStatus,
  WyLoginWindowMode,
  WyLoginWindowResult,
} from "./types";

const stores: Partial<Record<CookieSource, UserCookieStore>> = {};
const kgQrSessions = new Map<string, { key: string; expiresAt: number }>();

const WY_MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

export function getUserCookie(source: CookieSource) {
  return getStore(source).getHeader();
}

export function clearUserCookie(source: CookieSource) {
  return getStore(source).clear();
}

export async function kgSendCaptcha(payload: { mobile: string }) {
  const mobile = normalizeMobile(payload.mobile);
  const endpoints = await getRuntimeEndpointsCached();
  return requestSignedGateway<Record<string, unknown>>(
    buildUrl(endpoints.kgServer, "/captcha/sent", { mobile })
  );
}

export async function kgLoginWithCode(payload: { mobile: string; code: string }) {
  const mobile = normalizeMobile(payload.mobile);
  const code = payload.code.trim();
  if (!code) throw new Error("code is required");
  const endpoints = await getRuntimeEndpointsCached();
  const response = await requestSignedGateway<KgEnvelope>(
    buildUrl(endpoints.kgServer, "/login/cellphone", { mobile, code })
  );
  assertKgSuccess(response, "login failed");
  const token = scalar(response.data?.token);
  const userid = scalar(response.data?.userid);
  if (!token || !userid) throw new Error("login response missing token or userid");
  await finalizeKgLoginSession(token, userid);
  return getCookieAccountProfile({ source: "kg" });
}

export async function kgStartQrLogin(): Promise<KgQrLoginSnapshot> {
  const endpoints = await getRuntimeEndpointsCached();
  const response = await requestSignedGateway<KgQrKeyEnvelope>(
    buildUrl(endpoints.kgServer, "/login/qr/key", { timestamp: Date.now() })
  );
  const envelope = requireKgQrKeyEnvelope(response);
  const key = envelope.data.qrcode;
  let qrcodeImg = normalizeQrImage(envelope.data.qrcode_img || "");

  if (!qrcodeImg) {
    const createResponse = await requestSignedGateway<KgQrCreateEnvelope>(
      buildUrl(endpoints.kgServer, "/login/qr/create", { key, timestamp: Date.now() })
    );
    qrcodeImg = normalizeQrImage(createResponse.data?.base64 || createResponse.data?.url || "");
  }

  if (!qrcodeImg) {
    throw new Error("qr image missing from kg login api");
  }

  const loginId = randomUUID();
  kgQrSessions.set(loginId, {
    key,
    expiresAt: Date.now() + 3 * 60 * 1000,
  });
  return { loginId, qrcodeImg };
}

export async function kgCheckQrLogin(payload: { loginId: string }): Promise<KgQrLoginStatus> {
  const state = kgQrSessions.get(payload.loginId);
  if (!state) return { status: "expired", saved: false, message: "二维码已过期" };
  if (state.expiresAt < Date.now()) {
    kgQrSessions.delete(payload.loginId);
    return { status: "expired", saved: false, message: "二维码已过期" };
  }

  const endpoints = await getRuntimeEndpointsCached();
  const response = await requestSignedGateway<KgEnvelope>(
    buildUrl(endpoints.kgServer, "/login/qr/check", { key: state.key, timestamp: Date.now() })
  );
  const data = response.data ?? {};
  const status = Number(data.status ?? 1);

  if (status === 0) {
    kgQrSessions.delete(payload.loginId);
    return { status: "expired", saved: false, message: "二维码已过期" };
  }
  if (status === 2) {
    return {
      status: "confirming",
      saved: false,
      nickname: scalar(data.nickname),
      avatar: scalar(data.pic),
      message: "请在手机上确认登录",
    };
  }
  if (status === 4) {
    const token = scalar(data.token);
    const userid = scalar(data.userid);
    if (!token || !userid) {
      return { status: "failed", saved: false, message: "登录响应缺少 token 或 userid" };
    }
    await finalizeKgLoginSession(token, userid);
    kgQrSessions.delete(payload.loginId);
    return {
      status: "success",
      saved: true,
      nickname: scalar(data.nickname),
      avatar: scalar(data.pic),
      message: "登录成功",
    };
  }
  return { status: "waiting", saved: false, message: response.message || response.msg || "等待扫码" };
}

export async function wyOpenLoginWindow(payload: { mode: WyLoginWindowMode }): Promise<WyLoginWindowResult> {
  const mode = payload.mode === "mobile" ? "mobile" : "pc";
  const loginUrl = mode === "mobile" ? "https://music.163.com/m/login" : "https://music.163.com/#/login";

  return new Promise((resolve) => {
    let settled = false;
    const loginWindow = new BrowserWindow({
      title: mode === "mobile" ? "网易云音乐手机网页登录" : "网易云音乐网页登录",
      width: mode === "mobile" ? 430 : 980,
      height: mode === "mobile" ? 760 : 720,
      minWidth: 380,
      minHeight: 560,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });

    if (mode === "mobile") {
      loginWindow.webContents.setUserAgent(WY_MOBILE_USER_AGENT);
    }

    const loginSession = loginWindow.webContents.session;
    const finish = async (saved: boolean) => {
      if (settled) return;
      settled = true;
      loginSession.cookies.removeListener("changed", onCookieChanged);
      const hasMusicU = saved || Boolean(await readWyMusicUCookies(loginSession));
      if (saved || hasMusicU) {
        await saveWyCookiesFromSession(loginSession);
      }
      resolve({ saved: saved || hasMusicU, hasMusicU });
      if (!loginWindow.isDestroyed()) loginWindow.close();
    };

    const onCookieChanged = (_event: Electron.Event, cookie: Cookie, _cause: string, removed: boolean) => {
      if (!removed && cookie.name === "MUSIC_U" && cookie.value) {
        void finish(true);
      }
    };

    loginSession.cookies.on("changed", onCookieChanged);
    loginWindow.on("closed", () => {
      void finish(false);
    });
    loginWindow.loadURL(
      loginUrl,
      mode === "mobile" ? { userAgent: WY_MOBILE_USER_AGENT } : undefined
    ).catch((error) => {
      logger.error("wy login window load failed", { message: error.message });
      void finish(false);
    });
  });
}

export async function getCookieAccountProfile(payload: { source: CookieSource }): Promise<CookieAccountProfile> {
  return payload.source === "kg" ? getKgAccountProfile() : getWyAccountProfile();
}

export async function getCookieUserPlaylists(payload: {
  source: CookieSource;
  page?: number;
  pageSize?: number;
  uid?: string | number;
  offset?: number;
}) {
  const endpoints = await getRuntimeEndpointsCached();
  if (payload.source === "kg") {
    return requestSignedGatewayWithCookie(
      buildUrl(endpoints.kgServer, "/user/playlist", {
        page: payload.page,
        pagesize: payload.pageSize,
      }),
      {
        store: getStore("kg"),
      }
    ).then((response) => response.data);
  }

  const uid = payload.uid || (await getWyAccountProfile()).userId;
  if (!uid) throw new Error("网易账号信息缺少 uid");
  return requestSignedGatewayWithCookie(
    buildUrl(endpoints.wyServer, "/user/playlist", {
      uid,
      limit: payload.pageSize,
      offset: payload.offset ?? ((payload.page ?? 1) - 1) * (payload.pageSize ?? 30),
    }),
    {
      store: getStore("wy"),
    }
  ).then((response) => response.data);
}

export async function getCookieDebugUserInfo(source: CookieSource): Promise<CookieDebugApiResult> {
  const endpoints = await getRuntimeEndpointsCached();
  const endpoint = source === "kg" ? "/user/detail" : "/user/account";
  const response = await requestSignedGatewayWithCookie(
    buildUrl(source === "kg" ? endpoints.kgServer : endpoints.wyServer, endpoint, {}),
    {
      store: getStore(source),
    }
  );
  return {
    source,
    endpoint,
    httpStatus: response.code,
    ok: response.ok,
    cookieHeaderForNextRequest: response.cookieHeaderForNextRequest,
    body: response.data,
  };
}

export async function exportCookieJsonFiles(): Promise<CookieFileExportResult> {
  const result = await dialog.showOpenDialog({
    title: "选择 Cookie 导出文件夹",
    properties: ["openDirectory", "createDirectory"],
  });
  if (result.canceled || !result.filePaths.length) {
    return { exported: false, directory: null, exportedFiles: [], skippedFiles: [] };
  }

  const directory = result.filePaths[0];
  const exportedFiles: string[] = [];
  const skippedFiles: string[] = [];
  for (const source of ["kg", "wy"] as const) {
    const store = getStore(source);
    store.getHeader();
    const sourcePath = store.getPath();
    const fileName = path.basename(sourcePath);
    const fileStat = await stat(sourcePath).catch(() => null);
    if (!fileStat || fileStat.size <= 0) {
      skippedFiles.push(fileName);
      continue;
    }
    const targetPath = path.join(directory, fileName);
    await copyFile(sourcePath, targetPath);
    exportedFiles.push(fileName);
  }

  return {
    exported: exportedFiles.length > 0,
    directory,
    exportedFiles,
    skippedFiles,
  };
}

async function getKgAccountProfile(): Promise<CookieAccountProfile> {
  const cookie = getStore("kg").getHeader();
  if (!cookie) return emptyProfile("kg");
  const cookieMap = parseCookieHeader(cookie);
  const token = cookieMap.get("token") ?? "";
  const userid = cookieMap.get("userid") ?? "";
  if (!token || !userid) return emptyProfile("kg");

  const endpoints = await getRuntimeEndpointsCached();
  const response = await requestSignedGatewayWithCookie<KgEnvelope>(
    buildUrl(endpoints.kgServer, "/login/token", { token, userid }),
    {
      store: getStore("kg"),
    }
  );
  const data = response.data?.data ?? {};
  return {
    source: "kg",
    loggedIn: response.data?.status === 1,
    userId: scalar(data.userid) || userid,
    nickname: scalar(data.nickname) || "酷狗用户",
    avatar: scalar(data.arttoy_avatar) || scalar(data.avatar) || scalar(data.pic),
    isVip: Number(data.vip_type ?? 0) > 0,
    expiresAt: scalar(data.vip_end_time),
    raw: response.data,
  };
}

async function getWyAccountProfile(): Promise<CookieAccountProfile> {
  const cookie = getStore("wy").getHeader();
  if (!cookie || !cookie.includes("MUSIC_U=")) return emptyProfile("wy");
  const endpoints = await getRuntimeEndpointsCached();
  const response = await requestSignedGatewayWithCookie<WyAccountResponse>(
    buildUrl(endpoints.wyServer, "/user/account", {}),
    {
      store: getStore("wy"),
    }
  );
  const account = response.data?.account;
  const profile = response.data?.profile;
  const userId = profile?.userId ?? account?.id ?? "";
  return {
    source: "wy",
    loggedIn: response.data?.code === 200 && Boolean(userId),
    userId: String(userId || ""),
    nickname: profile?.nickname || account?.userName || "网易云用户",
    avatar: profile?.avatarUrl || "",
    isVip: Boolean(account?.vipType || profile?.vipType),
    expiresAt: profile?.viptypeVersion ? new Date(profile.viptypeVersion).toISOString() : "",
    raw: response.data,
  };
}

async function finalizeKgLoginSession(token: string, userid: string) {
  const endpoints = await getRuntimeEndpointsCached();
  const response = await requestSignedGateway<KgEnvelope>(
    buildUrl(endpoints.kgServer, "/login/token", { token, userid })
  );
  assertKgSuccess(response, "failed to finalize kg login");
  const data = response.data ?? {};
  const vipType = scalar(data.vip_type) || "0";
  const vipToken = scalar(data.vip_token);
  const uid = scalar(data.userid);
  const nextToken = scalar(data.token);
  if (!vipToken || !uid || !nextToken) throw new Error("login/token missing vip_token/userid/token");

  getStore("kg").setCookie(
    `KUGOU_API_PLATFORM=undefined; token=${nextToken}; userid=${uid}; vip_type=${vipType}; vip_token=${vipToken}`
  );
}

async function readWyMusicUCookies(loginSession: Session) {
  const cookies = await loginSession.cookies.get({ name: "MUSIC_U" });
  return cookies.find((cookie) => cookie.name === "MUSIC_U" && cookie.value);
}

async function saveWyCookiesFromSession(loginSession: Session) {
  const musicU = await readWyMusicUCookies(loginSession);
  if (musicU) {
    getStore("wy").replaceElectronCookies([musicU]);
  }
}

function getStore(source: CookieSource) {
  stores[source] ??= new UserCookieStore(source);
  return stores[source];
}

function normalizeMobile(mobile: string) {
  const value = mobile.trim();
  if (!/^1\d{10}$/.test(value)) throw new Error("请输入正确的手机号");
  return value;
}

function assertKgSuccess(response: KgEnvelope | null, fallback: string) {
  if (!response || response.status !== 1) {
    throw new Error(response?.msg || response?.message || fallback);
  }
}

function requireKgQrKeyEnvelope(response: KgQrKeyEnvelope | null) {
  if (!response || response.status !== 1 || !response.data?.qrcode) {
    throw new Error("kg qr key api returned empty response");
  }
  return response as KgQrKeyEnvelope & { data: { qrcode: string; qrcode_img?: string } };
}

function normalizeQrImage(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:image") || trimmed.startsWith("http")) return trimmed;
  return `data:image/png;base64,${trimmed}`;
}

function scalar(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return "";
}

function emptyProfile(source: CookieSource): CookieAccountProfile {
  return {
    source,
    loggedIn: false,
    userId: "",
    nickname: "",
    avatar: "",
    isVip: false,
    expiresAt: "",
  };
}

type KgEnvelope = {
  status: number;
  error_code?: number;
  data?: Record<string, unknown>;
  msg?: string;
  message?: string;
};

type KgQrKeyEnvelope = {
  status: number;
  data?: {
    qrcode: string;
    qrcode_img?: string;
  };
};

type KgQrCreateEnvelope = {
  code?: number;
  status?: number;
  data?: {
    url?: string;
    base64?: string;
  };
};

type WyAccountResponse = {
  code: number;
  account?: {
    id?: number | string;
    userName?: string;
    vipType?: number;
  };
  profile?: {
    userId?: number | string;
    nickname?: string;
    avatarUrl?: string;
    vipType?: number;
    viptypeVersion?: number;
  };
};

app.on("before-quit", () => {
  kgQrSessions.clear();
});
