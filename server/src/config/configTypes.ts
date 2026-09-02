export type ConfigJsonValue =
  | string
  | number
  | boolean
  | null
  | ConfigJsonValue[]
  | { [key: string]: ConfigJsonValue };

export type ConfigValueType = "string" | "number" | "boolean" | "string[]" | "json";

export type ConfigGroup =
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

export interface ConfigDefinition<T extends ConfigJsonValue = ConfigJsonValue> {
  key: string;
  group: ConfigGroup;
  groupLabel: string;
  label: string;
  description?: string;
  type: ConfigValueType;
  defaultValue: T;
  unit?: string;
  min?: number;
  max?: number;
  options?: readonly string[];
  adminVisible?: boolean;
  adminEditable?: boolean;
  parse?: (value: unknown) => T;
  validate?: (value: T) => string | null;
}

export interface ConfigChange<T extends ConfigJsonValue = ConfigJsonValue> {
  key: string;
  value: T;
}

export interface ConfigItemDTO {
  key: string;
  value: ConfigJsonValue;
  defaultValue: ConfigJsonValue;
  group: ConfigGroup;
  groupLabel: string;
  label: string;
  description?: string;
  type: ConfigValueType;
  unit?: string;
  min?: number;
  max?: number;
  options?: readonly string[];
  adminEditable: boolean;
  updatedAt: number;
}

export type ConfigChangeListener = (
  changedKeys: readonly string[],
  snapshot: Readonly<Record<string, ConfigJsonValue>>,
) => void;
