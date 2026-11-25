import type {
  Announcement,
  AnnouncementColor,
  AnnouncementColorPreset,
  AnnouncementPage,
  AnnouncementPlatform,
  AnnouncementVersionRule,
} from "../types/config";

export const announcementColors: Array<{ label: string; value: AnnouncementColorPreset; hex: string }> = [
  { label: "中性", value: "neutral", hex: "#475569" },
  { label: "主题", value: "primary", hex: "#4f46e5" },
  { label: "提示", value: "info", hex: "#0284c7" },
  { label: "成功", value: "success", hex: "#059669" },
  { label: "警告", value: "warning", hex: "#d97706" },
  { label: "危险", value: "danger", hex: "#e11d48" },
];

export const announcementPageLabels: Record<AnnouncementPage, string> = {
  discover: "发现",
  settings: "设置",
};

export const announcementPlatformLabels: Record<AnnouncementPlatform, string> = {
  all: "全部平台",
  mobile: "手机端",
  pc: "PC 端",
};

export const announcementPageOptions = Object.entries(announcementPageLabels).map(([value, label]) => ({ value, label }));
export const announcementPlatformOptions = Object.entries(announcementPlatformLabels).map(([value, label]) => ({ value, label }));

export function announcementColorHex(color: AnnouncementColor): string {
  return color.startsWith("#") ? color : announcementColors.find((item) => item.value === color)?.hex ?? "#0284c7";
}

export function describeAnnouncementVersion(rule?: AnnouncementVersionRule): string {
  switch (rule?.mode) {
    case "current": {
      const { mobile, pc } = rule.versions ?? {};
      const versions = [mobile && `手机端 ${mobile}`, pc && `PC 端 ${pc}`].filter(Boolean);
      return versions.length ? versions.join(" / ") : "保存时锁定当前版本";
    }
    case "specified":
      return rule.versions.join("、") || "指定版本";
    case "gte":
      return `≥ ${rule.version}`;
    case "lte":
      return `≤ ${rule.version}`;
    default:
      return "不限版本";
  }
}

export function describeAnnouncementGoto(announcement: Announcement): string | undefined {
  if (!announcement.showGotoButton) return;
  const action = announcement.gotoAction;
  if (!action) return announcement.gotoUrl ? `打开链接 · ${announcement.gotoUrl}` : undefined;
  if (action.type === "page") return `App 页面 · ${announcementPageLabels[action.page]}`;
  if (action.openMode === "browser") return `系统浏览器 · ${action.url}`;
  return `应用内网页（${action.showHeaderBar === false ? "隐藏" : "显示"}顶栏） · ${action.url}`;
}
