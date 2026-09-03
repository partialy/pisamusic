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

export type StartupAgreementContent = {
  title: string;
  content: string;
  version: number;
};

type StartupWindowManagerOptions = {
  htmlPath: string;
  iconPath: string;
  onAccepted: () => void;
  onRejected: () => void;
};

export const STARTUP_AGREEMENT_SETTING_KEY = "startup-user-agreement";
const DEFAULT_AGREEMENT_CONTENT: StartupAgreementContent = {
  title: "用户协议与隐私提示",
  content: "欢迎使用 PisaMusic。当前暂未获取到最新协议内容，请稍后重试。",
  version: 1,
};

export class StartupWindowManager {
  private startupWindow: BrowserWindow | null = null;
  private readonly htmlPath: string;
  private readonly iconPath: string;
  private readonly onAccepted: () => void;
  private readonly onRejected: () => void;
  private mode: StartupWindowMode = "loading";
  private agreementContent: StartupAgreementContent = DEFAULT_AGREEMENT_CONTENT;
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

  hasAcceptedAgreement(version?: number) {
    const record = getAppDatabase().getSetting<StartupAgreementRecord>(
      STARTUP_AGREEMENT_SETTING_KEY
    );
    if (!record?.value?.accepted) return false;
    return version === undefined || record.value.version === version;
  }

  setAgreementContent(content: StartupAgreementContent | null) {
    if (!content) return;
    this.agreementContent = {
      title: content.title.trim() || DEFAULT_AGREEMENT_CONTENT.title,
      content: content.content.replace(/\r\n?/g, "\n").trim() || DEFAULT_AGREEMENT_CONTENT.content,
      version: Number.isFinite(content.version) && content.version > 0 ? content.version : 1,
    };
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
        version: this.agreementContent.version,
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
      agreementTitle: this.agreementContent.title,
      agreementContent: this.agreementContent.content,
      agreementVersion: this.agreementContent.version,
    });
  }
}
