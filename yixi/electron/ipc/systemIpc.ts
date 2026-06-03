import { ipcMain } from "electron";
import {
  getAnnouncements,
  getAboutInfo,
  changeAccountPassword,
  getAccountAvatarOptions,
  getAppVersion,
  clearAccountSession,
  getBootstrap,
  getAccountSession,
  getPrivacyPolicy,
  getRuntimeEndpointsCached,
  getRuntimeEndpointsFresh,
  getServiceAgreement,
  getStartupServiceState,
  getSystemBaseUrl,
  loginAccountByCode,
  loginAccountByPassword,
  refreshAccountSession,
  registerAccount,
  resetAccountPassword,
  sendAccountEmailCode,
  sendProfileEmailCode,
  submitFeedback,
  updateAccountProfile,
} from "../system/systemClient";
import { clearSyncState } from "../sync/syncService";
import type { FeedbackPayload } from "../system/types";

let registered = false;

export function setupSystemIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("system:get-base-url", () => {
    return getSystemBaseUrl();
  });

  ipcMain.handle("system:get-app-version", () => {
    return getAppVersion();
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

  ipcMain.handle("system:get-about-info", () => {
    return getAboutInfo();
  });

  ipcMain.handle("system:get-service-agreement", () => {
    return getServiceAgreement();
  });

  ipcMain.handle("system:get-privacy-policy", () => {
    return getPrivacyPolicy();
  });

  ipcMain.handle("system:submit-feedback", (_event, payload: FeedbackPayload) => {
    return submitFeedback(payload);
  });

  ipcMain.handle("account:session", () => getAccountSession());
  ipcMain.handle("account:avatar-options", () => getAccountAvatarOptions());
  ipcMain.handle("account:refresh", () => refreshAccountSession());
  ipcMain.handle("account:logout", async () => {
    const session = clearAccountSession();
    await clearSyncState();
    return session;
  });
  ipcMain.handle("account:send-email-code", (_event, payload: { email: string; purpose: "register" | "login" | "reset_password" }) =>
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
  ipcMain.handle("account:change-password", (_event, payload: { currentPassword: string; newPassword: string }) =>
    changeAccountPassword(payload)
  );
  ipcMain.handle("account:reset-password", (_event, payload: { email: string; code: string; newPassword: string }) =>
    resetAccountPassword(payload)
  );
}
