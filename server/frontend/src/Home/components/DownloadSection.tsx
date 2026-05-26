import { ArrowDownToLine, MonitorDown, Smartphone } from "lucide-react";
import SectionHeader from "../../common/SectionHeader";
import type { UpdateState } from "../../hooks/useUpdateInfo";
import type { ReleaseInfo } from "../../types/update";

interface DownloadSectionProps {
  updateState: UpdateState;
}

function splitUpdateLines(release?: ReleaseInfo) {
  return release?.updateContent
    ? release.updateContent
        .split(/\r?\n|;/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
}

function DownloadCard({ release, type }: { release?: ReleaseInfo; type: "android" | "desktop" }) {
  const available = Boolean(release?.available && release.downloadUrl);
  const Icon = type === "android" ? Smartphone : MonitorDown;
  const lines = splitUpdateLines(release);
  const title = type === "android" ? "Android 版" : "PC 版";
  const unavailableText = type === "desktop" ? "PisaMusic 桌面版正在最后准备中，敬请期待。" : "正式安装包准备好后会在这里开放下载。";

  return (
    <article className="rise-in rounded-lg border border-slate-200 bg-white p-5 shadow-panel sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400">{release?.platformLabel ?? title}</p>
          <h3 className="mt-2 text-3xl font-black text-pisa-ink">{release?.latestVersion ?? "获取中"}</h3>
          <p className="mt-2 text-sm font-bold text-slate-500">{release?.updateTime || (available ? "更新时间暂不可用" : "下载通道暂未开启")}</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${available ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {available ? `可下载${release?.fileSizeText ? ` · ${release.fileSizeText}` : ""}` : "即将开放"}
        </span>
      </div>

      <div className="mt-7 rounded-lg bg-slate-50 p-4">
        <p className="text-sm font-black text-pisa-ink">版本说明</p>
        {lines.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-7 text-slate-500">{available ? "更新说明会在新版本发布时同步展示。" : unavailableText}</p>
        )}
      </div>

      <a
        href={available ? release?.downloadUrl : "#download"}
        aria-disabled={!available}
        className={`mt-7 inline-flex h-13 w-full items-center justify-center gap-3 rounded-full px-6 py-4 text-base font-black transition duration-300 sm:h-14 ${
          available
            ? "bg-pisa-blue text-white shadow-glow hover:-translate-y-0.5 hover:bg-sky-500"
            : "cursor-not-allowed bg-slate-200 text-slate-500"
        }`}
      >
        <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
        {available ? `下载${title}` : `${title}即将开放`}
      </a>
    </article>
  );
}

export default function DownloadSection({ updateState }: DownloadSectionProps) {
  return (
    <section id="download" className="bg-[#f8fcff] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="rise-in">
          <SectionHeader
            eyebrow="下载"
            title="按你的设备，选择当下的版本。"
            desc="Android 与 PC 版各自独立维护。旧版 App 仍沿用原有更新通道，官网优先展示双端最新发布信息。"
            align="center"
          />
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <DownloadCard release={updateState.data?.android ?? undefined} type="android" />
          <DownloadCard release={updateState.data?.desktop ?? undefined} type="desktop" />
        </div>

        {updateState.error ? (
          <p className="rise-in mt-6 text-center text-sm font-bold text-amber-700">下载信息暂时未能更新，请稍后再试。</p>
        ) : null}
      </div>
    </section>
  );
}
