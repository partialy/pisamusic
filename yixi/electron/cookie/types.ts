export type CookieSource = "kg" | "wy";

export type CookieEntry = {
  name: string;
  value: string;
  path: string;
  expires: string;
};

export type CookieFileData = {
  cookies: CookieEntry[];
};

export type CookieAccountProfile = {
  source: CookieSource;
  loggedIn: boolean;
  userId: string;
  nickname: string;
  avatar: string;
  isVip: boolean;
  expiresAt: string;
  raw?: unknown;
};

export type CookieRefreshResult = {
  source: CookieSource;
  success: boolean;
  refreshed: boolean;
  message: string;
  profile?: CookieAccountProfile;
  lastRefreshAt?: string;
};

export type KgQrLoginSnapshot = {
  loginId: string;
  qrcodeImg: string;
};

export type KgQrLoginStatus = {
  status: "waiting" | "confirming" | "expired" | "success" | "failed";
  message?: string;
  nickname?: string;
  avatar?: string;
  saved: boolean;
};

export type WyLoginWindowMode = "pc" | "mobile";

export type WyLoginWindowResult = {
  saved: boolean;
  hasMusicU: boolean;
};

export type CookieDebugApiResult = {
  source: CookieSource;
  endpoint: string;
  httpStatus: number;
  ok: boolean;
  cookieHeaderForNextRequest: string;
  body: unknown;
};

export type CookieFileExportResult = {
  exported: boolean;
  directory: string | null;
  exportedFiles: string[];
  skippedFiles: string[];
};
