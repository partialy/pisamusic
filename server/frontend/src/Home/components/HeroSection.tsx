import { ArrowDownToLine, Radio, Sparkles } from "lucide-react";
import ProductMockup from "./ProductMockup";
import { appStats } from "../../data/siteContent";
import type { UpdateState } from "../../hooks/useUpdateInfo";

interface HeroSectionProps {
  updateState: UpdateState;
}

export default function HeroSection({ updateState }: HeroSectionProps) {
  const downloadUrl = updateState.data?.downloadUrl;
  const versionText = updateState.data?.latestVersion ?? "获取中";

  return (
    <section id="top" className="relative min-h-screen pt-20 sm:pt-24">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#f8fcff_0%,#ecf8fe_45%,#fff7ed_100%)]" aria-hidden="true" />
      <div
        className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(#27B8F4_1px,transparent_1px),linear-gradient(90deg,#27B8F4_1px,transparent_1px)] [background-size:44px_44px] sm:[background-size:56px_56px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-7 sm:px-8 sm:pb-20 lg:grid-cols-[1.02fr_0.98fr] lg:px-10 lg:pb-28 lg:pt-16">
        <div className="rise-in text-center lg:text-left">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-4 py-2 text-xs font-extrabold text-sky-700 shadow-sm sm:mb-8 sm:text-sm">
            <Radio className="h-4 w-4" aria-hidden="true" />
            安卓多音源音乐播放器
          </div>

          <h1 className="mx-auto max-w-4xl font-display text-[2.75rem] font-black leading-[0.98] text-pisa-ink sm:text-6xl lg:mx-0 lg:text-7xl">
            PisaMusic
            <span className="mt-3 block text-[1.75rem] leading-tight text-slate-700 sm:text-4xl lg:text-5xl">
              把喜欢的声音，收进一个更轻的入口。
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:mt-7 sm:text-lg sm:leading-9 lg:mx-0">
            一个为 Android 听众准备的清爽音乐播放器。搜索、推荐、歌词、本地曲库和下载管理都尽量少打扰，让你更快进入正在听的那首歌。
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center lg:justify-start">
            <a
              href={downloadUrl || "#download"}
              aria-disabled={!downloadUrl}
              className={`pill-cta pill-cta-primary ${downloadUrl ? "" : "pill-cta-disabled"}`}
            >
              <ArrowDownToLine className="relative z-10 h-5 w-5" aria-hidden="true" />
              <span className="relative z-10">{updateState.error ? "下载地址暂不可用" : "下载最新版本"}</span>
            </a>
            <a href="#features" className="pill-cta pill-cta-secondary">
              <Sparkles className="relative z-10 h-5 w-5" aria-hidden="true" />
              <span className="relative z-10">查看特色</span>
            </a>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm font-bold text-slate-500 lg:justify-start">
            <span>最新版本：{versionText}</span>
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span>{updateState.error ? "请稍后重试" : "下载地址跟随当前版本同步"}</span>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-2 sm:mt-12 sm:gap-3">
            {appStats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-white bg-white/72 p-3 shadow-sm backdrop-blur sm:p-4">
                <p className="text-sm font-black text-pisa-ink sm:text-base">{stat.value}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-500 sm:text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rise-in rise-delay-2">
          <ProductMockup />
        </div>
      </div>
    </section>
  );
}
