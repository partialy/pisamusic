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

export const colorPresets = ["#0f172a", "#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#ec4899"];

export const glassCardClasses =
  "min-w-0 bg-white/60 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-6 lg:p-8 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] lg:hover:-translate-y-1";

export const glassInputClasses =
  "w-full min-w-0 rounded-2xl border border-white/60 bg-white/50 px-4 sm:px-5 py-3 text-sm text-slate-800 focus:bg-white/90 focus:outline-none focus:ring-2 focus:ring-slate-400/30 transition-all shadow-inner";

export const tabs = [
  { id: "dashboard" as const, name: "仪表盘", icon: "M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-12h8V3h-8v6z" },
  { id: "system" as const, name: "系统配置", icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { id: "websiteRecords" as const, name: "官网记录", icon: "M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.25-2.46 3.5-5.63 3.5-9S14.25 5.46 12 3c-2.25 2.46-3.5 5.63-3.5 9s1.25 6.54 3.5 9zM3.6 9h16.8M3.6 15h16.8" },
  { id: "users" as const, name: "用户管理", icon: "M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m0-4a4 4 0 100-8 4 4 0 000 8zm8 0a3 3 0 100-6 3 3 0 000 6z" },
  { id: "listeningLevels" as const, name: "听歌等级", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
  { id: "devices" as const, name: "设备管理", icon: "M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" },
  { id: "update" as const, name: "版本发布", icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
  { id: "announcements" as const, name: "公告管理", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" },
  { id: "files" as const, name: "文件管理", icon: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" },
  { id: "cloudMusic" as const, name: "网盘音乐", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
  { id: "feedback" as const, name: "反馈管理", icon: "M8 10h8M8 14h5m8-2a9 9 0 11-4.219-7.624L21 3v9z" },
  { id: "faultReports" as const, name: "故障管理", icon: "M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.052 3.38c.866-1.5 3.03-1.5 3.896 0l7.355 12.746zM12 16.5h.008v.008H12V16.5z" },
  { id: "shares" as const, name: "分享管理", icon: "M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.46.596.8.761l7.032 3.516m-7.032-4.277l7.032-3.516a2.25 2.25 0 10-.966-1.78m.966 1.78a2.25 2.25 0 000 3.22m0 0a2.25 2.25 0 10.966 1.78" },
  { id: "content" as const, name: "内容与协议", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  { id: "dynamicConfig" as const, name: "动态配置", icon: "M4.5 12a7.5 7.5 0 1115 0 7.5 7.5 0 01-15 0zm7.5-4.5v9m-4.5-4.5h9" },
  { id: "encryption" as const, name: "加密白名单", icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" },
];

export type TabId = (typeof tabs)[number]["id"];
