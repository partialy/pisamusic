export type AnnouncementAction =
  | { type: "none" }
  | { type: "copy"; label: string; value: string }
  | { type: "url"; label: string; url: string; openMode: "browser" | "app" }
  | { type: "protocol"; label: string; value: string };

export type AnnouncementBlock =
  | { type: "text"; text: string; bold?: boolean }
  | { type: "image"; fileId: string; alt: string; url?: string }
  | { type: "highlight"; color: string; text: string; action: AnnouncementAction };

export type AnnouncementContent = {
  schemaVersion: 1;
  blocks: AnnouncementBlock[];
};

export type Announcement = {
  id: string;
  content: AnnouncementContent;
  time: string;
  publisher: string;
  confirmText: string;
  showEveryTime?: boolean;
  showGotoButton: boolean;
  gotoUrl?: string;
};

const COLOR_MAP: Record<string, string> = {
  neutral: "#475569",
  primary: "#4f46e5",
  info: "#0284c7",
  success: "#059669",
  warning: "#d97706",
  danger: "#e11d48",
};

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;
const HTTPS_URL = /^https:\/\/[^\s]+$/i;
const PISA_PROTOCOL = /^pisamusic:\/\/[A-Za-z0-9][A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseAction(value: unknown): AnnouncementAction {
  if (!isRecord(value) || value.type === "none" || value.type === undefined) return { type: "none" };
  const label = typeof value.label === "string" ? value.label : "打开";
  if (value.type === "copy" && typeof value.value === "string") return { type: "copy", label, value: value.value };
  if (value.type === "url" && typeof value.url === "string" && HTTPS_URL.test(value.url)) {
    return { type: "url", label, url: value.url, openMode: value.openMode === "browser" ? "browser" : "app" };
  }
  if (value.type === "protocol" && typeof value.value === "string" && PISA_PROTOCOL.test(value.value)) {
    return { type: "protocol", label, value: value.value };
  }
  return { type: "none" };
}

function parseBlock(value: unknown): AnnouncementBlock | null {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (value.type === "text" && typeof value.text === "string" && value.text.length > 0) {
    return { type: "text", text: value.text, ...(value.bold === true ? { bold: true } : {}) };
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
    const color = value.color;
    if (!COLOR_MAP[color] && !HEX_COLOR.test(color)) return null;
    return { type: "highlight", color, text: value.text, action: parseAction(value.action) };
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
  return COLOR_MAP[color] ?? (HEX_COLOR.test(color) ? color : "var(--color-primary)");
}
