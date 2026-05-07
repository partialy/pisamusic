import { ipcMain } from "electron";
import {
  getAnnouncements,
  getBootstrap,
  getRuntimeEndpointsCached,
  getRuntimeEndpointsFresh,
  getSystemBaseUrl,
  submitFeedback,
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

  ipcMain.handle("system:get-runtime-endpoints", (_event, fresh?: boolean) => {
    return fresh ? getRuntimeEndpointsFresh() : getRuntimeEndpointsCached();
  });

  ipcMain.handle("system:get-announcements", () => {
    return getAnnouncements();
  });

  ipcMain.handle("system:submit-feedback", (_event, payload: FeedbackPayload) => {
    return submitFeedback(payload);
  });
}
