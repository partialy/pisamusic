import { BrowserWindow, ipcMain } from "electron";
import { PlayerControlsActivityTracker } from "../playerControls/playerControlsActivityTracker";

let tracker: PlayerControlsActivityTracker | null = null;
let isRegistered = false;

export function setupPlayerControlsIpc(getMainWindow: () => BrowserWindow | null): void {
  tracker ??= new PlayerControlsActivityTracker(getMainWindow);

  if (!isRegistered) {
    isRegistered = true;

    ipcMain.on("player-controls:tracking:start", (event) => {
      const win = getMainWindow();
      if (!win || event.sender.id !== win.webContents.id) return;
      tracker?.start(event.sender);
    });

    ipcMain.on("player-controls:tracking:stop", (event) => {
      const win = getMainWindow();
      if (!win || event.sender.id !== win.webContents.id) return;
      tracker?.stop(event.sender.id);
    });

    ipcMain.on("player-controls:interaction", (event) => {
      const win = getMainWindow();
      if (!win || event.sender.id !== win.webContents.id) return;
      tracker?.markRendererInteraction(event.sender.id);
    });
  }
}

export function disposePlayerControlsIpc(): void {
  tracker?.dispose();
  tracker = null;
}
