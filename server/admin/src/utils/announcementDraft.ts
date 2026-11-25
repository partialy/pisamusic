import type { Announcement, AnnouncementGotoAction } from "../types/config";

export const MAX_ANNOUNCEMENT_WAIT_SECONDS = 2_147_483_647;

const VERSION = /^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9a-z.-]+)?(?:\+[0-9a-z.-]+)?$/i;

function isHttpsUrl(value: string): boolean {
  if (value.trim().length > 2048) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateAnnouncementDraft(draft: Announcement): string | undefined {
  if (!draft.publisher.trim()) return "请输入发布人";
  if (!draft.time.trim()) return "请选择展示时间";
  if (!draft.confirmText.trim()) return "请输入确认按钮文案";
  const waitSeconds = draft.waitSeconds ?? 0;
  if (!Number.isInteger(waitSeconds) || waitSeconds < 0 || waitSeconds > MAX_ANNOUNCEMENT_WAIT_SECONDS) {
    return `确认等待时间必须是 0～${MAX_ANNOUNCEMENT_WAIT_SECONDS} 之间的整数秒`;
  }

  const rule = draft.versionRule;
  if (rule?.mode === "specified" && (!rule.versions.length || rule.versions.some((version) => !VERSION.test(version.trim())))) {
    return "请选择或输入至少一个有效的指定版本，例如 v2.0.0";
  }
  if (rule && "version" in rule && !VERSION.test(rule.version.trim())) return "请输入有效的版本基线，例如 v2.0.0";

  if (draft.showGotoButton) {
    const action = draft.gotoAction;
    if (action?.type === "url" && !isHttpsUrl(action.url)) return "请输入不带账号或密码的 HTTPS 前往地址";
    const legacyUrl = draft.gotoUrl?.trim() ?? "";
    if (!action && !isHttpsUrl(legacyUrl) && !/^pisamusic:\/\/[a-z0-9][^\s]*$/i.test(legacyUrl)) {
      return "请输入有效的 HTTPS 或 pisamusic:// 前往地址";
    }
  }

  if (!draft.content.blocks.length) return "公告至少需要一个内容块";
  for (const [index, block] of draft.content.blocks.entries()) {
    const prefix = `第 ${index + 1} 个内容块`;
    if (block.type === "text" && !block.text) return `${prefix}缺少文字`;
    if (block.type === "image" && !block.fileId) return `${prefix}缺少图片`;
    if (block.type !== "highlight") continue;
    if (!block.text.trim()) return `${prefix}缺少高亮文字`;
    const action = block.action;
    if (action.type === "none" || action.type === "page") continue;
    if (!action.label.trim()) return `${prefix}缺少动作名称`;
    if (action.type === "copy" && !action.value.trim()) return `${prefix}缺少要复制的内容`;
    if (action.type === "url" && !isHttpsUrl(action.url)) return `${prefix}需要有效的 HTTPS 地址`;
    if (action.type === "protocol" && !/^pisamusic:\/\/[a-z0-9][^\s]*$/i.test(action.value.trim())) {
      return `${prefix}需要有效的 pisamusic:// 地址`;
    }
  }
}

export function usesAnnouncementV2(draft: Announcement): boolean {
  return (draft.platform ?? "all") !== "all"
    || (draft.versionRule?.mode ?? "all") !== "all"
    || (draft.waitSeconds ?? 0) > 0
    || (draft.showGotoButton && Boolean(draft.gotoAction))
    || draft.content.blocks.some((block) => (
      block.type === "text" ? Boolean(block.color || block.italic)
        : block.type === "highlight" && block.action.type === "page"
    ));
}

export function announcementGotoForSave(
  draft: Announcement,
  announcementVersion: number,
  savedAction?: AnnouncementGotoAction | null,
): AnnouncementGotoAction | null {
  const action = draft.gotoAction ?? null;
  if (draft.showGotoButton) return action;
  if (announcementVersion === 1) return null;
  if (action?.type === "url" && !isHttpsUrl(action.url)) return savedAction ?? null;
  return action;
}
