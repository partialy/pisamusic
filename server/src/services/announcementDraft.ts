import { readAppConfig, type Announcement } from "../db/configStore";
import { parseAnnouncementContent } from "./announcementContent";
import { ANNOUNCEMENT_VERSION, normalizeAnnouncementDelivery, type AnnouncementDelivery } from "./announcementDelivery";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRequiredString(
  value: unknown,
  field: string,
  maxLength: number,
): { ok: true; value: string } | { ok: false; msg: string } {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: false, msg: `${field} 不能为空` };
  if (text.length > maxLength) return { ok: false, msg: `${field} 长度不能超过 ${maxLength}` };
  return { ok: true, value: text };
}

function normalizeAnnouncementGotoUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  let parsed: URL;
  if (/^pisamusic:\/\/[A-Za-z0-9][A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$/i.test(raw)) return raw;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("gotoUrl 必须是有效 HTTPS 或 pisamusic:// 地址");
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw new Error("gotoUrl 只允许 HTTPS 或 pisamusic:// 地址，且 HTTPS 不得带认证信息");
  }
  return parsed.toString();
}

export async function normalizeAnnouncementDraft(
  body: unknown,
  existing?: Announcement,
): Promise<{ ok: true; value: Announcement } | { ok: false; msg: string }> {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const id = normalizeRequiredString(body.id, "id", 120);
  if (!id.ok) return id;
  let content: Announcement["content"];
  try {
    content = parseAnnouncementContent(body.content);
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "公告内容不合法" };
  }
  const time = normalizeRequiredString(body.time, "time", 100);
  if (!time.ok) return time;
  const publisher = normalizeRequiredString(body.publisher, "publisher", 120);
  if (!publisher.ok) return publisher;
  const confirmText = normalizeRequiredString(body.confirmText, "confirmText", 60);
  if (!confirmText.ok) return confirmText;
  let gotoUrl = "";
  try {
    gotoUrl = normalizeAnnouncementGotoUrl(body.gotoUrl ?? existing?.gotoUrl);
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "gotoUrl 不合法" };
  }
  const requestedVersion = body.announcementVersion;
  if (requestedVersion !== undefined && requestedVersion !== 1 && requestedVersion !== ANNOUNCEMENT_VERSION) {
    return { ok: false, msg: "公告协议版本无效" };
  }
  const announcementVersion = existing
    ? Math.max(existing.announcementVersion, requestedVersion === ANNOUNCEMENT_VERSION ? ANNOUNCEMENT_VERSION : 1)
    : ANNOUNCEMENT_VERSION;
  const rule = body.versionRule ?? existing?.versionRule;
  const needsReleaseConfig = isRecord(rule) && rule.mode === "current" &&
    (rule.versions === undefined || existing?.versionRule.mode !== "current" || (body.platform ?? existing.platform) !== existing.platform);
  const releases = needsReleaseConfig ? (await readAppConfig()).releases : undefined;
  let delivery: AnnouncementDelivery;
  try {
    delivery = normalizeAnnouncementDelivery(body, existing, releases);
    const usesV2 = delivery.platform !== "all" || delivery.versionRule.mode !== "all" ||
      delivery.waitSeconds !== 0 || delivery.gotoAction !== null ||
      content.blocks.some((block) => (
        (block.type === "text" && (block.color !== undefined || block.italic)) ||
        (block.type === "highlight" && (block.action.type === "page" ||
          (block.action.type === "url" && block.action.showHeaderBar !== undefined)))
      ));
    if (announcementVersion === 1 && usesV2) {
      return { ok: false, msg: "使用新版功能前需要确认升级到公告 V2" };
    }
  } catch (error) {
    return { ok: false, msg: error instanceof Error ? error.message : "公告配置无效" };
  }
  return {
    ok: true,
    value: {
      ...delivery,
      announcementVersion,
      id: id.value,
      content,
      time: time.value,
      publisher: publisher.value,
      confirmText: confirmText.value,
      showEveryTime: Boolean(body.showEveryTime),
      showGotoButton: Boolean(body.showGotoButton),
      gotoUrl,
      enabled: body.enabled === undefined ? existing?.enabled ?? true : Boolean(body.enabled),
    },
  };
}
