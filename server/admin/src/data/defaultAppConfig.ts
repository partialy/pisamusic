import { DEFAULT_PLAINTEXT_PATHS, type AppConfigJson } from "../types/config";

/** 与后端 data/app-config.json 结构一致，用于首次加载失败时的占位 */
export const defaultAppConfig: AppConfigJson = {
  availability: {
    appAvailable: true,
    unavailableReason: "Service is under maintenance",
  },
  email: {
    serviceUrl: "https://gateway.partialy.cn/email-service/api/send",
  },
  bootstrap: {
    version: "v1.0.0",
    updatedAt: 1749520800000,
    endpoints: {
      kgBaseUrl: "https://gateway.partialy.cn/kg-service/",
      wyBaseUrl: "https://gateway.partialy.cn/wy-service/",
      proxyBaseUrl: "https://gateway.partialy.cn/proxy-service/",
      kwBaseUrl: "https://gateway.partialy.cn/proxy-service/proxy/kw/",
      kgSongUrl: "https://gateway.partialy.cn/proxy-service/proxy/kg/song/url",
      wySongUrl: "https://gateway.partialy.cn/proxy-service/proxy/wy/song/url",
      wySongUrlV1: "https://gateway.partialy.cn/proxy-service/proxy/wy/song/url/v1",
    },
    gatewaySign: {
      secret: "partialypartialypartialypartialy",
      as: "yixivip",
    },
    updater: {
      desktop: {
        enabled: true,
        feedBaseUrl: "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64",
        checkOnStartup: true,
        startupDelayMs: 15000,
      },
    },
  },
  update: {
    latestVersion: "v2.1.1",
    updateTime: "2025-6-10 10:00",
    forceUpdate: false,
    downloadUrl: "https://cloudreve.yixivip.top/f/yMtV/echo_v1.1.0.apk",
    officialUrl: "https://pisamusic.partialy.cn",
    updateContent: "1, Fix known issues;2, Improve splash flow",
  },
  releases: {
    android: {
      latestVersion: "v2.1.1",
      updateTime: "2025-6-10 10:00",
      forceUpdate: false,
      downloadUrl: "https://cloudreve.yixivip.top/f/yMtV/echo_v1.1.0.apk",
      officialUrl: "https://pisamusic.partialy.cn",
      updateContent: "1, Fix known issues;2, Improve splash flow",
      platformLabel: "Android",
      fileSizeText: "26.7MB",
      available: true,
    },
    desktop: {
      latestVersion: "v0.0.0",
      updateTime: "",
      forceUpdate: false,
      downloadUrl: "",
      officialUrl: "https://pisamusic.partialy.cn",
      updateContent: "PC 版正在准备中。",
      platformLabel: "PC 版",
      fileSizeText: "",
      available: false,
    },
  },
  agreement: {
    title: "Service Agreement and Privacy",
    content:
      "<div><p>Welcome to PisaMusic. Please read and agree to the User Agreement and Privacy Policy before using the app.</p><p>To provide music playback and download features, network and local storage access are required.</p></div>",
  },
  privacy: {
    title: "Privacy Policy",
    content:
      "<div><p>We respect and protect your privacy. PisaMusic only collects the minimum data required for core features and never sells personal data.</p><p>For account-related features and download records, data is handled under applicable laws and user consent.</p></div>",
  },
  about: {
    appName: "PisaMusic",
    websiteLabel: "pisamusic.partialy.cn",
    websiteUrl: "https://pisamusic.partialy.cn",
    description:
      "PisaMusic 是一款极简纯粹的多音源音乐播放器。我们致力于打破平台壁垒，为您聚合全网优质无损音乐。没有繁杂的社交，没有烦人的广告，在这里，只有纯粹的聆听。",
    team: "Pisa Team",
    copyright: "Copyright © 2026 PisaMusic. All Rights Reserved.",
  },
  discover: {
    url: "USE_LOCAL_FILE",
    updatedAt: 0,
  },
  encryption: {
    plaintextPaths: [...DEFAULT_PLAINTEXT_PATHS],
  },
};
