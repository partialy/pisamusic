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
    <section id="top" className="relative min-h-screen pt-20 sm:pt-24">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fcff_0%,#ecf8fe_44%,#fff7ed_100%)]" aria-hidden="true" />
      <div
        className="absolute inset-0 opacity-[0.2] [background-image:linear-gradient(#27B8F4_1px,transparent_1px),linear-gradient(90deg,#27B8F4_1px,transparent_1px)] [background-size:44px_44px] sm:[background-size:56px_56px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-7 sm:px-8 sm:pb-24 lg:grid-cols-[0.96fr_1.04fr] lg:px-10 lg:pb-28 lg:pt-16">
        <div className="rise-in text-center lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-xs font-extrabold text-sky-700 shadow-sm sm:mb-8 sm:text-sm">
            <MonitorDown className="h-4 w-4" aria-hidden="true" />
            双端一体，各得其所
          </div>

          <h1 className="mx-auto max-w-4xl font-display text-[2.7rem] font-black leading-[0.98] text-pisa-ink sm:text-6xl lg:mx-0 lg:text-7xl">
            PisaMusic
            <span className="mt-3 block text-[1.65rem] leading-tight text-slate-700 sm:text-4xl lg:text-5xl">
              同一份热爱，不因设备而割裂。
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:mt-7 sm:text-lg sm:leading-9 lg:mx-0">
            手机是随身的唱片盒，电脑是私人的音乐书房。PisaMusic 以「Android 随身版」与「PisaMusic 桌面版」共同构成你的音乐入口，两端各自独立，又通过云端悄然相连。
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
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm font-bold text-slate-500 lg:justify-start">
            <span>Android：{androidVersion}</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span>PC：{desktopVersion}</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span>{updateState.error ? "下载信息暂不可用" : "双端版本信息保持同步"}</span>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-2 sm:mt-12 sm:gap-3">
            {appStats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-white bg-white/72 p-3 shadow-sm backdrop-blur sm:p-4">
                <p className="text-sm font-black text-pisa-ink sm:text-base">{stat.value}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500 sm:text-sm">{stat.label}</p>
              </div>
            ))}
          </div>

          <a href="#products" className="mt-8 inline-flex items-center gap-2 text-sm font-black text-sky-700 transition hover:text-sky-500">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
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
