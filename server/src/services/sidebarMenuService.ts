import { randomUUID } from "node:crypto";
import path from "node:path";
import { createFileRecord, readFileRecordById, type FileRecordInfo } from "../db/configStore";
import {
  completeSidebarMenuIconUpload,
  readSidebarMenuConfig,
  readSidebarMenuIconUpload,
  rememberSidebarMenuIconUpload,
  saveSidebarMenuConfig,
  type SidebarBadgeType,
  type SidebarGridPosition,
  type SidebarIconType,
  type SidebarMenuStoredConfig,
  type SidebarMenuStoredItem,
  type SidebarOpenType,
} from "../db/sidebarMenuStore";
import { buildUrl, createSidebarMenuIconUploadToken, statQiniuObjectInSpace } from "./qiniuReleaseFiles";

export const deletingSidebarMenuIcons = new Set<string>();

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const MAX_ICON_BYTES = 2 * 1024 * 1024;
const MAX_SVG_BYTES = 16 * 1024;

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
};

export type PublicSidebarMenuConfig = {
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

export type AdminSidebarMenuItem = SidebarMenuStoredItem & {
  iconUrl: string;
};

export type AdminSidebarMenuConfig = {
  listSection: {
    enabled: boolean;
    title: string;
    items: AdminSidebarMenuItem[];
  };
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
  const openType: SidebarOpenType = item.openType === "fullscreen_web" ? "fullscreen_web" : "web";
  const url = validateTargetUrl(item.url);

  const rawIconType = cleanText(item.iconType, "图标类型", 20, false) || (section === "grid" ? "preset" : "none");
  if (!["none", "image", "svg", "preset"].includes(rawIconType)) {
    throw new Error("不支持的图标类型");
  }
  const iconType = rawIconType as SidebarIconType;
  if (section === "grid" && iconType === "none") {
    throw new Error("九宫格入口必须配置图标");
  }

  let iconFileId: string | null = null;
  let iconValue = "";
  if (iconType === "image") {
    const fileId = item.iconFileId === null || item.iconFileId === undefined ? "" : cleanText(item.iconFileId, "图标文件 ID", 120, false);
    if (fileId) {
      const file = await readFileRecordById(fileId);
      if (!file || file.usageType !== "sidebar-menu-icon" || file.status !== "uploaded" || deletingSidebarMenuIcons.has(fileId)) {
        throw new Error("所选图标文件无效或已删除");
      }
      iconFileId = fileId;
      iconValue = "";
    } else {
      iconValue = validateImageUrl(item.iconValue);
    }
  } else if (iconType === "svg") {
    iconValue = validateAndSanitizeSvg(item.iconValue);
  } else if (iconType === "preset") {
    iconValue = cleanText(item.iconValue, "预置图标标识", 64, true);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(iconValue)) {
      throw new Error("预置图标标识仅允许字母、数字、下划线和短横线");
    }
  }

  const rawBadgeType = cleanText(item.badgeType, "角标类型", 20, false) || "none";
  if (!["none", "text", "dot_once", "dot_always"].includes(rawBadgeType)) {
    throw new Error("不支持的角标类型");
  }
  const badgeType = rawBadgeType as SidebarBadgeType;
  if (section === "grid" && badgeType === "text") {
    throw new Error("九宫格入口不支持文字副标题");
  }
  const subtitleText = badgeType === "text" ? cleanText(item.subtitleText, "副标题文字", 20, true) : "";
  const rawBadgeVersion = Number(item.badgeVersion);
  const badgeVersion = Number.isSafeInteger(rawBadgeVersion) && rawBadgeVersion >= 1 ? rawBadgeVersion : 1;

  return {
    id: rawId,
    enabled,
    sortOrder,
    name,
    iconType,
    iconFileId,
    iconValue,
    badgeType,
    subtitleText,
    badgeVersion,
    openType,
    url,
  };
}

export async function normalizeSidebarMenuConfig(body: unknown): Promise<Omit<SidebarMenuStoredConfig, "updatedAt">> {
  const root = requireObject(body, "侧栏菜单配置");
  const listRaw = requireObject(root.listSection ?? {}, "横栏入口配置");
  const gridRaw = requireObject(root.gridSection ?? {}, "九宫格入口配置");

  const listItemsRaw = Array.isArray(listRaw.items) ? listRaw.items : [];
  const gridItemsRaw = Array.isArray(gridRaw.items) ? gridRaw.items : [];
  if (listItemsRaw.length > 50 || gridItemsRaw.length > 50) {
    throw new Error("单个区域菜单项不能超过 50 个");
  }

  const seenIds = new Set<string>();
  const listItems: SidebarMenuStoredItem[] = [];
  for (let i = 0; i < listItemsRaw.length; i++) {
    listItems.push(await normalizeMenuItem(listItemsRaw[i], "list", i, seenIds));
  }
  const gridItems: SidebarMenuStoredItem[] = [];
  for (let i = 0; i < gridItemsRaw.length; i++) {
    gridItems.push(await normalizeMenuItem(gridItemsRaw[i], "grid", i, seenIds));
  }

  return {
    listSection: {
      enabled: Boolean(listRaw.enabled),
      title: cleanText(listRaw.title ?? "其他", "横栏分段标题", 20, false),
      items: listItems,
    },
    gridSection: {
      enabled: Boolean(gridRaw.enabled),
      position: gridRaw.position === "bottom" ? "bottom" : "top",
      items: gridItems,
    },
  };
}

async function resolveItemIconUrl(
  item: SidebarMenuStoredItem,
  absolutizeUrl?: (url: string) => string,
): Promise<string> {
  if (item.iconType !== "image") return "";
  if (item.iconFileId) {
    const file = await readFileRecordById(item.iconFileId);
    if (!file || file.status !== "uploaded") return "";
    const rawUrl = buildUrl(file.objectKey, "public-image");
    return absolutizeUrl ? absolutizeUrl(rawUrl) : rawUrl;
  }
  return item.iconValue;
}

export async function readAdminSidebarMenu(): Promise<AdminSidebarMenuConfig> {
  const cfg = await readSidebarMenuConfig();
  const hydrate = async (items: SidebarMenuStoredItem[]): Promise<AdminSidebarMenuItem[]> =>
    Promise.all(
      [...items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(async (item) => ({
          ...item,
          iconUrl: await resolveItemIconUrl(item),
        })),
    );
  return {
    listSection: {
      ...cfg.listSection,
      items: await hydrate(cfg.listSection.items),
    },
    gridSection: {
      ...cfg.gridSection,
      items: await hydrate(cfg.gridSection.items),
    },
    updatedAt: cfg.updatedAt,
  };
}

export async function saveManagedSidebarMenu(body: unknown): Promise<AdminSidebarMenuConfig> {
  const normalized = await normalizeSidebarMenuConfig(body);
  await saveSidebarMenuConfig(normalized);
  return readAdminSidebarMenu();
}

export async function readPublicSidebarMenu(
  absolutizeUrl: (url: string) => string,
): Promise<PublicSidebarMenuConfig> {
  const cfg = await readSidebarMenuConfig();

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
        const resolvedUrl = await resolveItemIconUrl(item, absolutizeUrl);
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
        url: item.url,
      });
    }
    return result;
  };

  const listItems = cfg.listSection.enabled ? await buildPublicItems(cfg.listSection.items, "list") : [];
  const gridItems = cfg.gridSection.enabled ? await buildPublicItems(cfg.gridSection.items, "grid") : [];

  return {
    listSection: {
      enabled: cfg.listSection.enabled && listItems.length > 0,
      title: cfg.listSection.title,
      items: listItems,
    },
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
