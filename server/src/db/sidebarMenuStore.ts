import { getAppDb } from "./appDb";

export type SidebarIconType = "none" | "image" | "svg" | "preset";
export type SidebarBadgeType = "none" | "text" | "dot_once" | "dot_always";
export type SidebarOpenType = "web" | "fullscreen_web";
export type SidebarGridPosition = "top" | "bottom";

export type SidebarMenuStoredItem = {
  id: string;
  enabled: boolean;
  sortOrder: number;
  name: string;
  iconType: SidebarIconType;
  iconFileId: string | null;
  iconValue: string;
  badgeType: SidebarBadgeType;
  subtitleText: string;
  badgeVersion: number;
  openType: SidebarOpenType;
  url: string;
};

export type SidebarListSectionStored = {
  enabled: boolean;
  title: string;
  items: SidebarMenuStoredItem[];
};

export type SidebarGridSectionStored = {
  enabled: boolean;
  position: SidebarGridPosition;
  items: SidebarMenuStoredItem[];
};

export type SidebarMenuStoredConfig = {
  listSection: SidebarListSectionStored;
  gridSection: SidebarGridSectionStored;
  updatedAt: number;
};

export const SIDEBAR_MENU_DEFAULTS: SidebarMenuStoredConfig = {
  listSection: {
    enabled: false,
    title: "其他",
    items: [],
  },
  gridSection: {
    enabled: false,
    position: "top",
    items: [],
  },
  updatedAt: 0,
};

export async function readSidebarMenuConfig(): Promise<SidebarMenuStoredConfig> {
  const row = (await getAppDb().queryOne(
    "SELECT config_json, updated_at FROM sidebar_menu_config WHERE id = 1",
    [],
  )) as { config_json: string; updated_at: number } | undefined;
  if (!row) {
    return {
      listSection: { ...SIDEBAR_MENU_DEFAULTS.listSection, items: [] },
      gridSection: { ...SIDEBAR_MENU_DEFAULTS.gridSection, items: [] },
      updatedAt: 0,
    };
  }
  const parsed = JSON.parse(row.config_json) as Partial<SidebarMenuStoredConfig>;
  return {
    listSection: {
      enabled: Boolean(parsed.listSection?.enabled),
      title: typeof parsed.listSection?.title === "string" ? parsed.listSection.title : "其他",
      items: Array.isArray(parsed.listSection?.items) ? parsed.listSection.items : [],
    },
    gridSection: {
      enabled: Boolean(parsed.gridSection?.enabled),
      position: parsed.gridSection?.position === "bottom" ? "bottom" : "top",
      items: Array.isArray(parsed.gridSection?.items) ? parsed.gridSection.items : [],
    },
    updatedAt: Number(row.updated_at) || 0,
  };
}

export async function saveSidebarMenuConfig(
  input: Omit<SidebarMenuStoredConfig, "updatedAt">,
): Promise<SidebarMenuStoredConfig> {
  const db = getAppDb();
  return await db.transaction(async () => {
    const now = Date.now();
    await db.execute(
      "UPDATE file_records SET referenced_by = '[]' WHERE usage_type = 'sidebar-menu-icon'",
      [],
    );

    const refsByFileId = new Map<string, Array<{ type: string; id: string }>>();
    for (const item of [...input.listSection.items, ...input.gridSection.items]) {
      if (item.iconType === "image" && item.iconFileId) {
        const list = refsByFileId.get(item.iconFileId) ?? [];
        list.push({ type: "sidebar-menu-icon", id: item.id });
        refsByFileId.set(item.iconFileId, list);
      }
    }
    for (const [fileId, refs] of refsByFileId.entries()) {
      await db.execute(
        "UPDATE file_records SET referenced_by = ? WHERE id = ?",
        [JSON.stringify(refs), fileId],
      );
    }

    const payloadJson = JSON.stringify(input);
    const sql =
      db.dialect === "mysql"
        ? "INSERT INTO sidebar_menu_config(id, config_json, updated_at) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE config_json=VALUES(config_json), updated_at=VALUES(updated_at)"
        : "INSERT INTO sidebar_menu_config(id, config_json, updated_at) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET config_json=excluded.config_json, updated_at=excluded.updated_at";
    await db.execute(sql, [payloadJson, now]);
    return { ...input, updatedAt: now };
  });
}

export async function rememberSidebarMenuIconUpload(
  key: string,
  input: unknown,
  expiresAt: number,
): Promise<void> {
  const db = getAppDb();
  await db.execute(
    "DELETE FROM sidebar_menu_icon_uploads WHERE expires_at < ? AND file_id IS NULL",
    [Date.now()],
  );
  await db.execute(
    "INSERT INTO sidebar_menu_icon_uploads(object_key, input_json, expires_at) VALUES (?, ?, ?)",
    [key, JSON.stringify(input), expiresAt],
  );
}

export async function readSidebarMenuIconUpload(key: string) {
  return (await getAppDb().queryOne(
    "SELECT input_json, expires_at, file_id FROM sidebar_menu_icon_uploads WHERE object_key = ?",
    [key],
  )) as { input_json: string; expires_at: number; file_id: string | null } | undefined;
}

export async function completeSidebarMenuIconUpload(key: string, fileId: string): Promise<void> {
  await getAppDb().execute(
    "UPDATE sidebar_menu_icon_uploads SET file_id = ? WHERE object_key = ?",
    [fileId, key],
  );
}
