import {
  Cloud,
  Computer,
  Database,
  Disc3,
  Download,
  FileAudio,
  Heart,
  Keyboard,
  ListMusic,
  Mic2,
  MonitorDown,
  Radio,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FeatureItem = {
  title: string;
  desc: string;
  icon: LucideIcon;
  accent: string;
};

export type ProductInfo = {
  label: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  points: string[];
};

export const navItems = [
  { label: "双端体验", href: "#products" },
  { label: "核心能力", href: "#features" },
  { label: "跨端同步", href: "#sync" },
  { label: "下载", href: "#download" },
];

export const androidProduct: ProductInfo = {
  label: "Android · 随身而行",
  title: "为此刻而生的随身唱片盒。",
  desc: "通勤路上、睡前的片刻、突然想起一段旋律的瞬间，手机端都能快速回应。首页随心情推荐，歌词随指尖流淌，本地曲库与下载管理围绕移动场景中最自然的动作展开：找歌、收藏、带走。",
  icon: Smartphone,
  points: ["多音源，一站抵达", "沉浸式歌词页", "本地曲库与下载", "推荐歌单，常换常新"],
};

export const desktopProduct: ProductInfo = {
  label: "PC 桌面版 · 久坐长听",
  title: "为整理与停留而生的音乐书房。",
  desc: "PisaMusic 桌面版为长时间陪伴而设计。Windows 优先上线，它把曲库、歌单、桌面歌词、托盘常驻和快捷键放进一个更适合久坐长听的桌面环境里。",
  icon: Computer,
  points: ["桌面歌词，置顶透明", "SQLite 本地库", "自建歌单，云端入口", "托盘与快捷键"],
};

export const appStats = [
  { value: "随身版", label: "移动场景" },
  { value: "桌面版", label: "久坐长听" },
  { value: "云端桥", label: "悄然相连" },
];

export const sharedFeatures: FeatureItem[] = [
  {
    title: "多音源，一站搜索",
    desc: "KG / WY / KW 等来源统一汇入搜索与播放入口，化繁为简，不必在几个平台之间来回跳转。",
    icon: Search,
    accent: "bg-sky-100 text-sky-700",
  },
  {
    title: "推荐内容，不断档",
    desc: "推荐歌单、热门歌曲与个性化入口，同时服务于手机与桌面，总有新的音乐在路上。",
    icon: Sparkles,
    accent: "bg-rose-100 text-rose-700",
  },
  {
    title: "歌词体验，更完整",
    desc: "移动端沉浸播放，桌面端辅以悬浮歌词窗口，旋律与文字始终在场。",
    icon: Mic2,
    accent: "bg-indigo-100 text-indigo-700",
  },
  {
    title: "本地曲库，更可靠",
    desc: "桌面端以本地资料库收纳歌曲、收藏、自建歌单与下载记录，适合长年累月的沉淀。",
    icon: Database,
    accent: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "下载管理，更省心",
    desc: "音质自选、封面嵌入、歌词伴生文件与下载记录，让离线听歌也条理分明。",
    icon: Download,
    accent: "bg-amber-100 text-amber-700",
  },
  {
    title: "桌面操作，更顺手",
    desc: "托盘常驻、快捷键响应、窗口自由控制与细致设置项，为后台持续播放而生。",
    icon: Keyboard,
    accent: "bg-cyan-100 text-cyan-700",
  },
];

export const syncFeatures: FeatureItem[] = [
  {
    title: "账号登录，云端同步",
    desc: "手机与 PC 登录同一账号后，由云端同步收藏与歌单，无需额外绑定流程。",
    icon: ShieldCheck,
    accent: "bg-sky-100 text-sky-700",
  },
  {
    title: "收藏与歌单，增量合并",
    desc: "收藏歌曲、收藏歌单与自建歌单的变化按次序悄然合并，版本有序，冲突有解。",
    icon: Heart,
    accent: "bg-rose-100 text-rose-700",
  },
  {
    title: "跨端内容，统一口径",
    desc: "同步只关注稳定的音乐与歌单信息，播放地址、本地文件等临时内容不会进入同步流。",
    icon: Cloud,
    accent: "bg-emerald-100 text-emerald-700",
  },
];

export const desktopHighlights = [
  { icon: Waves, text: "桌面歌词置顶透明，听歌不必总切回主界面。" },
  { icon: FileAudio, text: "本地扫描、下载记录与已存歌曲统一收纳，长期整理，井井有条。" },
  { icon: Disc3, text: "自建歌单与 KG / WY 歌单缓存共用桌面曲库能力，收藏不再零散。" },
  { icon: ListMusic, text: "推荐、歌单、收藏、我的、本地与下载、设置，清晰如书架分类。" },
  { icon: Keyboard, text: "托盘常驻，快捷键响应，适合一边工作一边听。" },
  { icon: MonitorDown, text: "Windows 先行，macOS 与 Linux 版本已在路上。" },
  { icon: Radio, text: "账号、云盘、公告与反馈继续沿用统一服务，一处登录，处处通行。" },
];

export const sourcePills = [
  { label: "KG", image: "/assets/source-kg.png", color: "border-sky-200 bg-sky-50 text-sky-700" },
  { label: "WY", image: "/assets/source-wy.png", color: "border-rose-200 bg-rose-50 text-rose-700" },
  { label: "KW", image: null, color: "border-amber-200 bg-amber-50 text-amber-700" },
];
