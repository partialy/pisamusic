import Store from "electron-store";
import { app } from "electron";
import path from "path";

interface AppStoreSchema {
  // 应用配置
  appConfig: {
    theme: "light" | "dark" | "system";
    window: { width: number; height: number; center?: boolean };
    autoLaunch: boolean;
    closeType: "ask" | "minimize" | "exit";
  };
  lyricConfig: {
    desktop: boolean;
    overlayTaskbar: boolean;
    autoFontSize: boolean;
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    maxWidth: number;
    maxHeight: number;
    x: number;
    y: number;
    maxSize: number;
    minSize: number;
    fontSize: number;
    locked: boolean;
    textColor: string;
    highlightColor: string;
    fontFamily: string;
    fontWeight: string | number;
  };
  // 用户数据
  userInfo: {
    username: string;
    lastLoginTime: string;
  };
  // 自定义缓存
  cache: Record<string, any>;
}

const defaultSettings: AppStoreSchema = {
  // 默认值（推荐配置，避免读取未定义属性）
  appConfig: {
    theme: "light",
    window: { width: 1280, height: 720, center: true },
    closeType: "ask",
    autoLaunch: false,
  },
  lyricConfig: {
    desktop: false,
    overlayTaskbar: false,
    autoFontSize: true,
    width: 800,
    height: 120,
    minHeight: 100,
    minWidth: 500,
    maxHeight: 200,
    maxWidth: 1600,
    x: 100,
    y: 100,
    maxSize: 64,
    minSize: 10,
    fontSize: 40,
    locked: false,
    textColor: "#ffffff",
    highlightColor: "#ff0000",
    fontFamily: "Microsoft YaHei",
    fontWeight: 600,
  },
  userInfo: {
    username: "",
    lastLoginTime: "",
  },
  cache: {},
};

// 初始化 Electron Store
const appStore = new Store<AppStoreSchema>({
  // 配置项（可选，根据需求调整）
  name: "app-settings", // 存储文件名称（默认 config）
  fileExtension: "json", // 存储文件后缀（默认 json）
  cwd: path.join(app.getPath("userData"), "store"), // 存储目录（默认 app.getPath('userData')）
  defaults: defaultSettings, // 默认配置
  encryptionKey: "partialy", // 可选：加密存储内容（提高安全性）
  clearInvalidConfig: true, // 自动清除无效配置
  watch: true,
});

export { appStore };
