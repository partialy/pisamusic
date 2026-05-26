import { getAppDb } from "./appDb";

export type DynamicConfigType = "html" | "string" | "number" | "url";

export type DynamicConfigItem = {
  id: string;
  type: DynamicConfigType;
  content: string;
  createdAt: number;
  updatedAt: number;
};

type DynamicConfigRow = {
  id: string;
  type: string;
  content: string;
  created_at: number;
  updated_at: number;
};

function normalizeDynamicConfigType(type: string): DynamicConfigType {
  switch (type) {
    case "html":
    case "number":
    case "url":
      return type;
    default:
      return "string";
  }
}

function mapDynamicConfig(row?: DynamicConfigRow): DynamicConfigItem | null {
  if (!row) return null;
  return {
    id: row.id,
    type: normalizeDynamicConfigType(row.type),
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listDynamicConfigs(): DynamicConfigItem[] {
  const db = getAppDb();
  const rows = db
    .prepare("SELECT id, type, content, created_at, updated_at FROM dynamic_configs ORDER BY updated_at DESC, id ASC")
    .all() as DynamicConfigRow[];
  return rows.map((row) => ({
    id: row.id,
    type: normalizeDynamicConfigType(row.type),
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function readDynamicConfigById(id: string): DynamicConfigItem | null {
  const db = getAppDb();
  const row = db
    .prepare("SELECT id, type, content, created_at, updated_at FROM dynamic_configs WHERE id = ?")
    .get(id) as DynamicConfigRow | undefined;
  return mapDynamicConfig(row);
}

export function saveDynamicConfig(input: {
  id: string;
  type: DynamicConfigType;
  content: string;
}): DynamicConfigItem {
  const db = getAppDb();
  const existing = readDynamicConfigById(input.id);
  const now = Date.now();
  db.prepare(
    `INSERT INTO dynamic_configs (id, type, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type,
       content = excluded.content,
       updated_at = excluded.updated_at`,
  ).run(input.id, input.type, input.content, existing?.createdAt ?? now, now);
  const saved = readDynamicConfigById(input.id);
  if (!saved) {
    throw new Error("动态配置保存失败");
  }
  return saved;
}

export function deleteDynamicConfig(id: string): boolean {
  const db = getAppDb();
  const result = db.prepare("DELETE FROM dynamic_configs WHERE id = ?").run(id);
  return result.changes > 0;
}
