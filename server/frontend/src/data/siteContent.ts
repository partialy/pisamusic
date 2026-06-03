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
  label: "Android · 轻盈随身",
  title: "掌心微光，温柔回应每一个旋律的呼唤。",
  desc: "无论是行色匆匆的晨间通勤，还是悄然拂面的深夜枕边，手机端都在口袋里随时等候。歌词如露水般聚散于指尖，本地歌单与下载随触随得，围绕你最自然的倾听本能进行延展：发现、触碰、安顿。",
  icon: Smartphone,
  points: ["多源寻音，一键即达", "沉浸歌词，触手可及", "随身曲库，离线无阻", "每日新声，不期而遇"],
};

export const desktopProduct: ProductInfo = {
  label: "PC 桌面版 · 案头长伴",
  title: "伏案停留，用旋律构筑一方专注之境。",
  desc: "为长时间的静默流淌与专注陪伴而谱写。桌面客户端如同一位老友默默常驻于屏幕一角。开阔的宏观歌单视域、莹澈剔透的桌面悬浮歌词，以及行云流水的全局快捷键，让你在静心劳作或沉思时，声声相伴，温润自然。",
  icon: Computer,
  points: ["莹澈置顶，悬浮歌词", "轻巧高效，本地仓储", "自建歌单，全景视域", "托盘常驻，随切随听"],
};

export const appStats = [
  { value: "随身版", label: "移动场景" },
  { value: "桌面版", label: "久坐长听" },
  { value: "云端桥", label: "悄然相连" },
];

export const sharedFeatures: FeatureItem[] = [
  {
    title: "群音汇流，无界探寻",
    desc: "各方来源音乐轻快合流，汇入轻敏快捷的检索与播放轴心。化繁为简，省去设备与客户端之间繁重无序的仓促辗转。",
    icon: Search,
    accent: "bg-sky-100 text-sky-700",
  },
  {
    title: "潮汐涌动，灵感常新",
    desc: "推荐歌单与全球热门曲库兼修并蓄，同步递送。旋律不知停驻，每一次滑动都是与未曾谋面的挚爱心弦悄然邂逅。",
    icon: Sparkles,
    accent: "bg-rose-100 text-rose-700",
  },
  {
    title: "词句在场，见字如面",
    desc: "在移动设备中深深浸溺于温暖的微浪，并在电脑前以剔透浮光轻栖桌面。音符流转，文字相依，声声在耳，诗情在目。",
    icon: Mic2,
    accent: "bg-indigo-100 text-indigo-700",
  },
  {
    title: "万家风雨，安稳栖息",
    desc: "以稳定的持久存储，妥帖盛装你的自建歌单与红心收藏。它是不随网络流失的内心壁垒，岁月累加，长久相伴。",
    icon: Database,
    accent: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "高洁归纳，落袋为安",
    desc: "细致音质自调、高精专辑封面内敛封装及歌词伴生下载。每一次离线都是从浩瀚里将一首心头好庄重地拾进衣兜。",
    icon: Download,
    accent: "bg-amber-100 text-amber-700",
  },
  {
    title: "隐音常伴，如臂使指",
    desc: "专为静默相守而琢磨。托盘隐介、全局热键一触即达。当她在后台悠悠吟唱，绝不惊动你专心耕耘的笔尖。 ",
    icon: Keyboard,
    accent: "bg-cyan-100 text-cyan-700",
  },
];

export const syncFeatures: FeatureItem[] = [
  {
    title: "一言一默，开启私属音境",
    desc: "一个账号，即是多重空间的温柔回响。无需惊动任何繁琐的配置流程，让掌心里的雀跃与深夜里的安宁从此没有边界。",
    icon: ShieldCheck,
    accent: "bg-sky-100 text-sky-700",
  },
  {
    title: "私藏岛屿，随时轻装随行",
    desc: "红心标注的热烈，自建歌单的浅唱。数据在云端默契守护，在你换下行装、切换屏幕的一瞬，挚爱歌曲依然紧随身侧。",
    icon: Heart,
    accent: "bg-rose-100 text-rose-700",
  },
  {
    title: "风过无痕，只为你留住余音",
    desc: "克制而纯净的轻量同步，仅携同那份至关重要的曲目魂灵。不留恋冗杂缓存，不占据宝贵空间，只有纯粹音符在设备间流转。",
    icon: Cloud,
    accent: "bg-emerald-100 text-emerald-700",
  },
];

export const desktopHighlights = [
  {
    title: "莹澈悬浮歌词",
    desc: "支持桌面置顶、毛玻璃虚化与透光度微调。字句如水流般在屏幕一隅静静泛起，与你的视线温和共处，不必频频切换。",
    icon: Waves,
    accent: "bg-sky-50 text-sky-600 border border-sky-100/40",
  },
  {
    title: "万籁尽数归仓",
    desc: "智能扫描本地硬盘音频，与云端线上歌单、下载记录和红心曲目无缝合流，纵有岁月累加，检索依然瞬息即得。",
    icon: FileAudio,
    accent: "bg-emerald-50 text-emerald-600 border border-emerald-100/40",
  },
  {
    title: "无界合流曲库",
    desc: "打破平台界限，多音源一网打尽。收藏、心动、自建歌单均在这里温润聚首，让你的挚爱曲目再不流落失散。",
    icon: Disc3,
    accent: "bg-purple-50 text-purple-600 border border-purple-100/40",
  },
  {
    title: "书阁层叠导航",
    desc: "书架式的极简立体导航，推荐、本地、歌单与系统设置轻柔舒展，将每一次寻乐整理折叠得如同翻阅书卷般舒适。",
    icon: ListMusic,
    accent: "bg-rose-50 text-rose-600 border border-rose-100/40",
  },
  {
    title: "托盘轻栖与热键",
    desc: "支持系统托盘轻量化驻留与全局快捷键响应。不论你在指间写下代码、描摹设计，只需轻轻一触，旋律便听令流淌。",
    icon: Keyboard,
    accent: "bg-amber-50 text-amber-600 border border-amber-100/40",
  },
  {
    title: "多端贯通鸣奏",
    desc: "深度连接，不只是数据一致。自建歌单云盘、听歌记录和双端特性公告全然贯通，一次起航，双端皆自在徜徉。",
    icon: Radio,
    accent: "bg-cyan-50 text-cyan-600 border border-cyan-100/40",
  },
];

export const sourcePills = [
  { label: "KG", image: "/assets/source-kg.png", color: "border-sky-200 bg-sky-50 text-sky-700" },
  { label: "WY", image: "/assets/source-wy.png", color: "border-rose-200 bg-rose-50 text-rose-700" },
  { label: "KW", image: null, color: "border-amber-200 bg-amber-50 text-amber-700" },
];
