export const bgPresets = [
  { base: "from-indigo-50 via-purple-50 to-pink-50", blob1: "bg-purple-300/40", blob2: "bg-pink-300/40", blob3: "bg-sky-300/40" },
  { base: "from-blue-50 via-cyan-50 to-sky-50", blob1: "bg-blue-300/40", blob2: "bg-cyan-300/40", blob3: "bg-sky-300/40" },
  { base: "from-emerald-50 via-teal-50 to-green-50", blob1: "bg-emerald-300/40", blob2: "bg-teal-300/40", blob3: "bg-green-300/40" },
  { base: "from-orange-50 via-amber-50 to-yellow-50", blob1: "bg-orange-300/40", blob2: "bg-amber-300/40", blob3: "bg-yellow-300/40" },
  { base: "from-rose-50 via-red-50 to-pink-50", blob1: "bg-rose-300/40", blob2: "bg-red-300/40", blob3: "bg-pink-300/40" },
  { base: "from-slate-100 via-gray-50 to-zinc-100", blob1: "bg-slate-300/40", blob2: "bg-gray-300/40", blob3: "bg-zinc-300/40" },
  { base: "from-fuchsia-50 via-purple-50 to-indigo-50", blob1: "bg-fuchsia-300/40", blob2: "bg-purple-300/40", blob3: "bg-indigo-300/40" },
  { base: "from-amber-50 via-orange-50 to-rose-50", blob1: "bg-amber-300/40", blob2: "bg-orange-300/40", blob3: "bg-rose-300/40" },
];

export const colorPresets = [
  "#1677ff", // Ant Design standard blue
  "#0f172a", // Slate dark
  "#0ea5e9", // Sky
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#8b5cf6", // Purple
  "#ec4899", // Pink
];

export const glassCardClasses =
  "min-w-0 bg-white/70 backdrop-blur-xl rounded-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-6 lg:p-8 transition-all duration-300";

export const glassInputClasses =
  "w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all";

export const tabs = [
  { id: "dashboard" as const, name: "仪表盘" },
  { id: "system" as const, name: "系统配置" },
  { id: "websiteRecords" as const, name: "官网记录" },
  { id: "users" as const, name: "用户管理" },
  { id: "listeningLevels" as const, name: "听歌等级" },
  { id: "devices" as const, name: "设备管理" },
  { id: "update" as const, name: "版本发布" },
  { id: "announcements" as const, name: "公告管理" },
  { id: "files" as const, name: "文件管理" },
  { id: "cloudMusic" as const, name: "网盘音乐" },
  { id: "feedback" as const, name: "反馈管理" },
  { id: "faultReports" as const, name: "故障管理" },
  { id: "shares" as const, name: "分享管理" },
  { id: "content" as const, name: "内容与协议" },
  { id: "dynamicConfig" as const, name: "动态配置" },
  { id: "encryption" as const, name: "加密白名单" },
];

export type TabId = (typeof tabs)[number]["id"];
