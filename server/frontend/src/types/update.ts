export type ApiResponse<T> = {
  msg: string;
  code: number;
  data: T | null;
  success: boolean;
};

export type AppUpdateInfo = {
  latestVersion: string;
  updateTime: string;
  forceUpdate: boolean;
  downloadUrl: string;
  officialUrl: string;
  updateContent: string;
};

export type ReleaseInfo = AppUpdateInfo & {
  platformLabel: string;
  fileSizeText: string;
  available: boolean;
};

export type ReleaseConfig = {
  android: ReleaseInfo;
  desktop: ReleaseInfo;
};
