export type RuntimeConfigValueType = "string" | "number" | "boolean" | "string[]" | "json";

export type RuntimeConfigGroup =
  | "download_security"
  | "download_rate_limit"
  | "bot_blocking"
  | "encryption"
  | "auth"
  | "verification"
  | "analytics"
  | "http"
  | "sync"
  | "fault_reports"
  | "feedback"
  | "shares"
  | "listening"
  | "listen_together"
  | "storage"
  | "announcement";

export interface RuntimeConfigItem {
  key: string;
  value: any;
  defaultValue: any;
  group: RuntimeConfigGroup;
  groupLabel: string;
  label: string;
  description?: string;
  type: RuntimeConfigValueType;
  unit?: string;
  min?: number;
  max?: number;
  options?: readonly string[];
  adminEditable: boolean;
  updatedAt: number;
}

export interface RuntimeConfigResponse {
  items: RuntimeConfigItem[];
  snapshot: Record<string, any>;
}

export interface RuntimeConfigChange {
  key: string;
  value: any;
}
