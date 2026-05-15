import { reportError } from "@/utils/errorReporter";

export type CookieSource = "kg" | "wy";

export type CookieAccountProfile = {
  source: CookieSource;
  loggedIn: boolean;
  userId: string;
  nickname: string;
  avatar: string;
  isVip: boolean;
  expiresAt: string;
  raw?: unknown;
};

export type CookieRefreshResult = {
  source: CookieSource;
  success: boolean;
  refreshed: boolean;
  message: string;
  profile?: CookieAccountProfile;
  lastRefreshAt?: string;
};

export type KgQrLoginSnapshot = {
  loginId: string;
  qrcodeImg: string;
};

export type KgQrLoginStatus = {
  status: "waiting" | "confirming" | "expired" | "success" | "failed";
  message?: string;
  nickname?: string;
  avatar?: string;
  saved: boolean;
};

export type CookieDebugApiResult = {
  source: CookieSource;
  endpoint: string;
  httpStatus: number;
  ok: boolean;
  cookieHeaderForNextRequest: string;
  body: unknown;
};

export type CookieFileExportResult = {
  exported: boolean;
  directory: string | null;
  exportedFiles: string[];
  skippedFiles: string[];
};

export function getUserCookie(source: CookieSource) {
  return invokeCookieApi("getUserCookie", { source }, () => window.electronAPI.getUserCookie(source));
}

export function clearUserCookie(source: CookieSource) {
  return invokeCookieApi("clearUserCookie", { source }, () => window.electronAPI.clearUserCookie(source));
}

export function kgSendCaptcha(mobile: string) {
  return invokeCookieApi("kgSendCaptcha", { mobile }, () => window.electronAPI.kgSendCaptcha({ mobile }));
}

export function kgLoginWithCode(mobile: string, code: string) {
  return invokeCookieApi("kgLoginWithCode", { mobile }, () =>
    window.electronAPI.kgLoginWithCode({ mobile, code })
  );
}

export function kgStartQrLogin() {
  return invokeCookieApi("kgStartQrLogin", {}, () => window.electronAPI.kgStartQrLogin());
}

export function kgCheckQrLogin(loginId: string) {
  return invokeCookieApi("kgCheckQrLogin", { loginId }, () =>
    window.electronAPI.kgCheckQrLogin({ loginId })
  );
}

export function wyOpenLoginWindow(mode: "pc" | "mobile") {
  return invokeCookieApi("wyOpenLoginWindow", { mode }, () =>
    window.electronAPI.wyOpenLoginWindow({ mode })
  );
}

export function getCookieAccountProfile(source: CookieSource) {
  return invokeCookieApi("getCookieAccountProfile", { source }, () =>
    window.electronAPI.getCookieAccountProfile({ source })
  );
}

export function refreshCookieAccount(source: CookieSource) {
  return invokeCookieApi("refreshCookieAccount", { source }, () =>
    window.electronAPI.refreshCookieAccount({ source })
  );
}

export function getCookieDebugUserInfo(source: CookieSource) {
  return invokeCookieApi("getCookieDebugUserInfo", { source }, () =>
    window.electronAPI.getCookieDebugUserInfo(source)
  );
}

export function exportCookieFiles() {
  return invokeCookieApi("exportCookieFiles", {}, () => window.electronAPI.exportCookieFiles());
}

export function getCookieUserPlaylists<T = any>(payload: {
  source: CookieSource;
  page?: number;
  pageSize?: number;
  uid?: string | number;
  offset?: number;
}) {
  return invokeCookieApi<T>("getCookieUserPlaylists", payload, () =>
    window.electronAPI.getCookieUserPlaylists<T>(payload)
  );
}

export function getWyCloudSongs<T = any>(payload: {
  page?: number;
  pageSize?: number;
  offset?: number;
}) {
  return invokeCookieApi<T>("getWyCloudSongs", payload, () =>
    window.electronAPI.getWyCloudSongs<T>(payload)
  );
}

async function invokeCookieApi<T>(
  action: string,
  payload: Record<string, unknown>,
  invoker: () => Promise<T>
) {
  try {
    return await invoker();
  } catch (error) {
    void reportError(error, {
      scope: "cookie",
      action,
      payload,
    });
    throw error;
  }
}
