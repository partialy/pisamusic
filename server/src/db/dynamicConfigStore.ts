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

export async function listDynamicConfigs(): Promise<DynamicConfigItem[]> {
  const db = getAppDb();
  const rows = (await db.query("SELECT id, type, content, created_at, updated_at FROM dynamic_configs ORDER BY updated_at DESC, id ASC", [])) as DynamicConfigRow[];
  return rows.map((row) => ({
    id: row.id,
    type: normalizeDynamicConfigType(row.type),
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function readDynamicConfigById(id: string): Promise<DynamicConfigItem | null> {
  const db = getAppDb();
  const row = (await db.queryOne("SELECT id, type, content, created_at, updated_at FROM dynamic_configs WHERE id = ?", [id])) as DynamicConfigRow | undefined;
  return mapDynamicConfig(row);
}

export async function saveDynamicConfig(input: {
  id: string;
  type: DynamicConfigType;
  content: string;
}): Promise<DynamicConfigItem> {
  const db = getAppDb();
  const existing = (await readDynamicConfigById(input.id));
  const now = Date.now();
  (await db.execute(db.dialect === "mysql" ? "INSERT INTO dynamic_configs (id, type, content, created_at, updated_at)\n     VALUES (?, ?, ?, ?, ?)\n     ON DUPLICATE KEY UPDATE\n       type = VALUES(type),\n       content = VALUES(content),\n       updated_at = VALUES(updated_at)" : `INSERT INTO dynamic_configs (id, type, content, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       type = excluded.type,
       content = excluded.content,
       updated_at = excluded.updated_at`, [input.id, input.type, input.content, existing?.createdAt ?? now, now]));
  const saved = (await readDynamicConfigById(input.id));
  if (!saved) {
    throw new Error("动态配置保存失败");
  }
  return saved;
}

export async function deleteDynamicConfig(id: string): Promise<boolean> {
  const db = getAppDb();
  const result = (await db.execute("DELETE FROM dynamic_configs WHERE id = ?", [id]));
  return result.affectedRows > 0;
}
