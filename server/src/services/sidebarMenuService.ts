import { randomUUID } from "node:crypto";
import path from "node:path";
import { createFileRecord, readFileRecordById } from "../db/configStore";
import {
  SIDEBAR_BUILTIN_KEYS,
  completeSidebarMenuIconUpload,
  readSidebarMenuConfig,
  readSidebarMenuIconUpload,
  rememberSidebarMenuIconUpload,
  saveSidebarMenuConfig,
  type SidebarBadgeType,
  type SidebarBuiltinIconType,
  type SidebarBuiltinItemStored,
  type SidebarBuiltinKey,
  type SidebarGridPosition,
  type SidebarIconType,
  type SidebarListSectionStored,
  type SidebarMenuStoredConfig,
  type SidebarMenuStoredItem,
  type SidebarOpenType,
} from "../db/sidebarMenuStore";
import { buildUrl, createSidebarMenuIconUploadToken, statQiniuObjectInSpace } from "./qiniuReleaseFiles";

export const deletingSidebarMenuIcons = new Set<string>();

export const SIDEBAR_APP_ACTION_KEYS = [
  "discover",
  "announcements",
  "check_update",
  "feedback",
  "scan",
  "settings",
  "login",
  "profile",
  "about",
  "share_app",
  "data_management",
  "download_settings",
  "playback_settings",
] as const;

export const CURRENT_SIDEBAR_MENU_SCHEMA_VERSION = 2;

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const MAX_ICON_BYTES = 2 * 1024 * 1024;
const MAX_SVG_BYTES = 16 * 1024;

export type PublicSidebarBuiltinItem = {
  key: SidebarBuiltinKey;
  enabled: boolean;
  name: string;
  iconType: SidebarBuiltinIconType;
  iconValue: string;
};

export type PublicSidebarMenuItem = {
  id: string;
  sortOrder: number;
  name: string;
  iconType: SidebarIconType;
  iconValue: string;
  badgeType: SidebarBadgeType;
  subtitleText: string;
  badgeVersion: number;
  openType: SidebarOpenType;
  url: string;
  actionKey: string;
};

export type PublicSidebarListSection = {
  id: string;
  enabled: boolean;
  sortOrder: number;
  title: string;
  items: PublicSidebarMenuItem[];
};

export type PublicSidebarMenuConfig = {
  schemaVersion: number;
  builtinItems?: PublicSidebarBuiltinItem[];
  listSections?: PublicSidebarListSection[];
  listSection: {
    enabled: boolean;
    title: string;
    items: PublicSidebarMenuItem[];
  };
  gridSection: {
    enabled: boolean;
    position: SidebarGridPosition;
    items: PublicSidebarMenuItem[];
  };
  updatedAt: number;
};

export type AdminSidebarBuiltinItem = SidebarBuiltinItemStored & {
  iconUrl: string;
};

export type AdminSidebarMenuItem = SidebarMenuStoredItem & {
  iconUrl: string;
};

export type AdminSidebarListSection = {
  id: string;
  enabled: boolean;
  sortOrder: number;
  title: string;
  items: AdminSidebarMenuItem[];
};

export type AdminSidebarMenuConfig = {
  builtinItems: AdminSidebarBuiltinItem[];
  listSections: AdminSidebarListSection[];
  gridSection: {
    enabled: boolean;
    position: SidebarGridPosition;
    items: AdminSidebarMenuItem[];
  };
  updatedAt: number;
};

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}格式不正确`);
  }
  return value as Record<string, unknown>;
}

function cleanText(value: unknown, label: string, max: number, required = false): string {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new Error(`${label}必须是字符串`);
  }
  const trimmed = (value ?? "").trim();
  if (required && !trimmed) throw new Error(`${label}不能为空`);
  if (trimmed.length > max) throw new Error(`${label}长度不能超过 ${max} 字`);
  return trimmed;
}

function validateTargetUrl(raw: unknown): string {
  const urlStr = cleanText(raw, "跳转链接", 1000, true);
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error("跳转链接必须是合法的 http:// 或 https:// 地址");
  }
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) {
    throw new Error("跳转链接仅支持 http:// 或 https://，且不能包含账号密码");
  }
  return parsed.toString();
}

function validateAndSanitizeSvg(raw: unknown): string {
  const trimmed = cleanText(raw, "SVG 源码", MAX_SVG_BYTES, true)
    .replace(/^\uFEFF/, "")
    .replace(/<\?xml[\s\S]*?\?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  if (Buffer.byteLength(trimmed, "utf8") > MAX_SVG_BYTES) {
    throw new Error(`SVG 源码大小不能超过 ${MAX_SVG_BYTES} 字节`);
  }
  if (!/^<svg\b[\s\S]*<\/svg>$/i.test(trimmed)) {
    throw new Error("SVG 源码必须包含完整的 <svg>...</svg> 标签");
  }
  if (
    /<(script|foreignObject|iframe|object|embed)\b/i.test(trimmed) ||
    /\bon[a-z]+\s*=/i.test(trimmed) ||
    /javascript:/i.test(trimmed) ||
    /\b(?:href|xlink:href|src)\s*=\s*["']\s*https?:/i.test(trimmed)
  ) {
    throw new Error("SVG 源码包含不安全的脚本、事件或外部资源引用");
  }
  return trimmed;
}

function validateImageUrl(raw: unknown): string {
  const value = cleanText(raw, "图片链接", 1000, true);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("图标图片链接必须是合法的 HTTPS URL");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("图标图片链接仅支持 HTTPS，且不能包含账号密码");
  }
  return parsed.toString();
}

async function normalizeIconConfig(
  rawIconType: string,
  rawIconFileId: unknown,
  rawIconValue: unknown,
  allowDefault: boolean,
): Promise<{ iconType: SidebarBuiltinIconType; iconFileId: string | null; iconValue: string }> {
  const validTypes = allowDefault
    ? ["default", "none", "image", "svg", "preset"]
    : ["none", "image", "svg", "preset"];
  if (!validTypes.includes(rawIconType)) {
    throw new Error("不支持的图标类型");
  }
  const iconType = rawIconType as SidebarBuiltinIconType;

  let iconFileId: string | null = null;
  let iconValue = "";
  if (iconType === "image") {
    const fileId =
      rawIconFileId === null || rawIconFileId === undefined
        ? ""
        : cleanText(rawIconFileId, "图标文件 ID", 120, false);
    if (fileId) {
      const file = await readFileRecordById(fileId);
      if (
        !file ||
        file.usageType !== "sidebar-menu-icon" ||
        file.status !== "uploaded" ||
        deletingSidebarMenuIcons.has(fileId)
      ) {
        throw new Error("所选图标文件无效或已删除");
      }
      iconFileId = fileId;
      iconValue = "";
    } else {
      iconValue = validateImageUrl(rawIconValue);
    }
  } else if (iconType === "svg") {
    iconValue = validateAndSanitizeSvg(rawIconValue);
  } else if (iconType === "preset") {
    iconValue = cleanText(rawIconValue, "预置图标标识", 64, true);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(iconValue)) {
      throw new Error("预置图标标识仅允许字母、数字、下划线和短横线");
    }
  }
  return { iconType, iconFileId, iconValue };
}

async function normalizeMenuItem(
  raw: unknown,
  section: "list" | "grid",
  index: number,
  seenIds: Set<string>,
): Promise<SidebarMenuStoredItem> {
  const item = requireObject(raw, "菜单项");
  const rawId = cleanText(item.id, "菜单项 ID", 64, false) || randomUUID();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(rawId)) {
    throw new Error("菜单项 ID 仅允许字母、数字、下划线和短横线");
  }
  if (seenIds.has(rawId)) {
    throw new Error(`菜单项 ID 重复：${rawId}`);
  }
  seenIds.add(rawId);

  const name = cleanText(item.name, "菜单名称", 30, true);
  const enabled = item.enabled === undefined ? true : Boolean(item.enabled);
  const sortOrder = Number.isFinite(Number(item.sortOrder)) ? Math.trunc(Number(item.sortOrder)) : index;

  const rawOpenType = cleanText(item.openType, "打开方式", 30, false) || "web";
  if (!["web", "fullscreen_web", "app_action"].includes(rawOpenType)) {
    throw new Error("不支持的打开方式");
  }
  const openType = rawOpenType as SidebarOpenType;

  let url = "";
  let actionKey = "";
  if (openType === "app_action") {
    actionKey = cleanText(item.actionKey, "App 功能标识", 64, true);
    if (!SIDEBAR_APP_ACTION_KEYS.includes(actionKey as (typeof SIDEBAR_APP_ACTION_KEYS)[number])) {
      throw new Error(`不支持的 App 功能标识：${actionKey}`);
    }
  } else {
    url = validateTargetUrl(item.url);
  }

  const rawIconType = cleanText(item.iconType, "图标类型", 20, false) || (section === "grid" ? "preset" : "none");
  if (section === "grid" && rawIconType === "none") {
    throw new Error("四宫格入口必须配置图标");
  }
  const icon = await normalizeIconConfig(rawIconType, item.iconFileId, item.iconValue, false);

  const rawBadgeType = cleanText(item.badgeType, "角标类型", 20, false) || "none";
  if (!["none", "text", "dot_once", "dot_always"].includes(rawBadgeType)) {
    throw new Error("不支持的角标类型");
  }
  const badgeType = rawBadgeType as SidebarBadgeType;
  if (section === "grid" && badgeType === "text") {
    throw new Error("四宫格入口不支持文字副标题");
  }
  const subtitleText = badgeType === "text" ? cleanText(item.subtitleText, "副标题文字", 20, true) : "";
  const rawBadgeVersion = Number(item.badgeVersion);
  const badgeVersion = Number.isSafeInteger(rawBadgeVersion) && rawBadgeVersion >= 1 ? rawBadgeVersion : 1;

  return {
    id: rawId,
    enabled,
    sortOrder,
    name,
    iconType: icon.iconType as SidebarIconType,
    iconFileId: icon.iconFileId,
    iconValue: icon.iconValue,
    badgeType,
    subtitleText,
    badgeVersion,
    openType,
    url,
    actionKey,
  };
}

async function normalizeBuiltinItems(rawInput: unknown): Promise<SidebarBuiltinItemStored[]> {
  const byKey = new Map<SidebarBuiltinKey, Record<string, unknown>>();
  if (Array.isArray(rawInput)) {
    for (const entry of rawInput) {
      const obj = requireObject(entry, "内置菜单项");
      const key = cleanText(obj.key, "内置菜单项键", 40, true) as SidebarBuiltinKey;
      if (!SIDEBAR_BUILTIN_KEYS.includes(key)) {
        throw new Error(`不支持的内置菜单项：${key}`);
      }
      if (byKey.has(key)) {
        throw new Error(`内置菜单项重复：${key}`);
      }
      byKey.set(key, obj);
    }
  }

  const result: SidebarBuiltinItemStored[] = [];
  for (const key of SIDEBAR_BUILTIN_KEYS) {
    const raw = byKey.get(key);
    if (!raw) {
      result.push({
        key,
        enabled: true,
        name: "",
        iconType: "default",
        iconFileId: null,
        iconValue: "",
      });
      continue;
    }
    const rawIconType = cleanText(raw.iconType, "内置图标类型", 20, false) || "default";
    const icon = await normalizeIconConfig(rawIconType, raw.iconFileId, raw.iconValue, true);
    result.push({
      key,
      enabled: raw.enabled === undefined ? true : Boolean(raw.enabled),
      name: cleanText(raw.name, "内置菜单名称", 30, false),
      iconType: icon.iconType,
      iconFileId: icon.iconFileId,
      iconValue: icon.iconValue,
    });
  }
  return result;
}

export async function normalizeSidebarMenuConfig(body: unknown): Promise<Omit<SidebarMenuStoredConfig, "updatedAt">> {
  const root = requireObject(body, "侧栏菜单配置");
  const builtinItems = await normalizeBuiltinItems(root.builtinItems);

  const rawSectionsInput = Array.isArray(root.listSections)
    ? root.listSections
    : root.listSection
      ? [root.listSection]
      : [];
  if (rawSectionsInput.length > 20) {
    throw new Error("横栏区块数量不能超过 20 个");
  }

  const gridRaw = requireObject(root.gridSection ?? {}, "四宫格入口配置");
  const gridItemsRaw = Array.isArray(gridRaw.items) ? gridRaw.items : [];
  if (gridItemsRaw.length > 50) {
    throw new Error("四宫格菜单项不能超过 50 个");
  }

  const seenSectionIds = new Set<string>();
  const seenItemIds = new Set<string>();
  const listSections: SidebarListSectionStored[] = [];

  for (let sIdx = 0; sIdx < rawSectionsInput.length; sIdx++) {
    const secRaw = requireObject(rawSectionsInput[sIdx], "横栏区块");
    const secId = cleanText(secRaw.id, "横栏区块 ID", 64, false) || `section_${randomUUID().slice(0, 8)}`;
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(secId)) {
      throw new Error("横栏区块 ID 仅允许字母、数字、下划线和短横线");
    }
    if (seenSectionIds.has(secId)) {
      throw new Error(`横栏区块 ID 重复：${secId}`);
    }
    seenSectionIds.add(secId);

    const itemsRaw = Array.isArray(secRaw.items) ? secRaw.items : [];
    if (itemsRaw.length > 50) {
      throw new Error("单个区块菜单项不能超过 50 个");
    }
    const items: SidebarMenuStoredItem[] = [];
    for (let i = 0; i < itemsRaw.length; i++) {
      items.push(await normalizeMenuItem(itemsRaw[i], "list", i, seenItemIds));
    }

    listSections.push({
      id: secId,
      enabled: secRaw.enabled === undefined ? true : Boolean(secRaw.enabled),
      sortOrder: Number.isFinite(Number(secRaw.sortOrder)) ? Math.trunc(Number(secRaw.sortOrder)) : sIdx,
      title: cleanText(secRaw.title ?? "", "横栏区块标题", 20, false),
      items,
    });
  }

  const gridItems: SidebarMenuStoredItem[] = [];
  for (let i = 0; i < gridItemsRaw.length; i++) {
    gridItems.push(await normalizeMenuItem(gridItemsRaw[i], "grid", i, seenItemIds));
  }

  return {
    builtinItems,
    listSections: listSections.sort((a, b) => a.sortOrder - b.sortOrder),
    gridSection: {
      enabled: Boolean(gridRaw.enabled),
      position: gridRaw.position === "bottom" ? "bottom" : "top",
      items: gridItems,
    },
  };
}

async function resolveItemIconUrl(
  iconType: SidebarBuiltinIconType,
  iconFileId: string | null,
  iconValue: string,
  absolutizeUrl?: (url: string) => string,
): Promise<string> {
  if (iconType !== "image") return "";
  if (iconFileId) {
    const file = await readFileRecordById(iconFileId);
    if (!file || file.status !== "uploaded") return "";
    const rawUrl = buildUrl(file.objectKey, "public-image");
    return absolutizeUrl ? absolutizeUrl(rawUrl) : rawUrl;
  }
  return iconValue;
}

export async function readAdminSidebarMenu(): Promise<AdminSidebarMenuConfig> {
  const cfg = await readSidebarMenuConfig();
  const hydrateItems = async (items: SidebarMenuStoredItem[]): Promise<AdminSidebarMenuItem[]> =>
    Promise.all(
      [...items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(async (item) => ({
          ...item,
          iconUrl: await resolveItemIconUrl(item.iconType, item.iconFileId, item.iconValue),
        })),
    );

  const builtinItems = await Promise.all(
    cfg.builtinItems.map(async (item) => ({
      ...item,
      iconUrl: await resolveItemIconUrl(item.iconType, item.iconFileId, item.iconValue),
    })),
  );

  const listSections = await Promise.all(
    [...cfg.listSections]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(async (sec) => ({
        ...sec,
        items: await hydrateItems(sec.items),
      })),
  );

  return {
    builtinItems,
    listSections,
    gridSection: {
      ...cfg.gridSection,
      items: await hydrateItems(cfg.gridSection.items),
    },
    updatedAt: cfg.updatedAt,
  };
}

export async function saveManagedSidebarMenu(body: unknown): Promise<AdminSidebarMenuConfig> {
  const normalized = await normalizeSidebarMenuConfig(body);
  await saveSidebarMenuConfig(normalized);
  return readAdminSidebarMenu();
}

export function parseSidebarMenuSchemaVersion(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return Number.parseInt(raw.trim(), 10);
  }
  return 1;
}

export async function readPublicSidebarMenu(
  absolutizeUrl: (url: string) => string,
  schemaVersion = 1,
): Promise<PublicSidebarMenuConfig> {
  const cfg = await readSidebarMenuConfig();

  // 旧版本客户端（未传 schemaVersion >= 2）返回空壳，防止新数据结构或 app_action 引发异常
  if (schemaVersion < CURRENT_SIDEBAR_MENU_SCHEMA_VERSION) {
    return {
      schemaVersion: 1,
      listSection: {
        enabled: false,
        title: "",
        items: [],
      },
      gridSection: {
        enabled: false,
        position: "top",
        items: [],
      },
      updatedAt: cfg.updatedAt,
    };
  }

  const buildPublicItems = async (
    items: SidebarMenuStoredItem[],
    section: "list" | "grid",
  ): Promise<PublicSidebarMenuItem[]> => {
    const sorted = [...items].filter((i) => i.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
    const result: PublicSidebarMenuItem[] = [];
    for (const item of sorted) {
      let iconType = item.iconType;
      let iconValue = item.iconValue;
      if (iconType === "image") {
        const resolvedUrl = await resolveItemIconUrl(item.iconType, item.iconFileId, item.iconValue, absolutizeUrl);
        if (!resolvedUrl) {
          if (section === "grid") continue;
          iconType = "none";
          iconValue = "";
        } else {
          iconValue = resolvedUrl;
        }
      }
      result.push({
        id: item.id,
        sortOrder: item.sortOrder,
        name: item.name,
        iconType,
        iconValue,
        badgeType: item.badgeType,
        subtitleText: item.badgeType === "text" ? item.subtitleText : "",
        badgeVersion: item.badgeVersion,
        openType: item.openType,
        url: item.openType === "app_action" ? "" : item.url,
        actionKey: item.openType === "app_action" ? item.actionKey : "",
      });
    }
    return result;
  };

  const builtinItems: PublicSidebarBuiltinItem[] = await Promise.all(
    cfg.builtinItems.map(async (item) => {
      let iconType = item.iconType;
      let iconValue = item.iconValue;
      if (iconType === "image") {
        const resolvedUrl = await resolveItemIconUrl(item.iconType, item.iconFileId, item.iconValue, absolutizeUrl);
        if (!resolvedUrl) {
          iconType = "default";
          iconValue = "";
        } else {
          iconValue = resolvedUrl;
        }
      }
      return {
        key: item.key,
        enabled: item.enabled,
        name: item.name,
        iconType,
        iconValue,
      };
    }),
  );

  const listSections: PublicSidebarListSection[] = [];
  for (const sec of [...cfg.listSections].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (!sec.enabled) continue;
    const items = await buildPublicItems(sec.items, "list");
    if (!items.length) continue;
    listSections.push({
      id: sec.id,
      enabled: true,
      sortOrder: sec.sortOrder,
      title: sec.title,
      items,
    });
  }

  const gridItems = cfg.gridSection.enabled ? await buildPublicItems(cfg.gridSection.items, "grid") : [];
  const firstListSection = listSections[0];

  return {
    schemaVersion: CURRENT_SIDEBAR_MENU_SCHEMA_VERSION,
    builtinItems,
    listSections,
    listSection: firstListSection
      ? { enabled: true, title: firstListSection.title, items: firstListSection.items }
      : { enabled: false, title: "", items: [] },
    gridSection: {
      enabled: cfg.gridSection.enabled && gridItems.length > 0,
      position: cfg.gridSection.position,
      items: gridItems,
    },
    updatedAt: cfg.updatedAt,
  };
}

export async function createSidebarMenuIconToken(body: unknown) {
  const b = body as Record<string, unknown> | null;
  const fileName = cleanText(b?.fileName, "文件名", 255, true);
  const mimeType = cleanText(b?.mimeType, "图片类型", 80, true).toLowerCase();
  const fileSize = b?.fileSize;
  if (typeof fileSize !== "number" || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_ICON_BYTES) {
    throw new Error("图标大小必须在 1B 至 2MiB 之间");
  }
  if (MIME_BY_EXT[path.extname(fileName).toLowerCase()] !== mimeType) {
    throw new Error("图标仅支持 JPG、PNG、WebP，扩展名与 MIME 必须一致");
  }
  const input = { fileName, fileSize, mimeType };
  const token = createSidebarMenuIconUploadToken(input);
  await rememberSidebarMenuIconUpload(token.key, { ...input, bucket: token.bucket }, token.expiresAt);
  return token;
}

function iconDto(file: NonNullable<Awaited<ReturnType<typeof readFileRecordById>>>) {
  return {
    fileId: file.id,
    url: buildUrl(file.objectKey, "public-image"),
    fileName: file.fileName,
    fileSize: file.fileSize,
    mimeType: file.mimeType,
  };
}

export async function completeSidebarMenuIcon(body: unknown) {
  const b = body as Record<string, unknown> | null;
  const key = cleanText(b?.key, "对象 Key", 500, true);
  const bucket = cleanText(b?.bucket, "空间", 255, true);
  const session = await readSidebarMenuIconUpload(key);
  if (!session) throw new Error("上传会话不存在");
  const input = JSON.parse(session.input_json) as {
    fileName: string;
    fileSize: number;
    mimeType: string;
    bucket: string;
  };
  if (input.bucket !== bucket) throw new Error("上传空间不匹配");
  if (session.file_id) {
    const existing = await readFileRecordById(session.file_id);
    if (!existing || existing.status !== "uploaded") throw new Error("图标已删除，请重新上传");
    return iconDto(existing);
  }
  if (session.expires_at < Date.now()) throw new Error("上传会话已过期，请重新上传");

  const stat = await statQiniuObjectInSpace("public-image", bucket, key);
  if (stat.fileSize !== input.fileSize || stat.mimeType !== input.mimeType) {
    throw new Error("图片实际大小或类型与声明不一致");
  }
  const response = await fetch(`${buildUrl(key, "public-image")}?imageInfo`, {
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("七牛图片信息核验失败");
  const info = (await response.json()) as { format?: string; width?: number; height?: number };
  const format = String(info.format ?? "").toLowerCase();
  const width = Number(info.width);
  const height = Number(info.height);
  if (
    !["jpeg", "jpg", "png", "webp"].includes(format) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 2048 ||
    height > 2048
  ) {
    throw new Error("图标必须是宽高不超过 2048px 的 JPG、PNG 或 WebP 图片");
  }
  const detectedMime = format === "jpg" || format === "jpeg" ? "image/jpeg" : `image/${format}`;
  if (detectedMime !== input.mimeType) {
    throw new Error("图片实际格式与声明不一致");
  }
  const completed = await readSidebarMenuIconUpload(key);
  if (completed?.file_id) {
    const existing = await readFileRecordById(completed.file_id);
    if (!existing || existing.status !== "uploaded" || deletingSidebarMenuIcons.has(existing.id)) {
      throw new Error("图标已删除或正在删除，请重新上传");
    }
    return iconDto(existing);
  }
  const file = await createFileRecord({
    id: randomUUID(),
    usageType: "sidebar-menu-icon",
    platform: "",
    version: "",
    assetType: "image",
    provider: "qiniu",
    bucket,
    objectKey: key,
    hash: stat.hash,
    fileName: input.fileName,
    mimeType: stat.mimeType,
    fileSize: stat.fileSize,
    downloadUrl: "",
  });
  await completeSidebarMenuIconUpload(key, file.id);
  return iconDto(file);
}
