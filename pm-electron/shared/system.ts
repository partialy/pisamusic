export interface ApiResponse<T> {
  msg: string;
  code: number;
  success?: boolean;
  data: T;
}

export interface BootstrapConfigData {
  version?: string;
  updatedAt?: number;
  endpoints: BootstrapEndpoints;
  gatewaySign: GatewaySignConfig;
}

export interface BootstrapEndpoints {
  kgBaseUrl: string;
  wyBaseUrl: string;
  proxyBaseUrl: string;
  kwBaseUrl: string;
  kgSongUrl: string;
  wySongUrl: string;
  wySongUrlV1: string;
}

export interface GatewaySignConfig {
  secret: string;
  as: string;
}

export interface AnnouncementItem {
  id: string;
  content: string;
  time: string;
  publisher: string;
  confirmText: string;
  showEveryTime?: boolean;
  showGotoButton: boolean;
  gotoUrl?: string | null;
}

export interface FeedbackPayload {
  content: string;
  contact?: string;
}

export interface SystemStatus {
  configLoaded: boolean;
  baseUrl: string;
  updatedAt?: number;
}
