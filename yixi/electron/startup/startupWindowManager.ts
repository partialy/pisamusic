import { app, BrowserWindow, ipcMain, type BrowserWindowConstructorOptions } from "electron";
import { pathToFileURL } from "url";
import { getAppDatabase } from "../database";
import { logger } from "../utils/logger";

export type StartupWindowMode = "agreement" | "loading";

type StartupAgreementRecord = {
  accepted: boolean;
  version: number;
  acceptedAt: string;
};

type StartupWindowManagerOptions = {
  htmlPath: string;
  iconPath: string;
  onAccepted: () => void;
  onRejected: () => void;
};

export const STARTUP_AGREEMENT_SETTING_KEY = "startup-user-agreement";

export class StartupWindowManager {
  private startupWindow: BrowserWindow | null = null;
  private readonly htmlPath: string;
  private readonly iconPath: string;
  private readonly onAccepted: () => void;
  private readonly onRejected: () => void;
  private mode: StartupWindowMode = "loading";
  private registered = false;

  constructor(options: StartupWindowManagerOptions) {
    this.htmlPath = options.htmlPath;
    this.iconPath = options.iconPath;
    this.onAccepted = options.onAccepted;
    this.onRejected = options.onRejected;
  }

  setupIpc() {
    if (this.registered) return;
    this.registered = true;

    ipcMain.on("startup:splash-ready", () => {
      this.pushSnapshot();
    });

    ipcMain.handle("startup:agree", () => {
      this.acceptAgreement();
      return true;
    });

    ipcMain.handle("startup:reject", () => {
      this.onRejected();
      return true;
    });
  }

  hasAcceptedAgreement() {
    const record = getAppDatabase().getSetting<StartupAgreementRecord>(
      STARTUP_AGREEMENT_SETTING_KEY
    );
    return Boolean(record?.value?.accepted);
  }

  open(mode: StartupWindowMode) {
    this.mode = mode;

    if (this.startupWindow && !this.startupWindow.isDestroyed()) {
      this.resizeToMode();
      this.startupWindow.show();
      this.pushSnapshot();
      return;
    }

    this.startupWindow = new BrowserWindow({
      title: "PisaMusic 启动",
      icon: this.iconPath,
      width: mode === "agreement" ? 620 : 520,
      height: mode === "agreement" ? 520 : 280,
      frame: false,
      transparent: true,
      resizable: false,
      fullscreenable: false,
      show: false,
      center: true,
      skipTaskbar: true,
      hasShadow: false,
      webPreferences: {
        sandbox: false,
        webSecurity: false,
        allowRunningInsecureContent: true,
        spellcheck: false,
        nodeIntegration: true,
        contextIsolation: false,
      },
    } satisfies BrowserWindowConstructorOptions);

    this.startupWindow.once("ready-to-show", () => {
      this.resizeToMode();
      this.startupWindow?.show();
      this.pushSnapshot();
    });

    this.startupWindow.on("closed", () => {
      this.startupWindow = null;
    });

    this.startupWindow.loadFile(this.htmlPath).catch((error) => {
      logger.error("load startup window failed", {
        message: error?.message,
        stack: error?.stack,
      });
    });
  }

  showLoading() {
    this.mode = "loading";
    this.resizeToMode();
    this.pushSnapshot();
  }

  close() {
    if (!this.startupWindow || this.startupWindow.isDestroyed()) return;
    const win = this.startupWindow;
    this.startupWindow = null;
    win.close();
  }

  destroy() {
    this.close();
  }

  focus() {
    if (!this.startupWindow || this.startupWindow.isDestroyed()) return;
    this.startupWindow.show();
    this.startupWindow.focus();
  }

  private acceptAgreement() {
    getAppDatabase().setSetting(
      STARTUP_AGREEMENT_SETTING_KEY,
      {
        accepted: true,
        version: 1,
        acceptedAt: new Date().toISOString(),
      } satisfies StartupAgreementRecord,
      1
    );
    this.showLoading();
    this.onAccepted();
  }

  private resizeToMode() {
    if (!this.startupWindow || this.startupWindow.isDestroyed()) return;
    const size = this.mode === "agreement" ? [620, 520] : [520, 280];
    this.startupWindow.setSize(size[0], size[1]);
    this.startupWindow.center();
  }

  private pushSnapshot() {
    if (!this.startupWindow || this.startupWindow.isDestroyed()) return;
    if (this.startupWindow.webContents.isDestroyed()) return;

    this.startupWindow.webContents.send("startup:snapshot", {
      mode: this.mode,
      logoUrl: pathToFileURL(this.iconPath).toString(),
      appVersion: app.getVersion(),
    });
  }
}
