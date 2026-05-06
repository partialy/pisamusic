import {
  Cloud,
  Disc3,
  Download,
  FileAudio,
  Heart,
  ListMusic,
  Mic2,
  Radar,
  Search,
  ShieldCheck,
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

export type PlaylistItem = {
  title: string;
  desc: string;
  image: string;
};

export const navItems = [
  { label: "亮点", href: "#features" },
  { label: "体验", href: "#experience" },
  { label: "下载", href: "#download" },
];

export const featureItems: FeatureItem[] = [
  {
    title: "多音源一站搜索",
    desc: "在一个搜索框里同时探索多个音乐来源，少一点切换，多一点直接抵达。",
    icon: Search,
    accent: "bg-sky-100 text-sky-700",
  },
  {
    title: "每天都有新入口",
    desc: "每日推荐、猜你喜欢、雷达歌单把熟悉偏好和新鲜灵感放在首页。",
    icon: Sparkles,
    accent: "bg-rose-100 text-rose-700",
  },
  {
    title: "歌词沉浸播放",
    desc: "深色播放页、滚动歌词和清晰控制区，让听歌这件事更有仪式感。",
    icon: Mic2,
    accent: "bg-indigo-100 text-indigo-700",
  },
  {
    title: "本地曲库同样好用",
    desc: "收藏、本地音乐和自建歌单统一管理，线上线下的音乐都在一处。",
    icon: FileAudio,
    accent: "bg-emerald-100 text-emerald-700",
  },
  {
    title: "下载管理更省心",
    desc: "音质选择、封面写入、歌词写入和缓存清理，适合长期认真听歌的人。",
    icon: Download,
    accent: "bg-amber-100 text-amber-700",
  },
  {
    title: "歌单迁移更轻松",
    desc: "把已经整理好的歌单带进 PisaMusic，减少重新收藏的重复劳动。",
    icon: Cloud,
    accent: "bg-cyan-100 text-cyan-700",
  },
];

export const playlistItems: PlaylistItem[] = [
  { title: "Chill Vibes", desc: "适合夜晚、通勤和放空", image: "/assets/playlist-chill.png" },
  { title: "Focus Loop", desc: "学习工作时少切歌", image: "/assets/playlist-focus.png" },
  { title: "Gaming Pulse", desc: "节奏更强的场景歌单", image: "/assets/playlist-gaming.png" },
  { title: "City Pop", desc: "适合晴天、散步和轻快节奏", image: "/assets/playlist-pop.png" },
];

export const appStats = [
  { value: "多音源", label: "搜索与播放" },
  { value: "歌词页", label: "沉浸式体验" },
  { value: "本地库", label: "收藏与下载" },
];

export const sourcePills = [
  { label: "小蓝", image: "/assets/source-kg.png", color: "border-sky-200 bg-sky-50 text-sky-700" },
  { label: "小红", image: "/assets/source-wy.png", color: "border-rose-200 bg-rose-50 text-rose-700" },
  { label: "小黄", image: null, color: "border-amber-200 bg-amber-50 text-amber-700" },
];

export const experienceRows = [
  { icon: Disc3, text: "打开首页就能看到推荐、歌单和今日歌曲，不必先想清楚要听什么。" },
  { icon: Heart, text: "喜欢、下载、下一首播放这些高频动作，都围绕单手操作做得更顺。" },
  { icon: Waves, text: "播放页保留足够的留白和暗色氛围，让歌词成为听歌时的主角。" },
  { icon: ListMusic, text: "本地歌单、收藏歌单和导入歌单共同组成你的私人曲库。" },
  { icon: Radar, text: "雷达歌单会把反复聆听的偏好变成下一次发现音乐的线索。" },
  { icon: ShieldCheck, text: "更新、公告和基础信息在线同步，打开 App 就能获得当前可用体验。" },
];
