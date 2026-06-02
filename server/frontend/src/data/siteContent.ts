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
    title: "一处登录，开启音乐私域",
    desc: "通过同一款账号连接手机与电脑，无需任何繁杂的配对步骤，让倾听的世界从此不设分界。",
    icon: ShieldCheck,
    accent: "bg-sky-100 text-sky-700",
  },
  {
    title: "心动歌单，随时轻装随行",
    desc: "您的收藏列表与自建歌单在云端静静守护，无论置身于哪台设备，您的挚爱旋律皆能如约而至。",
    icon: Heart,
    accent: "bg-rose-100 text-rose-700",
  },
  {
    title: "纯净同步，只留最爱余音",
    desc: "我们只专注于同步歌词与曲目的名字本身，绝不夹带冗余的路径与本地缓存，保证同步一气呵成。",
    icon: Cloud,
    accent: "bg-emerald-100 text-emerald-700",
  },
];

export const desktopHighlights = [
  {
    title: "极简悬浮歌词",
    desc: "支持桌面置顶、虚化与透明度微调，歌词如流水般在屏幕一隅静静吟唱，无需切回主界面。",
    icon: Waves,
    accent: "bg-sky-50 text-sky-600 border border-sky-100/40",
  },
  {
    title: "全景本地收纳",
    desc: "一键扫描本地硬盘音频，与线上歌单和下载记录融为一体，长年累月的累积依旧井然有序。",
    icon: FileAudio,
    accent: "bg-emerald-50 text-emerald-600 border border-emerald-100/40",
  },
  {
    title: "合流统一曲库",
    desc: "心动红心、自制列表以及外部歌单本地缓存一网打尽，统一承载，再也不怕挚爱曲目零落失散。",
    icon: Disc3,
    accent: "bg-purple-50 text-purple-600 border border-purple-100/40",
  },
  {
    title: "书架层级导航",
    desc: "为你精心准备的书架式极简导航。收藏、推荐、本地与设置纵向层叠，让整理习惯如呼吸般自然。",
    icon: ListMusic,
    accent: "bg-rose-50 text-rose-600 border border-rose-100/40",
  },
  {
    title: "托盘常驻与热键",
    desc: "支持系统托盘常驻与系统全局快捷键。不论你在写作、编程或设计，旋律始终在指尖听令。",
    icon: Keyboard,
    accent: "bg-amber-50 text-amber-600 border border-amber-100/40",
  },
  {
    title: "多端贯通体验",
    desc: "倾听报告、云盘空间及新版特性公告均深度贯通。只需一次登录，即可无拘无束地在多端徜徉。",
    icon: Radio,
    accent: "bg-cyan-50 text-cyan-600 border border-cyan-100/40",
  },
];

export const sourcePills = [
  { label: "KG", image: "/assets/source-kg.png", color: "border-sky-200 bg-sky-50 text-sky-700" },
  { label: "WY", image: "/assets/source-wy.png", color: "border-rose-200 bg-rose-50 text-rose-700" },
  { label: "KW", image: null, color: "border-amber-200 bg-amber-50 text-amber-700" },
];
