import { ArrowDownToLine, RefreshCcw } from "lucide-react";
import SectionHeader from "../../common/SectionHeader";
import type { UpdateState } from "../../hooks/useUpdateInfo";

interface UpdateSectionProps {
  updateState: UpdateState;
}

export default function UpdateSection({ updateState }: UpdateSectionProps) {
  const update = updateState.data;
  const downloadHref = update?.downloadUrl || "#download";
  const updateLines = update?.updateContent
    ? update.updateContent
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];

  return (
    <section id="download" className="bg-[#f8fcff] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="grid items-center gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
          <div className="rise-in">
            <SectionHeader
              eyebrow="Download"
              title="获取当前可用的最新版本。"
              desc="下载按钮会跟随 PisaMusic 当前发布版本更新。无论是小版本修复还是体验升级，你在这里拿到的都会是最新可用安装包地址。"
            />
          </div>

          <aside className="rise-in rise-delay-2 rounded-lg border border-slate-200 bg-white p-5 shadow-panel sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-slate-400 sm:text-sm">Latest version</p>
                <h3 className="mt-2 text-3xl font-black text-pisa-ink sm:text-4xl">{update?.latestVersion ?? "获取中"}</h3>
                <p className="mt-2 text-sm font-bold text-slate-500">
                  {updateState.loading ? "正在读取更新信息" : update?.updateTime ?? "更新时间暂不可用"}
                </p>
              </div>
              <span className="w-fit rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-700">
                推荐下载最新版本 26.7MB
              </span>
            </div>

            <div className="mt-7 rounded-lg bg-slate-50 p-4 sm:mt-8">
              <p className="text-sm font-black text-pisa-ink">本次更新</p>
              {updateLines.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
                  {updateLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  {updateState.error ? "获取下载地址失败，稍后重试。" : "更新说明会在新版本发布时同步展示。"}
                </p>
              )}
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row">
              <a
                href={downloadHref}
                aria-disabled={!update?.downloadUrl}
                className={`inline-flex h-13 flex-1 items-center justify-center gap-3 rounded-full px-6 py-4 text-base font-black transition duration-300 sm:h-14 ${
                  update?.downloadUrl
                    ? "bg-pisa-blue text-white shadow-glow hover:-translate-y-0.5 hover:bg-sky-500"
                    : "cursor-not-allowed bg-slate-200 text-slate-500"
                }`}
              >
                <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
                立即下载
              </a>
              <a
                href={update?.officialUrl || "https://pisamusic.partialy.cn"}
                className="inline-flex h-13 flex-1 items-center justify-center gap-3 rounded-full border border-slate-200 bg-white px-6 py-4 text-base font-black text-pisa-ink transition duration-300 hover:border-pisa-blue hover:text-pisa-blue sm:h-14"
              >
                <RefreshCcw className="h-5 w-5" aria-hidden="true" />
                查看官网
              </a>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
