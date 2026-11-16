import { ipcMain } from "electron";
import type { LowPowerManager } from "../power/lowPowerManager";

let registered = false;

export function setupLowPowerIpc(manager: LowPowerManager): void {
  if (registered) return;
  registered = true;

  ipcMain.handle("low-power:get-state", () => manager.getState());
  ipcMain.handle("low-power:set-auto", (_event, enabled: unknown) =>
    manager.setAutoLowPower(Boolean(enabled)),
  );
  ipcMain.handle("low-power:enter", (_event, options?: { hideWindow?: boolean }) =>
    manager.enter("manual", { hideWindow: options?.hideWindow ?? true }),
  );
  ipcMain.handle("low-power:exit", (_event, options?: { showWindow?: boolean }) =>
    manager.exit({ showWindow: options?.showWindow ?? true }),
  );
}
