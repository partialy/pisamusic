import { ipcMain } from "electron";
import {
  clearUserCookie,
  exportCookieJsonFiles,
  getCookieAccountProfile,
  getCookieDebugUserInfo,
  getCookieUserPlaylists,
  getUserCookie,
  kgCheckQrLogin,
  kgLoginWithCode,
  kgSendCaptcha,
  kgStartQrLogin,
  refreshCookieAccount,
  wyOpenLoginWindow,
} from "../cookie/cookieService";
import type { CookieSource, WyLoginWindowMode } from "../cookie/types";

let registered = false;

export function setupCookieIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("cookie:get-cookie", (_event, source: CookieSource) => getUserCookie(source));
  ipcMain.handle("cookie:clear-cookie", (_event, source: CookieSource) => clearUserCookie(source));
  ipcMain.handle("cookie:kg-send-captcha", (_event, payload: { mobile: string }) =>
    kgSendCaptcha(payload)
  );
  ipcMain.handle("cookie:kg-login-with-code", (_event, payload: { mobile: string; code: string }) =>
    kgLoginWithCode(payload)
  );
  ipcMain.handle("cookie:kg-start-qr-login", () => kgStartQrLogin());
  ipcMain.handle("cookie:kg-check-qr-login", (_event, payload: { loginId: string }) =>
    kgCheckQrLogin(payload)
  );
  ipcMain.handle("cookie:wy-open-login-window", (_event, payload: { mode: WyLoginWindowMode }) =>
    wyOpenLoginWindow(payload)
  );
  ipcMain.handle("cookie:account-profile", (_event, payload: { source: CookieSource }) =>
    getCookieAccountProfile(payload)
  );
  ipcMain.handle("cookie:refresh-account", (_event, payload: { source: CookieSource }) =>
    refreshCookieAccount(payload)
  );
  ipcMain.handle("cookie:debug-user-info", (_event, source: CookieSource) =>
    getCookieDebugUserInfo(source)
  );
  ipcMain.handle("cookie:export-files", () => exportCookieJsonFiles());
  ipcMain.handle(
    "cookie:user-playlists",
    (
      _event,
      payload: {
        source: CookieSource;
        page?: number;
        pageSize?: number;
        uid?: string | number;
        offset?: number;
      }
    ) => getCookieUserPlaylists(payload)
  );
}
