import { useEffect, useState } from "react";
import { Download, Monitor, QrCode, Smartphone, Sparkles, X } from "lucide-react";
import { downloadTriggerHref } from "../../api/update";

export type ModalTriggerReason = "quality" | "search_more" | "favorite" | "general";

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: ModalTriggerReason;
}

const REASON_MAP: Record<
  ModalTriggerReason,
  { title: string; subtitle: string; highlight: string }
> = {
  quality: {
    title: "畅享无损高品质音效",
    subtitle: "网页版仅提供标准 128K 体验。客户端专享无损 FLAC、Hi-Res 臻品音质与沉浸全景声。",
    highlight: "限时解锁无损特权",
  },
  search_more: {
    title: "解锁完整千万曲库",
    subtitle: "网页版仅展示前 10 首结果。下载 PisaMusic 客户端，海量歌曲、专辑、翻唱尽收囊中。",
    highlight: "查看全部搜索结果",
  },
  favorite: {
    title: "登录开启多端云同步",
    subtitle: "收藏红心歌曲、创建自建歌单、离线缓存与多端实时同步功能为客户端专属能力。",
    highlight: "开启专属音乐空间",
  },
  general: {
    title: "体验 PisaMusic 完整客户端",
    subtitle: "无损音质、桌面透明动感歌词、多源聚合与多端贯通，让每一次听歌都成为享受。",
    highlight: "双端随身与桌面长伴",
  },
};

export default function DownloadModal({ isOpen, onClose, reason = "general" }: DownloadModalProps) {
  const [platform, setPlatform] = useState<"android" | "windows" | "other">("windows");
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("android")) {
      setPlatform("android");
    } else if (ua.includes("win")) {
      setPlatform("windows");
    } else {
      setPlatform("other");
    }
  }, []);

  if (!isOpen) return null;

  const content = REASON_MAP[reason] || REASON_MAP.general;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 select-none animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-3xl border border-white/40 bg-white/95 p-6 sm:p-8 shadow-2xl shadow-sky-900/20 backdrop-blur-xl transition-all sm:my-8 z-10">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label="关闭"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Badge & Title */}
        <div className="flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 border border-sky-100 px-3 py-1 text-xs font-semibold text-sky-700 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-sky-500" />
            <span>{content.highlight}</span>
          </div>

          <h3 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {content.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 max-w-md">
            {content.subtitle}
          </p>
        </div>

        {/* Action Cards */}
        <div className="mt-6 space-y-3">
          {/* Android Download */}
          <a
            href={downloadTriggerHref("android")}
            className={`group relative flex items-center justify-between rounded-2xl border p-4 transition-all duration-300 ${
              platform === "android"
                ? "border-sky-500 bg-sky-50/50 shadow-md shadow-sky-500/10 hover:bg-sky-50"
                : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">Android 手机版</span>
                  {platform === "android" && (
                    <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      推荐此设备
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">掌心随身 · APK 直链高速下载</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-sky-600 group-hover:translate-x-0.5 transition-transform">
              <Download className="h-4 w-4" />
              <span>下载</span>
            </div>
          </a>

          {/* Windows Download */}
          <a
            href={downloadTriggerHref("desktop")}
            className={`group relative flex items-center justify-between rounded-2xl border p-4 transition-all duration-300 ${
              platform === "windows"
                ? "border-sky-500 bg-sky-50/50 shadow-md shadow-sky-500/10 hover:bg-sky-50"
                : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md shadow-slate-900/20">
                <Monitor className="h-6 w-6" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">Windows 电脑版</span>
                  {platform === "windows" && (
                    <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      推荐此设备
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">案头长伴 · 桌面悬浮透明歌词</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-sky-600 group-hover:translate-x-0.5 transition-transform">
              <Download className="h-4 w-4" />
              <span>下载</span>
            </div>
          </a>
        </div>

        {/* QR Code toggle for PC users */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setShowQr(!showQr)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-sky-600 transition-colors"
          >
            <QrCode className="h-3.5 w-3.5" />
            <span>{showQr ? "收起二维码" : "手机扫码快捷下载 App"}</span>
          </button>

          {showQr && (
            <div className="mt-3 flex flex-col items-center animate-fadeIn">
              <div className="inline-flex items-center justify-center p-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm shrink-0">
                <img
                  src="/assets/official-site-qrcode.svg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/assets/app-icon.png";
                  }}
                  alt="扫码下载 PisaMusic"
                  className="h-28 w-28 rounded-lg object-contain"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400 text-center">使用手机相机或浏览器扫码访问官网，获取最新版本</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
