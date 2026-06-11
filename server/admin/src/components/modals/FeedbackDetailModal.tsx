import type { AdminFeedbackDetail, FeedbackStatus } from "../../types/config";
import { FEEDBACK_TYPE_LABELS, formatFeedbackTime } from "../../utils/feedback";

type Props = {
  feedback: AdminFeedbackDetail;
  updating: boolean;
  themeColor: string;
  onStatusChange: (status: FeedbackStatus) => void;
  onClose: () => void;
};

function displayDeviceValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export default function FeedbackDetailModal({
  feedback,
  updating,
  themeColor,
  onStatusChange,
  onClose,
}: Props) {
  const deviceEntries = Object.entries(feedback.device);
  const nextStatus: FeedbackStatus = feedback.status === "processed" ? "pending" : "processed";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div className="relative mx-auto my-4 flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/85 shadow-2xl backdrop-blur-2xl animate-fade-in-up sm:my-8 sm:max-h-[calc(100dvh-4rem)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/50 bg-white/30 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-extrabold text-slate-800">反馈详情</h3>
              <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{FEEDBACK_TYPE_LABELS[feedback.feedbackType]}</span>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${feedback.status === "processed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {feedback.status === "processed" ? "已处理" : "待处理"}
              </span>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-slate-400">{feedback.id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/60 p-2 text-slate-500 shadow-sm hover:bg-white" aria-label="关闭">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-8">
          <section className="rounded-2xl border border-white/60 bg-white/55 p-5 shadow-inner">
            <h4 className="text-sm font-extrabold text-slate-700">反馈内容</h4>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{feedback.description}</p>
          </section>

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/60 bg-white/45 p-5 text-sm shadow-inner md:grid-cols-2">
            <div><span className="font-bold text-slate-500">联系方式：</span><span className="break-all text-slate-700">{feedback.contact || "-"}</span></div>
            <div><span className="font-bold text-slate-500">图片数量：</span><span className="text-slate-700">{feedback.imageCount}</span></div>
            <div><span className="font-bold text-slate-500">提交时间：</span><span className="text-slate-700">{formatFeedbackTime(feedback.createdAt)}</span></div>
            <div><span className="font-bold text-slate-500">处理时间：</span><span className="text-slate-700">{formatFeedbackTime(feedback.processedAt)}</span></div>
          </div>

          <section className="rounded-2xl border border-white/60 bg-white/45 p-5 shadow-inner">
            <h4 className="mb-4 text-sm font-extrabold text-slate-700">反馈图片</h4>
            {feedback.images.length === 0 ? (
              <div className="rounded-xl bg-white/50 py-8 text-center text-sm font-semibold text-slate-400">未上传图片</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {feedback.images.map((image, index) => (
                  <a key={image} href={image} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl border border-white/70 bg-white/60 shadow-sm">
                    <img src={image} alt={`反馈图片 ${index + 1}`} className="aspect-[4/3] w-full object-cover transition-transform group-hover:scale-105" />
                    <div className="px-3 py-2 text-center text-xs font-bold text-slate-500">查看原图</div>
                  </a>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-white/60 bg-white/45 p-5 shadow-inner">
            <h4 className="mb-4 text-sm font-extrabold text-slate-700">设备信息</h4>
            {deviceEntries.length === 0 ? (
              <div className="rounded-xl bg-white/50 py-8 text-center text-sm font-semibold text-slate-400">未提供设备信息</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {deviceEntries.map(([key, value]) => (
                  <div key={key} className="min-w-0 rounded-xl bg-white/60 px-4 py-3">
                    <div className="font-mono text-[11px] font-bold text-slate-400">{key}</div>
                    <div className="mt-1 break-all text-sm text-slate-700">{displayDeviceValue(value)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/50 bg-white/30 p-5 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/70 bg-white/70 px-6 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-white">关闭</button>
          <button
            type="button"
            disabled={updating}
            onClick={() => onStatusChange(nextStatus)}
            className="rounded-xl px-6 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            style={{ backgroundColor: feedback.status === "processed" ? "#f59e0b" : themeColor }}
          >
            {updating ? "更新中..." : feedback.status === "processed" ? "恢复为待处理" : "标记为已处理"}
          </button>
        </div>
      </div>
    </div>
  );
}
