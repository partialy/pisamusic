import { ArrowDownToLine, MonitorDown, Sparkles } from "lucide-react";
import ProductMockup from "./ProductMockup";
import { appStats } from "../../data/siteContent";
import type { UpdateState } from "../../hooks/useUpdateInfo";
import type { ReleaseInfo } from "../../types/update";

interface HeroSectionProps {
  updateState: UpdateState;
}

function getDownloadHref(release: ReleaseInfo | undefined) {
  return release?.available && release.downloadUrl ? release.downloadUrl : "#download";
}

export default function HeroSection({ updateState }: HeroSectionProps) {
  const android = updateState.data?.android;
  const desktop = updateState.data?.desktop;
  const androidVersion = android?.latestVersion ?? "获取中";
  const desktopVersion = desktop?.available ? desktop.latestVersion : "即将开放";

  return (
    <section id="top" className="relative min-h-screen pt-20 sm:pt-24 select-none">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#fbfcff_0%,#f0f9ff_44%,#fffbf7_100%)]" aria-hidden="true" />
      <div
        className="absolute inset-0 opacity-[0.14] [background-image:linear-gradient(#27B8F4_1px,transparent_1px),linear-gradient(90deg,#27B8F4_1px,transparent_1px)] [background-size:44px_44px] sm:[background-size:56px_56px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-7 sm:px-8 sm:pb-24 lg:grid-cols-[0.96fr_1.04fr] lg:px-10 lg:pb-28 lg:pt-16">
        <div className="rise-in text-center lg:text-left">
          {/* Refined Custom Badge with animations */}
          <div className="mb-6 inline-flex items-center gap-2.5 rounded-full border border-sky-200/60 bg-sky-50/60 px-4 py-1.5 text-xs font-bold text-sky-600 shadow-sm backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] sm:mb-8">
            <MonitorDown className="h-4 w-4 text-sky-500 animate-pulse" aria-hidden="true" />
            <span className="tracking-wider">双端一体 · 各得其所</span>
          </div>

          <h1 className="mx-auto max-w-4xl font-display text-[2.7rem] font-bold tracking-tight leading-[1.06] text-slate-900 sm:text-6xl lg:mx-0 lg:text-7xl">
            PisaMusic
            <span className="mt-3 block text-[1.65rem] font-medium leading-tight text-slate-600 tracking-tight sm:text-4xl lg:text-5xl">
              同一份热爱，自此不在喧嚣中割裂。
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-500 font-medium sm:mt-7 sm:text-lg sm:leading-9 lg:mx-0">
            手心里的唱片盒，案头前的音乐书房。PisaMusic 致力于拨开设备与场景的繁复。如行云般随身的移动客户端，与宛若书香般长伴的桌面版，各自素雅独立，又因云端和弦而默契相连。
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center lg:justify-start">
            <a
              href={getDownloadHref(android)}
              aria-disabled={!android?.available}
              className={`pill-cta pill-cta-primary ${android?.available ? "" : "pill-cta-disabled"}`}
            >
              <ArrowDownToLine className="relative z-10 h-5 w-5" aria-hidden="true" />
              <span className="relative z-10">下载 Android 随身版</span>
            </a>
            <a
              href={getDownloadHref(desktop)}
              aria-disabled={!desktop?.available}
              className={`pill-cta pill-cta-secondary ${desktop?.available ? "" : "pill-cta-disabled"}`}
            >
              <MonitorDown className="relative z-10 h-5 w-5" aria-hidden="true" />
              <span className="relative z-10">{desktop?.available ? "下载 PisaMusic 桌面版" : "桌面版即将开放"}</span>
            </a>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs font-semibold text-slate-400 lg:justify-start">
            <span>Android：{androidVersion}</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span>PC：{desktopVersion}</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span>{updateState.error ? "下载信息暂不可用" : "双端版本信息保持同步"}</span>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3 sm:mt-12 sm:gap-4">
            {appStats.map((stat) => (
              <div 
                key={stat.label} 
                className="group relative overflow-hidden rounded-2xl border border-white/60 bg-white/40 p-4 shadow-[0_2px_12px_rgba(39,184,244,0.03)] backdrop-blur-md transition-all duration-300 hover:bg-white/60 hover:shadow-[0_12px_24px_rgba(39,184,244,0.08)]"
              >
                <div className="absolute top-0 left-0 w-1 h-0 bg-sky-400 group-hover:h-full transition-all duration-300" />
                <p className="text-base font-bold text-slate-800 sm:text-lg">{stat.value}</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-400 uppercase tracking-widest sm:text-xs">{stat.label}</p>
              </div>
            ))}
          </div>

          <a href="#products" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-sky-600 transition hover:text-sky-500">
            <Sparkles className="h-4 w-4 text-sky-500 animate-pulse" aria-hidden="true" />
            了解双端体验
          </a>
        </div>

        <div className="rise-in rise-delay-2">
          <ProductMockup />
        </div>
      </div>
    </section>
  );
}
