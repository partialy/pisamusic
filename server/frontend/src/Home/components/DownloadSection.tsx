import { ArrowDownToLine, MonitorDown, Smartphone } from "lucide-react";
import SectionHeader from "../../common/SectionHeader";
import type { UpdateState } from "../../hooks/useUpdateInfo";
import type { ReleaseInfo } from "../../types/update";
import { trackedDownloadHref } from "../../api/update";

interface DownloadSectionProps {
  updateState: UpdateState;
}

type DownloadType = "android" | "desktop";

interface DownloadContext {
  /** 当前设备建议优先展示的平台。 */
  recommendedType: DownloadType | null;
  /** 有效一起听邀请对应的浏览器返回地址。 */
  continueJoinHref: string | null;
  /** 有效一起听邀请中的房间号。 */
  roomId: string | null;
}

function splitUpdateLines(release?: ReleaseInfo) {
  return release?.updateContent
    ? release.updateContent
        .split(/\r?\n|;/)
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
}

function getDownloadContext(): DownloadContext {
  const params = new URLSearchParams(window.location.search);
  const platform = params.get("downloadPlatform");
  const type = params.get("type") || "";
  const roomId = params.get("roomId") || "";
  const validInvite = type === "listen-together-join" && /^\d{4,8}$/.test(roomId);
  const recommendedType = platform === "android" ? "android" : platform === "windows" ? "desktop" : null;

  return {
    recommendedType,
    continueJoinHref: validInvite
      ? `/scan/?${new URLSearchParams({ type, roomId }).toString()}`
      : null,
    roomId: validInvite ? roomId : null,
  };
}

function DownloadCard({
  release,
  type,
  recommended,
}: {
  release?: ReleaseInfo;
  type: DownloadType;
  recommended: boolean;
}) {
  const available = Boolean(release?.available && release.downloadUrl);
  const Icon = type === "android" ? Smartphone : MonitorDown;
  const lines = splitUpdateLines(release);
  const title = type === "android" ? "Android 版" : "PC 版";
  const unavailableText = type === "desktop" ? "PisaMusic 桌面版正在进行最后的交互细调，敬请期待。" : "正式安装包就绪后将在此开放极速下载。";

  return (
    <article
      data-download-platform={type}
      data-recommended={recommended ? "true" : "false"}
      className={`rise-in group relative overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-white via-white to-white hover:via-white/95 hover:to-sky-50/35 p-6 md:p-8 transition-all duration-500 hover:-translate-y-1 ${
        recommended
          ? "border-2 border-sky-300 shadow-[0_25px_65px_rgba(14,165,233,0.14)]"
          : "border border-slate-100 shadow-[0_15px_45px_rgba(148,163,184,0.06)] hover:border-sky-200/50 hover:shadow-[0_25px_60px_rgba(148,163,184,0.12)]"
      }`}
    >
      {/* Decorative gradient glow on hover */}
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gradient-to-br from-sky-450/5 to-transparent opacity-0 group-hover:opacity-100 blur-2xl transition-all duration-500 pointer-events-none" />

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 border border-sky-100/40">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{release?.platformLabel ?? title}</p>
          <h3 className="mt-1.5 text-3xl font-bold tracking-tight text-slate-900">{release?.latestVersion ?? "获取中"}</h3>
          <p className="mt-2 text-xs font-semibold text-slate-400 leading-none">{release?.updateTime || (available ? "更新时间暂不可用" : "下载通道暂未开启")}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {recommended ? (
            <span className="w-fit rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-bold text-sky-700">
              当前设备推荐
            </span>
          ) : null}
          <span className={`w-fit rounded-full px-3.5 py-1.5 text-xs font-bold border ${
            available
              ? "bg-emerald-50 text-emerald-600 border-emerald-100/60"
              : "bg-slate-100 text-slate-500 border-slate-200/50"
          }`}>
            {available ? `可下载${release?.fileSizeText ? ` · ${release.fileSizeText}` : ""}` : "即将开放"}
          </span>
        </div>
      </div>

      <div className="mt-7 rounded-2xl bg-slate-50/80 border border-slate-50 p-5 md:p-6">
        <p className="text-sm font-bold text-slate-700 tracking-tight">版本说明</p>
        {lines.length > 0 ? (
          <ul className="mt-3.5 space-y-3.5 text-sm leading-relaxed text-slate-600">
            {lines.map((line) => (
              <li key={line} className="relative pl-5 before:absolute before:left-1.5 before:top-[10px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-sky-400/80 font-medium">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3.5 text-sm leading-8 text-slate-500 font-medium">{available ? "版本更新说明将在后续包发布时同步展示。" : unavailableText}</p>
        )}
      </div>

      <a
        href={trackedDownloadHref(type, release)}
        aria-disabled={!available}
        className={`mt-7 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-full px-6 py-4 text-base font-bold transition duration-300 sm:h-14 ${
          available
            ? "bg-gradient-to-r from-sky-500 to-sky-450 text-white shadow-lg shadow-sky-500/10 hover:-translate-y-0.5 hover:from-sky-600 hover:to-sky-500 hover:shadow-sky-600/20"
            : "cursor-not-allowed bg-slate-200 text-slate-400"
        }`}
      >
        <ArrowDownToLine className="h-5 w-5" aria-hidden="true" />
        <span>{available ? `下载 ${title}` : `${title}即将开放`}</span>
      </a>
    </article>
  );
}

export default function DownloadSection({ updateState }: DownloadSectionProps) {
  const downloadContext = getDownloadContext();

  return (
    <section id="download" className="bg-[#f8fcff] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="rise-in">
          <SectionHeader
            eyebrow="下载"
            title="旋律在指尖流转，温暖在多端重逢。"
            desc="无论是窗前的一室安宁，还是步履不停的随身陪伴。PisaMusic 为不同载体倾心雕琢，在纷扰世界中静候跳动的音符，指引你寻回内心的纯净与共鸣。"
            align="center"
          />
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <DownloadCard
            release={updateState.data?.android ?? undefined}
            type="android"
            recommended={downloadContext.recommendedType === "android"}
          />
          <DownloadCard
            release={updateState.data?.desktop ?? undefined}
            type="desktop"
            recommended={downloadContext.recommendedType === "desktop"}
          />
        </div>

        {downloadContext.continueJoinHref && downloadContext.roomId ? (
          <div
            data-listen-together-continuation="true"
            className="rise-in mx-auto mt-6 max-w-2xl rounded-2xl border border-sky-100 bg-white px-5 py-4 text-center shadow-[0_12px_35px_rgba(14,165,233,0.08)]"
          >
            <p className="text-sm font-semibold text-slate-600">
              安装完成后，可返回一起听房间 <span className="font-bold text-sky-700">{downloadContext.roomId}</span> 继续加入。
            </p>
            <a
              href={downloadContext.continueJoinHref}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-5 text-sm font-bold text-sky-700 transition hover:bg-sky-100"
            >
              返回邀请并继续加入
            </a>
          </div>
        ) : null}

        {updateState.error ? (
          <p className="rise-in mt-6 text-center text-sm font-bold text-amber-700">下载信息暂时未能更新，请稍后再试。</p>
        ) : null}
      </div>
    </section>
  );
}
