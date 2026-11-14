/** App 推广专用 DTO，与歌曲/歌单分享独立；不含任何认证凭据。 */
export type AppShareConfig = {
  appName: string;
  version: string;
  iconUrl: string;
  description: string;
  qrCodeText: string;
  copyText: string;
  updatedAt: number;
  shareCode?: string;
  trackingEnabled: boolean;
};

export type AppShareResult = {
  identityRevision: number;
  config: AppShareConfig | null;
  verified: boolean;
  cached: boolean;
  error: string;
};
