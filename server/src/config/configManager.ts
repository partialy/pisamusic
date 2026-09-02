import type { DatabaseSync } from "node:sqlite";
import { getAppDb } from "../db/appDb";
import { CONFIG_DEFINITIONS, DEFINITION_MAP, validateConfigBatch } from "./configDefinitions";
import type {
  ConfigChange,
  ConfigChangeListener,
  ConfigDefinition,
  ConfigItemDTO,
  ConfigJsonValue,
} from "./configTypes";

export class RuntimeConfigManager {
  private readonly dbProvider: () => DatabaseSync;
  private readonly memoryMap = new Map<string, ConfigJsonValue>();
  private readonly updatedAtMap = new Map<string, number>();
  private readonly listeners = new Set<ConfigChangeListener>();
  private initialized = false;

  constructor(dbProvider: () => DatabaseSync = getAppDb) {
    this.dbProvider = dbProvider;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public initialize(): void {
    const db = this.dbProvider();
    const now = Date.now();

    // 1. 读取数据库现有配置
    const rows = db.prepare("SELECT key, name, value_json, updated_at FROM runtime_configs").all() as {
      key: string;
      name?: string;
      value_json: string;
      updated_at: number;
    }[];

    const dbMap = new Map<string, { name: string; value: ConfigJsonValue; updatedAt: number }>();
    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.value_json) as ConfigJsonValue;
        dbMap.set(r.key, { name: String(r.name ?? ""), value: parsed, updatedAt: Number(r.updated_at) || now });
      } catch {
        // eslint-disable-next-line no-console
        console.warn(`[configManager] 坏 JSON 配置 key=${r.key}，将在初始化时用默认值修复`);
      }
    }

    // 2. 检查是否有环境变量 ANALYTICS_RETENTION_DAYS 需要引导
    let envRetentionDays: number | undefined;
    if (process.env.ANALYTICS_RETENTION_DAYS) {
      const num = Number(process.env.ANALYTICS_RETENTION_DAYS);
      if (Number.isFinite(num) && num >= 90 && num <= 730) {
        envRetentionDays = Math.trunc(num);
      }
    }

    // 3. 比对 definition，缺少的在单一事务中持久化默认值
    const toInsert: { key: string; name: string; valueJson: string; updatedAt: number }[] = [];
    const toUpdateName: { key: string; name: string }[] = [];

    for (const def of CONFIG_DEFINITIONS) {
      const existing = dbMap.get(def.key);
      if (existing !== undefined) {
        // 归一化并放进内存
        const normalized = def.parse ? def.parse(existing.value) : existing.value;
        this.memoryMap.set(def.key, normalized);
        this.updatedAtMap.set(def.key, existing.updatedAt);
        if (!existing.name || existing.name !== def.label) {
          toUpdateName.push({ key: def.key, name: def.label });
        }
      } else {
        // 计算初始默认值
        let initialVal = def.defaultValue;
        if (def.key === "analytics.retentionDays" && envRetentionDays !== undefined) {
          initialVal = envRetentionDays;
        }

        const normalized = def.parse ? def.parse(initialVal) : initialVal;
        toInsert.push({
          key: def.key,
          name: def.label,
          valueJson: JSON.stringify(normalized),
          updatedAt: now,
        });
        this.memoryMap.set(def.key, normalized);
        this.updatedAtMap.set(def.key, now);
      }
    }

    if (toInsert.length > 0 || toUpdateName.length > 0) {
      const insertStmt = db.prepare(
        "INSERT INTO runtime_configs (key, name, value_json, updated_at) VALUES (?, ?, ?, ?)",
      );
      const updateNameStmt = db.prepare(
        "UPDATE runtime_configs SET name = ? WHERE key = ?",
      );
      db.exec("BEGIN");
      try {
        for (const item of toInsert) {
          insertStmt.run(item.key, item.name, item.valueJson, item.updatedAt);
        }
        for (const item of toUpdateName) {
          updateNameStmt.run(item.name, item.key);
        }
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    }

    this.initialized = true;
  }

  public get<T>(key: string, defaultValue: T): T {
    const val = this.memoryMap.get(key);
    if (val === undefined) {
      return defaultValue;
    }
    // 类型兼容保护
    if (typeof defaultValue === "number") {
      const num = typeof val === "number" ? val : Number(val);
      return (Number.isFinite(num) ? num : defaultValue) as unknown as T;
    }
    if (typeof defaultValue === "boolean") {
      return Boolean(val) as unknown as T;
    }
    if (typeof defaultValue === "string") {
      return String(val) as unknown as T;
    }
    if (Array.isArray(defaultValue)) {
      return (Array.isArray(val) ? val : defaultValue) as unknown as T;
    }
    return (val as unknown as T) ?? defaultValue;
  }

  public set<T extends ConfigJsonValue>(key: string, value: T): void {
    this.setMany([{ key, value }]);
  }

  public setMany(changes: readonly ConfigChange[]): Readonly<Record<string, ConfigJsonValue>> {
    if (!changes || changes.length === 0) {
      return this.snapshot();
    }

    // 1. 严格校验整批数据
    const { valid, error, normalized } = validateConfigBatch(changes);
    if (!valid || !normalized) {
      throw new Error(error || "配置校验失败");
    }

    const db = this.dbProvider();
    const now = Date.now();
    const upsertStmt = db.prepare(
      `INSERT INTO runtime_configs (key, name, value_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         name = excluded.name,
         value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
    );

    // 2. 数据库事务原子提交
    db.exec("BEGIN");
    try {
      for (const item of normalized) {
        const def = DEFINITION_MAP.get(item.key);
        const name = def?.label ?? item.key;
        upsertStmt.run(item.key, name, JSON.stringify(item.value), now);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }

    // 3. 只有 DB 提交成功后才更新内存 Map
    const changedKeys: string[] = [];
    for (const item of normalized) {
      this.memoryMap.set(item.key, item.value);
      this.updatedAtMap.set(item.key, now);
      changedKeys.push(item.key);
    }

    // 4. 触发订阅广播
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener(changedKeys, snap);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[configManager] listener error:", e);
      }
    }

    return snap;
  }

  public snapshot(): Readonly<Record<string, ConfigJsonValue>> {
    const result: Record<string, ConfigJsonValue> = {};
    for (const [k, v] of this.memoryMap.entries()) {
      result[k] = v;
    }
    return Object.freeze(result);
  }

  public getAllDTOs(): ConfigItemDTO[] {
    const dtos: ConfigItemDTO[] = [];
    for (const def of CONFIG_DEFINITIONS) {
      if (def.adminVisible === false) continue;
      const val = this.memoryMap.get(def.key) ?? def.defaultValue;
      const updatedAt = this.updatedAtMap.get(def.key) ?? 0;
      dtos.push({
        key: def.key,
        value: val,
        defaultValue: def.defaultValue,
        group: def.group,
        groupLabel: def.groupLabel,
        label: def.label,
        description: def.description,
        type: def.type,
        unit: def.unit,
        min: def.min,
        max: def.max,
        options: def.options,
        adminEditable: def.adminEditable !== false,
        updatedAt,
      });
    }
    return dtos;
  }

  public subscribe(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public clearForTest(): void {
    this.memoryMap.clear();
    this.updatedAtMap.clear();
    this.listeners.clear();
    this.initialized = false;
  }
}

export const configManager = new RuntimeConfigManager();

export function createConfigManager(db: DatabaseSync): RuntimeConfigManager {
  return new RuntimeConfigManager(() => db);
}
