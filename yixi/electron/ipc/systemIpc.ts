import { ipcMain } from "electron";
import {
  getAnnouncements,
  getAccountAvatarOptions,
  clearAccountSession,
  getBootstrap,
  getAccountSession,
  getRuntimeEndpointsCached,
  getRuntimeEndpointsFresh,
  getStartupServiceState,
  getSystemBaseUrl,
  loginAccountByCode,
  loginAccountByPassword,
  refreshAccountSession,
  registerAccount,
  sendAccountEmailCode,
  sendProfileEmailCode,
  submitFeedback,
  updateAccountProfile,
} from "../system/systemClient";
import type { FeedbackPayload } from "../system/types";

let registered = false;

export function setupSystemIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("system:get-base-url", () => {
    return getSystemBaseUrl();
  });

  ipcMain.handle("system:get-bootstrap", () => {
    return getBootstrap();
  });

  ipcMain.handle("system:get-startup-service-state", () => {
    return getStartupServiceState();
  });

  ipcMain.handle("system:get-runtime-endpoints", (_event, fresh?: boolean) => {
    return fresh ? getRuntimeEndpointsFresh() : getRuntimeEndpointsCached();
  });

  ipcMain.handle("system:get-announcements", () => {
    return getAnnouncements();
  });

  ipcMain.handle("system:submit-feedback", (_event, payload: FeedbackPayload) => {
    return submitFeedback(payload);
  });

  ipcMain.handle("account:session", () => getAccountSession());
  ipcMain.handle("account:avatar-options", () => getAccountAvatarOptions());
  ipcMain.handle("account:refresh", () => refreshAccountSession());
  ipcMain.handle("account:logout", () => clearAccountSession());
  ipcMain.handle("account:send-email-code", (_event, payload: { email: string; purpose: "register" | "login" }) =>
    sendAccountEmailCode(payload)
  );
  ipcMain.handle("account:login-password", (_event, payload: { identifier: string; password: string }) =>
    loginAccountByPassword(payload)
  );
  ipcMain.handle("account:login-code", (_event, payload: { email: string; code: string }) =>
    loginAccountByCode(payload)
  );
  ipcMain.handle("account:register", (_event, payload: { email: string; username: string; password: string; code: string }) =>
    registerAccount(payload)
  );
  ipcMain.handle("account:profile-email-code", (_event, payload: { email: string }) =>
    sendProfileEmailCode(payload)
  );
  ipcMain.handle(
    "account:update-profile",
    (_event, payload: { username?: string; email?: string; code?: string; avatarKey?: string }) =>
      updateAccountProfile(payload)
  );
}
