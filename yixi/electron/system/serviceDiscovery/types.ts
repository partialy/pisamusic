export type ServiceOriginV1 = {
  id: string;
  priority: number;
  apiBaseUrl: string;
  realtimeBaseUrl: string;
};

export type DiscoveryDocumentV1 = {
  schemaVersion: 1;
  configVersion: number;
  publishedAt: string;
  desktop: {
    minimumSupportedVersion: string;
    healthCheckPath: string;
    bootstrapPath: string;
    serviceOrigins: ServiceOriginV1[];
    updateFeedBaseUrls: string[];
  };
};

export type DiscoverySource =
  | "environment"
  | "development"
  | "remote"
  | "cache"
  | "embedded";

export type ServiceDiscoverySnapshot = {
  source: DiscoverySource;
  schemaVersion: 1;
  configVersion: number;
  publishedAt: string;
  minimumSupportedVersion: string;
  originId: string;
  apiBaseUrl: string;
  realtimeBaseUrl: string;
  healthCheckPath: string;
  bootstrapPath: string;
  updateFeedBaseUrls: string[];
};

export type ServiceDiscoveryDependencies = {
  fetchRemoteDocument: () => Promise<unknown>;
  readCachedDocument: () => unknown | null;
  writeCachedDocument: (document: DiscoveryDocumentV1) => void;
  probeHealth: (url: string) => Promise<boolean>;
};
