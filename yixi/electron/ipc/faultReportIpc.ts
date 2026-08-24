import { ipcMain } from "electron";
import {
  getDesktopFaultReportStats,
  submitPendingDesktopFaultReport,
} from "../faultReport/desktopFaultReportService";

let registered = false;

export function setupFaultReportIpc() {
  if (registered) return;
  registered = true;

  ipcMain.handle("fault-report:stats", () => getDesktopFaultReportStats());
  ipcMain.handle("fault-report:submit-pending", () => submitPendingDesktopFaultReport());
}
