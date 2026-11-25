import { getAppDb } from "./appDb";

export type SidebarIconType = "none" | "image" | "svg" | "preset";
export type SidebarBuiltinIconType = "default" | SidebarIconType;
export type SidebarBadgeType = "none" | "text" | "dot_once" | "dot_always";
export type SidebarOpenType = "web" | "fullscreen_web" | "app_action";
export type SidebarGridPosition = "top" | "bottom";
export type SidebarBuiltinKey = "import_playlists" | "link_import" | "sleep_timer" | "theme";

export const SIDEBAR_BUILTIN_KEYS: readonly SidebarBuiltinKey[] = [
  "import_playlists",
  "link_import",
  "sleep_timer",
  "theme",
] as const;

export type SidebarBuiltinItemStored = {
  key: SidebarBuiltinKey;
  enabled: boolean;
  name: string;
  iconType: SidebarBuiltinIconType;
  iconFileId: string | null;
  iconValue: string;
};

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
  actionKey: string;
};

export type SidebarListSectionStored = {
  id: string;
  enabled: boolean;
  sortOrder: number;
  title: string;
  items: SidebarMenuStoredItem[];
};

export type SidebarGridSectionStored = {
  enabled: boolean;
  position: SidebarGridPosition;
  items: SidebarMenuStoredItem[];
};

export type SidebarMenuStoredConfig = {
  builtinItems: SidebarBuiltinItemStored[];
  listSections: SidebarListSectionStored[];
  gridSection: SidebarGridSectionStored;
  updatedAt: number;
};

export function createDefaultBuiltinItems(): SidebarBuiltinItemStored[] {
  return SIDEBAR_BUILTIN_KEYS.map((key) => ({
    key,
    enabled: true,
    name: "",
    iconType: "default",
    iconFileId: null,
    iconValue: "",
  }));
}

export const SIDEBAR_MENU_DEFAULTS: SidebarMenuStoredConfig = {
  builtinItems: createDefaultBuiltinItems(),
  listSections: [],
  gridSection: {
    enabled: false,
    position: "top",
    items: [],
  },
  updatedAt: 0,
};

function normalizeStoredItem(raw: Partial<SidebarMenuStoredItem>, index: number): SidebarMenuStoredItem {
  const openType: SidebarOpenType =
    raw.openType === "fullscreen_web" || raw.openType === "app_action" ? raw.openType : "web";
  return {
    id: typeof raw.id === "string" ? raw.id : "",
    enabled: raw.enabled === undefined ? true : Boolean(raw.enabled),
    sortOrder: typeof raw.sortOrder === "number" && Number.isFinite(raw.sortOrder) ? Math.trunc(raw.sortOrder) : index,
    name: typeof raw.name === "string" ? raw.name : "",
    iconType:
      raw.iconType === "image" || raw.iconType === "svg" || raw.iconType === "preset" ? raw.iconType : "none",
    iconFileId: typeof raw.iconFileId === "string" && raw.iconFileId ? raw.iconFileId : null,
    iconValue: typeof raw.iconValue === "string" ? raw.iconValue : "",
    badgeType:
      raw.badgeType === "text" || raw.badgeType === "dot_once" || raw.badgeType === "dot_always"
        ? raw.badgeType
        : "none",
    subtitleText: typeof raw.subtitleText === "string" ? raw.subtitleText : "",
    badgeVersion:
      typeof raw.badgeVersion === "number" && Number.isSafeInteger(raw.badgeVersion) && raw.badgeVersion >= 1
        ? raw.badgeVersion
        : 1,
    openType,
    url: typeof raw.url === "string" ? raw.url : "",
    actionKey: typeof raw.actionKey === "string" ? raw.actionKey : "",
  };
}

function normalizeStoredBuiltinItems(rawList: unknown): SidebarBuiltinItemStored[] {
  const byKey = new Map<SidebarBuiltinKey, Partial<SidebarBuiltinItemStored>>();
  if (Array.isArray(rawList)) {
    for (const entry of rawList) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as Partial<SidebarBuiltinItemStored>;
      if (item.key && SIDEBAR_BUILTIN_KEYS.includes(item.key)) {
        byKey.set(item.key, item);
      }
    }
  }
  return SIDEBAR_BUILTIN_KEYS.map((key) => {
    const raw = byKey.get(key);
    const iconType: SidebarBuiltinIconType =
      raw?.iconType === "none" ||
      raw?.iconType === "image" ||
      raw?.iconType === "svg" ||
      raw?.iconType === "preset"
        ? raw.iconType
        : "default";
    return {
      key,
      enabled: raw?.enabled === undefined ? true : Boolean(raw.enabled),
      name: typeof raw?.name === "string" ? raw.name : "",
      iconType,
      iconFileId: typeof raw?.iconFileId === "string" && raw.iconFileId ? raw.iconFileId : null,
      iconValue: typeof raw?.iconValue === "string" ? raw.iconValue : "",
    };
  });
}

type LegacyStoredConfig = Partial<SidebarMenuStoredConfig> & {
  listSection?: {
    enabled?: boolean;
    title?: string;
    items?: Partial<SidebarMenuStoredItem>[];
  };
};

export async function readSidebarMenuConfig(): Promise<SidebarMenuStoredConfig> {
  const row = (await getAppDb().queryOne(
    "SELECT config_json, updated_at FROM sidebar_menu_config WHERE id = 1",
    [],
  )) as { config_json: string; updated_at: number } | undefined;
  if (!row) {
    return {
      builtinItems: createDefaultBuiltinItems(),
      listSections: [],
      gridSection: { ...SIDEBAR_MENU_DEFAULTS.gridSection, items: [] },
      updatedAt: 0,
    };
  }
  const parsed = JSON.parse(row.config_json) as LegacyStoredConfig;
  let listSections: SidebarListSectionStored[] = [];
  if (Array.isArray(parsed.listSections)) {
    listSections = parsed.listSections.map((sec, idx) => ({
      id: typeof sec?.id === "string" && sec.id.trim() ? sec.id.trim() : `section_${idx + 1}`,
      enabled: Boolean(sec?.enabled),
      sortOrder:
        typeof sec?.sortOrder === "number" && Number.isFinite(sec.sortOrder) ? Math.trunc(sec.sortOrder) : idx,
      title: typeof sec?.title === "string" ? sec.title : "",
      items: Array.isArray(sec?.items) ? sec.items.map((it, itemIdx) => normalizeStoredItem(it, itemIdx)) : [],
    }));
  } else if (parsed.listSection) {
    // 兼容旧版单区块配置
    listSections = [
      {
        id: "section_1",
        enabled: Boolean(parsed.listSection.enabled),
        sortOrder: 0,
        title: typeof parsed.listSection.title === "string" ? parsed.listSection.title : "其他",
        items: Array.isArray(parsed.listSection.items)
          ? parsed.listSection.items.map((it, itemIdx) => normalizeStoredItem(it, itemIdx))
          : [],
      },
    ];
  }

  return {
    builtinItems: normalizeStoredBuiltinItems(parsed.builtinItems),
    listSections: listSections.sort((a, b) => a.sortOrder - b.sortOrder),
    gridSection: {
      enabled: Boolean(parsed.gridSection?.enabled),
      position: parsed.gridSection?.position === "bottom" ? "bottom" : "top",
      items: Array.isArray(parsed.gridSection?.items)
        ? parsed.gridSection.items.map((it, itemIdx) => normalizeStoredItem(it, itemIdx))
        : [],
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
    const collectRef = (fileId: string | null, refId: string) => {
      if (!fileId) return;
      const list = refsByFileId.get(fileId) ?? [];
      list.push({ type: "sidebar-menu-icon", id: refId });
      refsByFileId.set(fileId, list);
    };

    for (const builtin of input.builtinItems) {
      if (builtin.iconType === "image") {
        collectRef(builtin.iconFileId, `builtin:${builtin.key}`);
      }
    }
    for (const section of input.listSections) {
      for (const item of section.items) {
        if (item.iconType === "image") {
          collectRef(item.iconFileId, item.id);
        }
      }
    }
    for (const item of input.gridSection.items) {
      if (item.iconType === "image") {
        collectRef(item.iconFileId, item.id);
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
