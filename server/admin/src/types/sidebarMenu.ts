export type SidebarIconType = "none" | "image" | "svg" | "preset";
export type SidebarBuiltinIconType = "default" | SidebarIconType;
export type SidebarBadgeType = "none" | "text" | "dot_once" | "dot_always";
export type SidebarOpenType = "web" | "fullscreen_web" | "app_action";
export type SidebarGridPosition = "top" | "bottom";
export type SidebarSectionKind = "list" | "grid";
export type SidebarBuiltinKey = "import_playlists" | "link_import" | "sleep_timer" | "theme";

export type SidebarBuiltinItem = {
  key: SidebarBuiltinKey;
  enabled: boolean;
  name: string;
  iconType: SidebarBuiltinIconType;
  iconFileId: string | null;
  iconValue: string;
  iconUrl: string;
};

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
  actionKey: string;
};

export type SidebarListSection = {
  id: string;
  enabled: boolean;
  sortOrder: number;
  title: string;
  items: SidebarMenuItem[];
};

export type SidebarGridSection = {
  enabled: boolean;
  position: SidebarGridPosition;
  items: SidebarMenuItem[];
};

export type SidebarMenuConfig = {
  builtinItems: SidebarBuiltinItem[];
  listSections: SidebarListSection[];
  gridSection: SidebarGridSection;
  updatedAt: number;
};

export type SidebarPresetIconOption = {
  key: string;
  label: string;
};

export const SIDEBAR_BUILTIN_META: Array<{
  key: SidebarBuiltinKey;
  defaultName: string;
  defaultIconKey: string;
  description: string;
}> = [
  { key: "import_playlists", defaultName: "导入歌单", defaultIconKey: "login", description: "进入三方账号管理与导入歌单" },
  { key: "link_import", defaultName: "链接导入", defaultIconKey: "link", description: "弹窗粘贴网易云/酷狗歌单链接" },
  { key: "sleep_timer", defaultName: "定时关闭", defaultIconKey: "alarm", description: "设置/查看睡眠定时倒计时" },
  { key: "theme", defaultName: "主题外观", defaultIconKey: "theme", description: "切换浅色/深色/跟随系统主题" },
];

export const SIDEBAR_APP_ACTION_OPTIONS: Array<{ key: string; label: string }> = [
  { key: "discover", label: "发现页" },
  { key: "announcements", label: "系统公告" },
  { key: "check_update", label: "检查更新" },
  { key: "feedback", label: "意见反馈" },
  { key: "scan", label: "扫码" },
  { key: "settings", label: "设置" },
  { key: "login", label: "登录页" },
  { key: "profile", label: "资料页（未登录进入登录页）" },
  { key: "about", label: "关于页面" },
  { key: "share_app", label: "分享App" },
  { key: "data_management", label: "数据管理" },
  { key: "download_settings", label: "下载设置" },
  { key: "playback_settings", label: "播放设置" },
];

export function getSidebarAppActionLabel(actionKey: string): string {
  return SIDEBAR_APP_ACTION_OPTIONS.find((item) => item.key === actionKey)?.label ?? actionKey;
}

export const SIDEBAR_PRESET_ICON_OPTIONS: SidebarPresetIconOption[] = [
  { key: "link", label: "link（链接）" },
  { key: "login", label: "login（导入/登录）" },
  { key: "alarm", label: "alarm（定时/闹钟）" },
  { key: "theme", label: "theme（主题外观）" },
  { key: "feedback", label: "feedback（意见反馈）" },
  { key: "announcement", label: "announcement（系统公告）" },
  { key: "update", label: "update（检查更新/火箭）" },
  { key: "settings", label: "settings（设置）" },
  { key: "scan", label: "scan（扫一扫）" },
  { key: "about", label: "about（关于/信息）" },
  { key: "share", label: "share（分享）" },
  { key: "download", label: "download（下载）" },
  { key: "audio_quality", label: "audio_quality（音质/播放）" },
  { key: "play", label: "play（播放）" },
  { key: "library", label: "library（资料库/数据）" },
  { key: "history", label: "history（历史/最近）" },
];
