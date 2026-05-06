import {
  app,
  BrowserWindow,
  ipcMain,
  
  Menu,
  nativeImage,
  nativeTheme,
  screen,
  session,
  Tray,
  type BrowserWindowConstructorOptions,
} from "electron";
const { ipcRenderer } = require("electron");
import path, { dirname, join } from "path";
import { setupFileIpc, ipcMainEventHandle } from "./utils/operationBridge";
import { fileURLToPath } from "url";
import { logger } from "./utils/logger";
import { existsSync, mkdirSync, readFileSync, writeFile } from "fs";
import { appStore, collectStore } from "./store";

// 主窗口
let mainWindow: BrowserWindow | null = null;
// 桌面歌词窗口
let lyricWindow: BrowserWindow | null = null;
// cookie
let cookieWin: BrowserWindow | null = null;
// 音乐相关
let currentTime = 0;
let currentSong: {
  id: string;
  name: string;
  singer: string;
  cover: string;
  source: "wy" | "kg" | "kw";
  duration: number;
  coverSize?: {
    s: string;
    m: string;
    l: string;
    xl: string;
  };
} | null = null;
let AMLrc: Array<any> = [];
let AMKrc: Array<any> = [];
// 托盘
let tray: Tray | null = null;
const iconPath = path.join(__dirname, "../../public/tray", "logo-32.png");

try {
  // const isProd = process.env.NODE_ENV === "production";

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // if (isProd) {
  //   serve({ directory: path.join(__dirname, "../out", "renderer") });
  // } else {
  //   // 开发环境仍然使用 Vite/Webpack 开发服务器
  //   app.setPath("userData", `${app.getPath("userData")} (development)`);
  // }

  const preloadPath = join(__dirname, "../preload", "index.cjs");
  function createWindow() {
    mainWindow = new BrowserWindow({
      minWidth: 1200,
      minHeight: 800,
      frame: false,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        devTools: process.env.NODE_ENV === "development",
        sandbox: true,
      },
    });

    // mainWindow.loadURL("http://localhost:30000");
    // mainWindow.webContents.openDevTools();

    if (!app.isPackaged) {
      mainWindow.loadURL("http://localhost:30000");
      // mainWindow.loadFile(join(dirname(__dirname), 'renderer', 'index.html'));
      mainWindow.webContents.openDevTools();
    } else {
      // mainWindow.loadURL("app://./index.html");
      mainWindow.loadFile(join(dirname(__dirname), "renderer", "index.html"));
      // mainWindow.webContents.openDevTools();
    }

    mainWindow.on("maximize", () => {
      mainWindow?.webContents.send("window-maximized");
    });
    // 放入托盘
    mainWindow.on("hide", () => {
      mainWindow?.webContents.send("window-hide");
    });

    mainWindow.on("close", async () => {
      mainWindow = null;
      app.quit();
    });

    mainWindow.on("unmaximize", () => {
      mainWindow?.webContents.send("window-unmaximized");
    });

    ipcMain.on("window-reload", () => {
      mainWindow?.reload();
    });

    ipcMain.on("dev-tools", () => {
      mainWindow?.webContents.openDevTools();
    });

    ipcMain.on("collect-error", (_, e: any) => {
      logger.error("收集到错误:", e.message, "\n源：", e);
    });

    ipcMain.handle("store-get", (_, key) => {
      return appStore.get(key);
    });

    ipcMain.handle("store-set", (_, key, value) => {
      appStore.set(key, value);
      return true;
    });

    ipcMain.handle("store-delete", (_, key) => {
      appStore.delete(key);
      return true;
    });

    ipcMain.handle("store-clear", () => {
      appStore.clear();
      return true;
    });

    ipcMain.on("open-kg-window", (_, t: "kg" | "wy") => {
      loadKGCookieWindow(t);
    });

    ipcMain.handle("refresh-kg-cookie", (_, data: string) => {
      return refreshKG(data);
    });

    ipcMain.handle("read-cookie", (_, t: "kg" | "wy") => {
      return readCookie(t);
    });

    // 监听窗口操作事件
    ipcMainEventHandle(mainWindow);
    // Ipc
    setupFileIpc(mainWindow);
    setupWindowIpc();
    setupMusicIpc();
    setupLyricIpc();
  }

  app.whenReady().then(() => {
    createWindow();
    tray = new Tray(iconPath);
    tray.on("click", () => {
      if (mainWindow) {
        if (mainWindow.isVisible()) {
          mainWindow.focus();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    });
    refreshMenu();
  });

  app.on("window-all-closed", async () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (mainWindow === null) createWindow();
  });
} catch (error: any) {
  logger.error("主进程错误:", error.message);
}

function getPath(type: "dir" | "file", ...paths: string[]) {
  if (app.isPackaged) {
    const p = path.join(process.resourcesPath, ...paths);
    if (type == "dir" && !existsSync(p)) {
      mkdirSync(p, { recursive: true });
    }
    return p;
  } else {
    const p = path.join(...paths);
    if (type == "dir" && !existsSync(p)) {
      mkdirSync(p, { recursive: true });
    }
    return p;
  }
}

let desktopLyric = false;
let isPlaying = false;
const getTrayIcon = (name: string) => {
  const isDark = nativeTheme.shouldUseDarkColors;
  const filename = name + (isDark ? "-dark.png" : "-light.png");
  return nativeImage
    .createFromPath(path.join(__dirname, "../../public/tray", filename))
    .resize({ width: 16, height: 16 });
};

function refreshMenu() {
  let playingText = `${currentSong?.name} - ${currentSong?.singer}`;
  let rawText = `${currentSong?.name} - ${currentSong?.singer}`
  if (playingText.length > 20) {
    playingText = playingText.substring(0, 20) + "...";
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: currentSong ? playingText : "Pisa Music",
      icon: getTrayIcon("music"),
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: ((currentSong?.id || "-99") in collectStore.get("songs")) ? "取消收藏" : "加入收藏",
      icon: getTrayIcon(((currentSong?.id || "-99") in collectStore.get("songs")) ? "unlove":"love"),
      click: () => {
        if (currentSong) {
          if (((currentSong?.id || "-99") in collectStore.get("songs"))) {
            ipcRenderer.send("incollect-song", currentSong);
          } else {
            ipcRenderer.send("collect-song", currentSong);
          }
        }
        refreshMenu();
      },
    },
    {
      label: "上一曲",
      icon: getTrayIcon("prev"),
      click: () => {
        mainWindow?.webContents.send("media-control", "prev");
      },
    },
    {
      label: isPlaying ? "暂停" : "播放",
      icon: getTrayIcon(isPlaying ? "pause" : "play"),
      click: () => {
        mainWindow?.webContents.send(
          "media-control",
          isPlaying ? "pause" : "play"
        );
        isPlaying = !isPlaying;
        refreshMenu();
      },
    },
    {
      label: "下一曲",
      icon: getTrayIcon("next"),
      click: () => {
        mainWindow?.webContents.send("media-control", "next");
      },
    },
    {
      type: "checkbox",
      checked: desktopLyric,
      label: "桌面歌词",
      click: () => {
        createLyricsWindow();
      },
    },
    {
      type: "separator",
    },
    {
      id: "setting",
      label: "设置",
      icon: getTrayIcon("setting"),
    },
    {
      label: "退出",
      icon: getTrayIcon("power"),
      click: () => {
        app.quit(); // 退出应用
      },
    },
  ]);
  tray?.setContextMenu(contextMenu);
  tray?.setToolTip(isPlaying ? rawText : "Pisa Music");
}
function setupMusicIpc() {
  ipcMain.on("change-current-song", (_, song) => {
    currentSong = song;
  });

  

  ipcMain.on("is-playing", (_, _isPlaying) => {
    isPlaying = _isPlaying;
  });

  ipcMain.on("update-time", (_, time: number) => {
    if (lyricWindow == null || lyricWindow.isDestroyed()) {
      return;
    }
    if (time > 1000 && time > 3) {
      currentTime = Math.floor(time);
    } else {
      currentTime = Math.floor(time * 1000);
    }
    lyricWindow.webContents?.send("update-time", currentTime);
  });

  ipcMain.on("media-control", (_, action: "play" | "pause") => {
    switch (action) {
      case "play":
        lyricWindow?.webContents.send("play");
        break;
      case "pause":
        lyricWindow?.webContents.send("pause");
        break;
    }
  });
}
// 窗口相关
async function setupWindowIpc() {
  ipcMain.on("open-lyric-window", async () => {
    try {
      createLyricsWindow();
    } catch (error) {
      logger.error("创建桌面歌词窗口失败:", error);
      lyricWindow = null;
      createLyricsWindow();
    }
  });
  // 获取窗口位置
  ipcMain.handle("get-window-bounds", () => {
    if (lyricWindow?.isDestroyed()) return null;
    return lyricWindow?.getBounds();
  });

  // 获取屏幕尺寸
  ipcMain.handle("get-screen-size", () => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;
    return { width, height };
  });

  // 移动窗口
  ipcMain.on("move-window", (_, x, y, width, height) => {
    lyricWindow?.setBounds({ x, y, width, height });
    // 保存配置
    appStore.set("lyricConfig", {
      ...appStore.get("lyricConfig"),
      x,
      y,
      width,
      height,
    });
    // 保持置顶
    lyricWindow?.setAlwaysOnTop(true, "screen-saver");
  });

  // 来自歌词窗口的请求
  ipcMain.on(
    "lyric-media-control",
    (_, action: "play" | "pause" | "next" | "prev" | "close") => {
      switch (action) {
        case "play":
          lyricWindow?.webContents.send("play");
          break;
        case "pause":
          lyricWindow?.webContents.send("pause");
          break;
        case "close":
          lyricWindow?.close();
          mainWindow?.webContents.send("lyric-window-status", false);
          break;
      }
      mainWindow?.webContents.send("media-control", action);
    }
  );
}

function createLyricsWindow() {
  if (lyricWindow && lyricWindow?.isVisible() && !lyricWindow.isDestroyed()) {
    lyricWindow.close();
    appStore.set("lyricConfig.desktop", false);
    desktopLyric = false;
    return;
  }
  const lc = appStore.get("lyricConfig");
  desktopLyric = true;
  appStore.set("lyricConfig.desktop", true);
  // 初始化窗口
  lyricWindow = createWindow({
    frame: false,
    width: lc.width || 800,
    height: lc.height || 150,
    minWidth: lc.minWidth || 500,
    minHeight: lc.minHeight || 100,
    maxWidth: lc.maxWidth || 1200,
    maxHeight: lc.maxHeight || 300,
    x: lc.x || 100,
    y: lc.y || 100,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    // 不在任务栏显示
    skipTaskbar: false,
    // 窗口不能进入全屏状态
    fullscreenable: false,
    title: "Pisa Musc桌面歌词",
  });
  // 渲染路径
  lyricWindow.loadFile(path.join(__dirname, "./web/lyric-window.html"));
  // lyricWindow.webContents.openDevTools();

  function setupLyric() {
    if (!lyricWindow) return;
    if (AMKrc.length > 0) {
      lyricWindow.webContents.send("set-lyrics", AMKrc);
    } else if (AMLrc.length > 0) {
      lyricWindow.webContents.send("set-lyrics", AMLrc);
    }
    lyricWindow.webContents.send("set-lyric-style", lc);
    mainWindow?.webContents.send("lyric-window-status", true);
  }
  lyricWindow.on("show", setupLyric);
  lyricWindow.on("ready-to-show", setupLyric);

  // 窗口关闭时清理
  lyricWindow.on("closed", () => {
    lyricWindow = null;
    mainWindow?.webContents.send("lyric-window-status", false);
  });
}

function setupLyricIpc() {
  ipcMain.on(
    "set-lyrics",
    (_, lyric: { type: "krc" | "lrc"; data: string }) => {
      if (lyricWindow == null) return;
      console.log("set lyric");
      if (lyric.type == "krc") {
        AMKrc = JSON.parse(lyric.data);
        lyricWindow?.webContents.send("set-lyrics", AMKrc);
      } else {
        AMLrc = JSON.parse(lyric.data);
        lyricWindow?.webContents.send("set-lyrics", AMLrc);
      }
    }
  );

  ipcMain.on("set-lyric-style", (_, config: WindowLyricSetting) => {
    lyricWindow?.webContents.send("set-lyric-style", config);
  });

  ipcMain.on("change-font-size", (_, size: number) => {
    appStore.set("lyricConfig", {
      ...appStore.get("lyricConfig"),
      fontSize: size,
    });
    lyricWindow?.webContents.send("change-font-size", size);
  });

  ipcMain.on("lock-lyric", (_, lock: boolean) => {
    if (!lyricWindow) return;
    lyricWindow?.webContents.send("lock-lyric", lock);
    appStore.set("lyricConfig", {
      ...appStore.get("lyricConfig"),
      locked: lock,
    });
    // 是否穿透
    if (lock) {
      lyricWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      lyricWindow.setIgnoreMouseEvents(false);
    }
  });
}

function createWindow(
  options: BrowserWindowConstructorOptions = {}
): BrowserWindow {
  const defaultOptions: BrowserWindowConstructorOptions = {
    title: "Pisa Music",
    width: 1280,
    height: 720,
    frame: true,
    titleBarOverlay: true,
    titleBarStyle: "default",
    center: true,
    webPreferences: {
      // preload: path.join(__dirname, "../preload/index.mjs"),
      // 禁用渲染器沙盒
      sandbox: false,
      // 禁用同源策略
      webSecurity: false,
      // 允许 HTTP
      allowRunningInsecureContent: true,
      // 禁用拼写检查
      spellcheck: false,
      // 启用 Node.js
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      // 启用上下文隔离
      contextIsolation: false,
    },
  };
  // 合并参数
  options = Object.assign(defaultOptions, options);
  // 创建窗口
  const mainWindow = new BrowserWindow(options);
  return mainWindow;
}

async function loadKGCookieWindow(t: "kg" | "wy") {
  const url = t === "kg" ? "https://www.kugou.com" : "https://music.163.com";
  cookieWin = createWindow({
    width: 1200,
    height: 800,
    title: "点击右上角扫码登录，成功后关闭本窗口",
    webPreferences: {
      // 禁用渲染器沙盒
      sandbox: false,
      // 禁用同源策略
      webSecurity: false,
      // 允许 HTTP
      allowRunningInsecureContent: true,
    },
  });
  await cookieWin.loadURL(url);
  cookieWin.show();
  cookieWin.webContents.executeJavaScript(`alert("请登录后关闭本窗口")`, true);
  cookieWin.setTitle("请登录后关闭本窗口");
  cookieWin.on("closed", async () => {
    const cookie = await session.defaultSession.cookies.get({
      url: url,
    });
    saveCookie(t, cookie);
    cookieWin?.close();
  });
}

function refreshKG(r: string) {
  try {
    const res = JSON.parse(r) as kgResponse;
    const token = res.data.token;
    const userid = res.data.userid;
    const vtoken = res.data.vip_token;
    const vtype = res.data.vip_type;
    const cstr = `KUGOU_API_PLATFORM=undefined; token=${token}; userid=${userid}; vip_type=${vtype}; vip_token=${vtoken}`;
    const newc = parseCookies(cstr);
    saveCookie("kgR", newc);
    return {
      success: true,
      message: "刷新成功",
      data: { token, userid, vip_type: vtype, vip_token: vtoken },
    };
  } catch (error: any) {
    return {
      success: false,
      message: "刷新失败",
      data: error.message,
    };
  }
}

function readCookie(origin: "kg" | "wy" | "kgR") {
  const p = getPath("dir", "data", "customCookie");
  return readFileSync(getPath("file", p, origin + ".json")).toString() || "[]";
}

function saveCookie(origin: "kg" | "wy" | "kgR", cookie: any) {
  const p = getPath("dir", "data", "customCookie");
  writeFile(
    getPath("file", p, origin + ".json"),
    JSON.stringify(cookie),
    (e) => {
      if (e) {
        logger.error("保存cookie失败:", e.message);
        return;
      }
      logger.info("保存kg-cookie成功");
    }
  );
}

export interface kgResponse {
  data: kgData;
  status: number;
  error_code: number;
}

export interface kgData {
  is_vip: number;
  servertime: string;
  roam_type: number;
  t1: string;
  reg_time: string;
  vip_type: number;
  vip_begin_time: string;
  userid: number;
  su_vip_end_time: string;
  sex: number;
  user_type: number;
  username: string;
  qq: number;
  exp: number;
  m_end_time: string;
  score: number;
  m_is_old: number;
  birthday: string;
  arttoy_avatar: string;
  totp_server_timestamp: number;
  roam_end_time: string;
  su_vip_begin_time: string;
  roam_begin_time: string;
  vip_end_time: string;
  secu_params: string;
  nickname: string;
  mobile: number;
  user_y_type: number;
  vip_token: string;
  bc_code: string;
  m_type: number;
  m_begin_time: string;
  pic: string;
  su_vip_clearday: string;
  t_expire_time: number;
  su_vip_y_endtime: string;
  birthday_mmdd: string;
  y_type: number;
  wechat: number;
  token: string;
}

export interface Cookie {
  name: string;
  value: string;
  path: string;
  expires: string;
}

function parseCookies(cookieString: string): Cookie[] {
  console.log(cookieString);
  const cookies: Cookie[] = [];
  const cookieParts = cookieString.split(";"); // 分割 cookie 的属性
  for (const cookiePart of cookieParts) {
    const [name, value] = cookiePart.trim().split("=");
    if (name == "PATH") {
      continue;
    }
    const date = new Date();
    // 永不过期
    date.setFullYear(date.getFullYear() + 50);
    const expires = { expires: date.toUTCString() };
    const cookie: Cookie = {
      name: name,
      value: value,
      ...expires,
      path: "/",
    };
    cookies.push(cookie);
  }
  return cookies;
}
