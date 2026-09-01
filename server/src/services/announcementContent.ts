export const ANNOUNCEMENT_SCHEMA_VERSION = 1 as const;
export const ANNOUNCEMENT_COLORS = ["neutral", "primary", "info", "success", "warning", "danger"] as const;
export type AnnouncementColor = (typeof ANNOUNCEMENT_COLORS)[number] | (string & {});

export type AnnouncementUrlOpenMode = "browser" | "app";

export type AnnouncementAction =
  | { type: "none" }
  | { type: "copy"; label: string; value: string }
  | { type: "url"; label: string; url: string; openMode: AnnouncementUrlOpenMode }
  | { type: "protocol"; label: string; value: string };

export type AnnouncementTextBlock = {
  type: "text";
  text: string;
  bold?: boolean;
};

export type AnnouncementImageBlock = {
  type: "image";
  fileId: string;
  alt: string;
  url?: string;
};

export type AnnouncementHighlightBlock = {
  type: "highlight";
  color: AnnouncementColor;
  text: string;
  action: AnnouncementAction;
};

export type AnnouncementBlock = AnnouncementTextBlock | AnnouncementImageBlock | AnnouncementHighlightBlock;

export type AnnouncementContent = {
  schemaVersion: typeof ANNOUNCEMENT_SCHEMA_VERSION;
  blocks: AnnouncementBlock[];
};

const MAX_BLOCKS = 100;
const MAX_TEXT_LENGTH = 50000;
const MAX_BLOCK_TEXT_LENGTH = 10000;
const MAX_COPY_LENGTH = 10000;
const MAX_LABEL_LENGTH = 100;
const MAX_ALT_LENGTH = 200;
const MAX_FILE_ID_LENGTH = 120;
const INTERNAL_PROTOCOL = /^pisamusic:\/\/[A-Za-z0-9][A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$/i;
const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

export class AnnouncementContentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnnouncementContentValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") throw new AnnouncementContentValidationError(`${field} 必须是字符串`);
  const text = value.trim();
  if (!text) throw new AnnouncementContentValidationError(`${field} 不能为空`);
  if (text.length > maxLength) throw new AnnouncementContentValidationError(`${field} 不能超过 ${maxLength} 个字符`);
  return text;
}

function optionalString(value: unknown, field: string, maxLength: number): string {
  if (value === undefined) return "";
  if (typeof value !== "string") throw new AnnouncementContentValidationError(`${field} 必须是字符串`);
  if (value.length > maxLength) throw new AnnouncementContentValidationError(`${field} 不能超过 ${maxLength} 个字符`);
  return value.trim();
}

function assertKnownKeys(value: Record<string, unknown>, keys: readonly string[], field: string): void {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new AnnouncementContentValidationError(`${field}.${key} 不受支持`);
  }
}

function parseAction(value: unknown, field: string): AnnouncementAction {
  if (value === undefined) return { type: "none" };
  if (!isRecord(value)) throw new AnnouncementContentValidationError(`${field} 必须是对象`);
  const type = value.type;
  if (type === "none") {
    assertKnownKeys(value, ["type"], field);
    return { type: "none" };
  }
  const label = requiredString(value.label, `${field}.label`, MAX_LABEL_LENGTH);
  if (type === "copy") {
    assertKnownKeys(value, ["type", "label", "value"], field);
    return { type, label, value: requiredString(value.value, `${field}.value`, MAX_COPY_LENGTH) };
  }
  if (type === "url") {
    assertKnownKeys(value, ["type", "label", "url", "openMode"], field);
    const url = requiredString(value.url, `${field}.url`, 2048);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new AnnouncementContentValidationError(`${field}.url 必须是有效地址`);
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new AnnouncementContentValidationError(`${field}.url 只允许不带认证信息的 HTTPS 地址`);
    }
    if (value.openMode !== "browser" && value.openMode !== "app") {
      throw new AnnouncementContentValidationError(`${field}.openMode 只能是 browser 或 app`);
    }
    return { type, label, url: parsed.toString(), openMode: value.openMode };
  }
  if (type === "protocol") {
    assertKnownKeys(value, ["type", "label", "value"], field);
    const protocol = requiredString(value.value, `${field}.value`, 2048);
    if (!INTERNAL_PROTOCOL.test(protocol)) {
      throw new AnnouncementContentValidationError(`${field}.value 只允许 pisamusic:// 内置协议`);
    }
    return { type, label, value: protocol };
  }
  throw new AnnouncementContentValidationError(`${field}.type 不受支持`);
}

function parseBlock(value: unknown, index: number): AnnouncementBlock {
  const field = `blocks[${index}]`;
  if (!isRecord(value)) throw new AnnouncementContentValidationError(`${field} 必须是对象`);
  if (value.type === "text") {
    assertKnownKeys(value, ["type", "text", "bold"], field);
    if (typeof value.text !== "string") throw new AnnouncementContentValidationError(`${field}.text 必须是字符串`);
    if (value.text.length === 0) throw new AnnouncementContentValidationError(`${field}.text 不能为空`);
    if (value.text.length > MAX_BLOCK_TEXT_LENGTH) throw new AnnouncementContentValidationError(`${field}.text 不能超过 ${MAX_BLOCK_TEXT_LENGTH} 个字符`);
    if (value.bold !== undefined && typeof value.bold !== "boolean") throw new AnnouncementContentValidationError(`${field}.bold 必须是布尔值`);
    return { type: "text", text: value.text, ...(value.bold ? { bold: true } : {}) };
  }
  if (value.type === "image") {
    assertKnownKeys(value, ["type", "fileId", "alt", "url"], field);
    const block: AnnouncementImageBlock = {
      type: "image",
      fileId: requiredString(value.fileId, `${field}.fileId`, MAX_FILE_ID_LENGTH),
      alt: optionalString(value.alt, `${field}.alt`, MAX_ALT_LENGTH),
    };
    if (value.url !== undefined && value.url !== "") {
      if (typeof value.url !== "string") throw new AnnouncementContentValidationError(`${field}.url 必须是字符串`);
      let parsed: URL;
      try {
        parsed = new URL(value.url);
      } catch {
        throw new AnnouncementContentValidationError(`${field}.url 必须是有效地址`);
      }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
        throw new AnnouncementContentValidationError(`${field}.url 只允许 HTTPS 地址`);
      }
      block.url = parsed.toString();
    }
    return block;
  }
  if (value.type === "highlight") {
    assertKnownKeys(value, ["type", "color", "text", "action"], field);
    if (typeof value.color !== "string" || (!ANNOUNCEMENT_COLORS.includes(value.color as (typeof ANNOUNCEMENT_COLORS)[number]) && !HEX_COLOR.test(value.color))) {
      throw new AnnouncementContentValidationError(`${field}.color 不受支持`);
    }
    const text = requiredString(value.text, `${field}.text`, MAX_BLOCK_TEXT_LENGTH);
    return { type: "highlight", color: value.color as AnnouncementColor, text, action: parseAction(value.action, `${field}.action`) };
  }
  throw new AnnouncementContentValidationError(`${field}.type 不受支持`);
}

export function parseAnnouncementContent(input: unknown): AnnouncementContent {
  if (!isRecord(input)) throw new AnnouncementContentValidationError("content 必须是结构化对象");
  assertKnownKeys(input, ["schemaVersion", "blocks"], "content");
  if (input.schemaVersion !== ANNOUNCEMENT_SCHEMA_VERSION) {
    throw new AnnouncementContentValidationError(`content.schemaVersion 只支持 ${ANNOUNCEMENT_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(input.blocks)) throw new AnnouncementContentValidationError("content.blocks 必须是数组");
  if (input.blocks.length === 0) throw new AnnouncementContentValidationError("公告内容至少需要一个内容块");
  if (input.blocks.length > MAX_BLOCKS) throw new AnnouncementContentValidationError(`公告内容不能超过 ${MAX_BLOCKS} 个内容块`);
  const blocks = input.blocks.map(parseBlock);
  const textLength = blocks.reduce((sum, block) => sum + (block.type === "image" ? 0 : block.text.length), 0);
  if (textLength > MAX_TEXT_LENGTH) throw new AnnouncementContentValidationError(`公告文字不能超过 ${MAX_TEXT_LENGTH} 个字符`);
  return { schemaVersion: ANNOUNCEMENT_SCHEMA_VERSION, blocks };
}

export function getAnnouncementImageFileIds(content: AnnouncementContent): string[] {
  return [...new Set(content.blocks.filter((block): block is AnnouncementImageBlock => block.type === "image").map((block) => block.fileId))];
}

export function getAnnouncementPlainText(content: AnnouncementContent): string {
  return content.blocks
    .map((block) => (block.type === "image" ? `[图片：${block.alt || "公告图片"}]` : block.text))
    .join("\n")
    .slice(0, MAX_TEXT_LENGTH);
}

export function toStoredAnnouncementContent(content: AnnouncementContent): AnnouncementContent {
  return {
    schemaVersion: content.schemaVersion,
    blocks: content.blocks.map((block) => {
      if (block.type !== "image") return block;
      return { type: "image", fileId: block.fileId, alt: block.alt };
    }),
  };
}
