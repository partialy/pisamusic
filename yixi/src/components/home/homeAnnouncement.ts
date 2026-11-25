import type { AnnouncementAction, AnnouncementBlock, AnnouncementContent } from "@/types/announcement";

export type { Announcement, AnnouncementBlock } from "@/types/announcement";

const COLOR_MAP: Record<string, string> = {
  neutral: "#475569",
  primary: "#4f46e5",
  info: "#0284c7",
  success: "#059669",
  warning: "#d97706",
  danger: "#e11d48",
};

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const LEGACY_HIGHLIGHT_COLOR = /^#(?:[0-9a-f]{5}|[0-9a-f]{7})$/i;

function isAnnouncementColor(value: unknown): value is string {
  return typeof value === "string" && (Object.prototype.hasOwnProperty.call(COLOR_MAP, value) || HEX_COLOR.test(value));
}
const HTTPS_URL = /^https:\/\/[^\s]+$/i;
const PISA_PROTOCOL = /^pisamusic:\/\/[A-Za-z0-9][A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAnnouncementAction(value: unknown): AnnouncementAction {
  if (!isRecord(value) || value.type === "none" || value.type === undefined) return { type: "none" };
  const label = typeof value.label === "string" ? value.label : "打开";
  if (value.type === "copy" && typeof value.value === "string") return { type: "copy", label, value: value.value };
  if (value.type === "url" && typeof value.url === "string" && HTTPS_URL.test(value.url)) {
    return {
      type: "url",
      label,
      url: value.url,
      openMode: value.openMode === "browser" ? "browser" : "app",
      ...(typeof value.showHeaderBar === "boolean" ? { showHeaderBar: value.showHeaderBar } : {}),
    };
  }
  if (value.type === "page" && (value.page === "discover" || value.page === "settings")) {
    return { type: "page", label, page: value.page };
  }
  if (value.type === "protocol" && typeof value.value === "string" && PISA_PROTOCOL.test(value.value)) {
    return { type: "protocol", label, value: value.value };
  }
  return { type: "none" };
}

function parseBlock(value: unknown): AnnouncementBlock | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (value.type === "text" && typeof value.text === "string" && value.text.length > 0) {
    return {
      type: "text",
      text: value.text,
      ...(value.bold === true ? { bold: true } : {}),
      ...(value.italic === true ? { italic: true } : {}),
      ...(isAnnouncementColor(value.color) ? { color: value.color } : {}),
    };
  }
  if (value.type === "image" && typeof value.fileId === "string" && value.fileId.length > 0) {
    return {
      type: "image",
      fileId: value.fileId,
      alt: typeof value.alt === "string" ? value.alt : "公告图片",
      ...(typeof value.url === "string" && HTTPS_URL.test(value.url) ? { url: value.url } : {}),
    };
  }
  if (value.type === "highlight" && typeof value.text === "string" && value.text.length > 0 && typeof value.color === "string") {
    const color = LEGACY_HIGHLIGHT_COLOR.test(value.color) ? "neutral" : value.color;
    if (!isAnnouncementColor(color)) return null;
    return { type: "highlight", color, text: value.text, action: parseAnnouncementAction(value.action) };
  }
  return null;
}

export function normalizeAnnouncementContent(value: unknown): AnnouncementContent {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.blocks)) {
    return { schemaVersion: 1, blocks: [{ type: "text", text: "暂无公告" }] };
  }
  const blocks = value.blocks.map(parseBlock).filter((block): block is AnnouncementBlock => block !== null);
  return { schemaVersion: 1, blocks: blocks.length > 0 ? blocks : [{ type: "text", text: "暂无公告" }] };
}

export function getAnnouncementPreview(content: AnnouncementContent): string {
  const preview = content.blocks
    .map((block) => (block.type === "image" ? "【图片】" : block.text))
    .join("")
    .replace(/\r\n/g, "\n");
  return preview || "暂无公告";
}

export function resolveAnnouncementColor(color: string): string {
  return Object.prototype.hasOwnProperty.call(COLOR_MAP, color) ? COLOR_MAP[color] : HEX_COLOR.test(color) ? color : "var(--color-primary)";
}
