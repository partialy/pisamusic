import { theme as antdTheme, type ThemeConfig } from "antd";

export const bgPresets = [
  {
    base: "from-indigo-50 via-purple-50 to-pink-50",
    darkBase: "dark:from-slate-950 dark:via-indigo-950/70 dark:to-slate-950",
    blob1: "bg-purple-300/40 dark:bg-purple-600/25",
    blob2: "bg-pink-300/40 dark:bg-fuchsia-600/20",
    blob3: "bg-sky-300/40 dark:bg-indigo-600/25",
  },
  {
    base: "from-blue-50 via-cyan-50 to-sky-50",
    darkBase: "dark:from-slate-950 dark:via-sky-950/70 dark:to-slate-950",
    blob1: "bg-blue-300/40 dark:bg-blue-600/25",
    blob2: "bg-cyan-300/40 dark:bg-cyan-600/20",
    blob3: "bg-sky-300/40 dark:bg-sky-600/25",
  },
  {
    base: "from-emerald-50 via-teal-50 to-green-50",
    darkBase: "dark:from-slate-950 dark:via-emerald-950/60 dark:to-slate-950",
    blob1: "bg-emerald-300/40 dark:bg-emerald-600/25",
    blob2: "bg-teal-300/40 dark:bg-teal-600/20",
    blob3: "bg-green-300/40 dark:bg-green-600/20",
  },
  {
    base: "from-orange-50 via-amber-50 to-yellow-50",
    darkBase: "dark:from-slate-950 dark:via-amber-950/50 dark:to-slate-950",
    blob1: "bg-orange-300/40 dark:bg-orange-600/20",
    blob2: "bg-amber-300/40 dark:bg-amber-600/20",
    blob3: "bg-yellow-300/40 dark:bg-yellow-600/15",
  },
  {
    base: "from-rose-50 via-red-50 to-pink-50",
    darkBase: "dark:from-slate-950 dark:via-rose-950/55 dark:to-slate-950",
    blob1: "bg-rose-300/40 dark:bg-rose-600/20",
    blob2: "bg-red-300/40 dark:bg-red-600/20",
    blob3: "bg-pink-300/40 dark:bg-pink-600/20",
  },
  {
    base: "from-slate-100 via-gray-50 to-zinc-100",
    darkBase: "dark:from-slate-950 dark:via-slate-900 dark:to-zinc-950",
    blob1: "bg-slate-300/40 dark:bg-slate-600/20",
    blob2: "bg-gray-300/40 dark:bg-gray-600/20",
    blob3: "bg-zinc-300/40 dark:bg-zinc-600/20",
  },
  {
    base: "from-fuchsia-50 via-purple-50 to-indigo-50",
    darkBase: "dark:from-slate-950 dark:via-purple-950/65 dark:to-slate-950",
    blob1: "bg-fuchsia-300/40 dark:bg-fuchsia-600/25",
    blob2: "bg-purple-300/40 dark:bg-purple-600/20",
    blob3: "bg-indigo-300/40 dark:bg-indigo-600/25",
  },
  {
    base: "from-amber-50 via-orange-50 to-rose-50",
    darkBase: "dark:from-slate-950 dark:via-stone-900 dark:to-slate-950",
    blob1: "bg-amber-300/40 dark:bg-amber-600/20",
    blob2: "bg-orange-300/40 dark:bg-orange-600/20",
    blob3: "bg-rose-300/40 dark:bg-rose-600/20",
  },
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

/** 仅用于 LoginPage 等非 AntD 独立玻璃 div 容器（自带 p-4） */
export const glassCardClasses =
  "min-w-0 bg-white/70 dark:bg-slate-900/75 backdrop-blur-xl rounded-2xl border border-white/80 dark:border-slate-700/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.35)] p-4 transition-all duration-300";

/** 用于 AntD <Card> 的统一玻璃态卡片类名（不额外叠加 p-4，避免与 Card body 双层内边距） */
export const adminCardClasses =
  "min-w-0 !bg-white/80 dark:!bg-slate-900/75 backdrop-blur-xl !rounded-2xl border border-white/80 dark:border-slate-700/60 shadow-sm transition-all duration-300";

/** 仅用于 LoginPage 原生输入框，业务表单统一使用 AntD Input */
export const glassInputClasses =
  "w-full min-w-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400/30 transition-all";

/** 全站 Modal 宽度四档标准 */
export const MODAL_WIDTH = {
  sm: 480,
  md: 640,
  lg: 800,
  xl: 1000,
} as const;

/** 全站长内容 Modal 统一滚动容器类名 */
export const MODAL_BODY_SCROLL_CLASS =
  "space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1";

export function getAdminThemeConfig(
  isDark: boolean,
  colorPrimary?: string,
): ThemeConfig {
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      ...(colorPrimary ? { colorPrimary } : {}),
      borderRadius: 8,
      controlHeight: 32,
      controlHeightSM: 24,
      controlHeightLG: 40,
    },
    components: {
      Card: {
        borderRadiusLG: 16,
      },
      Modal: {
        borderRadiusLG: 16,
      },
    },
  };
}
