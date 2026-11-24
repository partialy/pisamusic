export type SidebarIconType = "none" | "image" | "svg" | "preset";
export type SidebarBadgeType = "none" | "text" | "dot_once" | "dot_always";
export type SidebarOpenType = "web" | "fullscreen_web";
export type SidebarGridPosition = "top" | "bottom";
export type SidebarSectionKind = "list" | "grid";

export type SidebarMenuItem = {
  id: string;
  enabled: boolean;
  sortOrder: number;
  name: string;
  iconType: SidebarIconType;
  iconFileId: string | null;
  iconValue: string;
  iconUrl: string;
  badgeType: SidebarBadgeType;
  subtitleText: string;
  badgeVersion: number;
  openType: SidebarOpenType;
  url: string;
};

export type SidebarListSection = {
  enabled: boolean;
  title: string;
  items: SidebarMenuItem[];
};

export type SidebarGridSection = {
  enabled: boolean;
  position: SidebarGridPosition;
  items: SidebarMenuItem[];
};

export type SidebarMenuConfig = {
  listSection: SidebarListSection;
  gridSection: SidebarGridSection;
  updatedAt: number;
};

export type SidebarPresetIconOption = {
  key: string;
  label: string;
};

export const SIDEBAR_PRESET_ICON_OPTIONS: SidebarPresetIconOption[] = [
  { key: "link", label: "link（链接）" },
  { key: "alarm", label: "alarm（定时/闹钟）" },
  { key: "theme", label: "theme（主题外观）" },
  { key: "feedback", label: "feedback（意见反馈）" },
  { key: "announcement", label: "announcement（公告）" },
  { key: "update", label: "update（更新/火箭）" },
  { key: "settings", label: "settings（设置）" },
  { key: "scan", label: "scan（扫一扫）" },
];
