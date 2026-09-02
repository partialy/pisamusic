export type AdminRouteKey =
  | "dashboard"
  | "websiteRecords"
  | "users"
  | "verificationCodes"
  | "listeningLevels"
  | "devices"
  | "cloudMusic"
  | "shares"
  | "listenTogether"
  | "files"
  | "update"
  | "announcements"
  | "content"
  | "feedback"
  | "faultReports"
  | "system"
  | "dynamicConfig"
  | "runtimeConfig"
  | "encryption";

export type AdminRouteGroupKey =
  | "user_group"
  | "media_group"
  | "operation_group"
  | "maintenance_group"
  | "system_group";

export type AdminRouteItem = {
  key: AdminRouteKey;
  path: string;
  title: string;
  groupKey?: AdminRouteGroupKey;
  groupTitle?: string;
  hideGlobalActions?: boolean;
};

export const GROUP_TITLE_MAP: Record<AdminRouteGroupKey, string> = {
  user_group: "用户中心",
  media_group: "曲库与资源",
  operation_group: "运营与发布",
  maintenance_group: "监控与运维",
  system_group: "系统设置",
};

export const ADMIN_ROUTES: AdminRouteItem[] = [
  { key: "dashboard", path: "/dashboard", title: "仪表盘", hideGlobalActions: true },
  { key: "users", path: "/users", title: "用户管理", groupKey: "user_group", groupTitle: "用户中心" },
  { key: "verificationCodes", path: "/verification-codes", title: "验证码记录", groupKey: "user_group", groupTitle: "用户中心" },
  { key: "listeningLevels", path: "/listening-levels", title: "听歌等级", groupKey: "user_group", groupTitle: "用户中心" },
  { key: "devices", path: "/devices", title: "设备管理", groupKey: "user_group", groupTitle: "用户中心" },
  { key: "cloudMusic", path: "/cloud-music", title: "网盘音乐", groupKey: "media_group", groupTitle: "曲库与资源" },
  { key: "shares", path: "/shares", title: "分享管理", groupKey: "media_group", groupTitle: "曲库与资源" },
  { key: "listenTogether", path: "/listen-together", title: "一起听管理", groupKey: "media_group", groupTitle: "曲库与资源" },
  { key: "files", path: "/files", title: "文件管理", groupKey: "media_group", groupTitle: "曲库与资源" },
  { key: "websiteRecords", path: "/website-records", title: "官网记录", groupKey: "operation_group", groupTitle: "运营与发布", hideGlobalActions: true },
  { key: "update", path: "/updates", title: "版本发布", groupKey: "operation_group", groupTitle: "运营与发布" },
  { key: "announcements", path: "/announcements", title: "公告管理", groupKey: "operation_group", groupTitle: "运营与发布" },
  { key: "content", path: "/content", title: "内容与协议", groupKey: "operation_group", groupTitle: "运营与发布" },
  { key: "feedback", path: "/feedback", title: "反馈管理", groupKey: "maintenance_group", groupTitle: "监控与运维" },
  { key: "faultReports", path: "/fault-reports", title: "故障管理", groupKey: "maintenance_group", groupTitle: "监控与运维" },
  { key: "system", path: "/system", title: "系统配置", groupKey: "system_group", groupTitle: "系统设置" },
  { key: "dynamicConfig", path: "/dynamic-configs", title: "动态配置", groupKey: "system_group", groupTitle: "系统设置" },
  { key: "runtimeConfig", path: "/runtime-config", title: "运行策略", groupKey: "system_group", groupTitle: "系统设置" },
  { key: "encryption", path: "/encryption", title: "加密白名单", groupKey: "system_group", groupTitle: "系统设置" },
];

export function findAdminRouteByPath(pathname: string): AdminRouteItem | undefined {
  const cleanPath = pathname.split("?")[0].replace(/\/$/, "");
  return ADMIN_ROUTES.find((r) => r.path === cleanPath || (cleanPath === "" && r.path === "/dashboard"));
}

export function findAdminRouteByKey(key: string): AdminRouteItem | undefined {
  return ADMIN_ROUTES.find((r) => r.key === key);
}
