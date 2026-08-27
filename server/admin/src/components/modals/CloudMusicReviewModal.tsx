import { useState } from "react";
import { createPortal } from "react-dom";
import { fetchCloudMusicPreviewUrl, reviewCloudMusic } from "../../api/cloudMusic";
import { glassInputClasses } from "../../constants/theme";
import type { CloudMusicReviewInput, CloudMusicTrack } from "../../types/cloudMusic";

type Props = {
  track: CloudMusicTrack;
  themeColor: string;
  onClose: () => void;
  onReviewed: (track: CloudMusicTrack) => void;
};

export default function CloudMusicReviewModal({ track, themeColor, onClose, onReviewed }: Props) {
  const [decision, setDecision] = useState<"approve" | "reject" | "resubmit">("approve");
  const [targetStatus, setTargetStatus] = useState<"active" | "disabled">("active");
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const handlePlayPreview = async () => {
    if (previewUrl) return;
    setLoadingAudio(true);
    setError("");
    try {
      const urls = await fetchCloudMusicPreviewUrl(track.uuid);
      setPreviewUrl(urls.audioUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取试听地址失败");
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);

    try {
      let payload: CloudMusicReviewInput;
      if (decision === "approve") {
        payload = { decision: "approve", targetStatus };
      } else if (decision === "reject") {
        if (!rejectReason.trim()) {
          setError("请填写拒绝原因");
          setSubmitting(false);
          return;
        }
        payload = { decision: "reject", reason: rejectReason.trim() };
      } else {
        payload = { decision: "resubmit" };
      }

      const updated = await reviewCloudMusic(track.uuid, payload);
      onReviewed(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "审核提交失败");
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6">
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-2xl backdrop-blur-2xl animate-fade-in-up sm:max-h-[calc(100dvh-4rem)] sm:rounded-[2rem]"
        style={{ animationDuration: "0.2s" }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-white/50 bg-white/40 px-5 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-slate-800 sm:text-xl">曲目审核</h3>
            <p className="mt-1 truncate font-mono text-xs text-slate-500">{track.uuid}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/60 p-2 text-slate-500 shadow-sm hover:bg-white" aria-label="关闭">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-8">
          {/* Track card */}
          <div className="flex items-center gap-4 rounded-2xl border border-white/60 bg-white/50 p-4">
            <img
              src={track.cover.url}
              alt={track.title}
              className="h-16 w-16 rounded-xl object-cover shadow-sm bg-slate-100"
            />
            <div className="min-w-0 flex-1">
              <h4 className="truncate font-extrabold text-slate-800">{track.title || "未命名"}</h4>
              <p className="truncate text-xs font-semibold text-slate-500">{track.artist} - {track.album || "无专辑"}</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                <span>格式: {track.format.toUpperCase()}</span>
                <span>•</span>
                <span>所有者: {track.owner.displayName}</span>
              </div>
            </div>
            <div>
              {!previewUrl ? (
                <button
                  type="button"
                  disabled={loadingAudio}
                  onClick={handlePlayPreview}
                  className="rounded-xl border border-white/70 bg-white/90 px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-white disabled:opacity-50"
                >
                  {loadingAudio ? "加载中..." : "试听音频"}
                </button>
              ) : (
                <audio controls src={previewUrl} className="h-9 w-48" autoPlay />
              )}
            </div>
          </div>

          {/* Decision Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">审核决策</label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`flex cursor-pointer items-center justify-center rounded-xl border p-3.5 text-sm font-bold transition-all ${decision === "approve" ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm" : "border-white/60 bg-white/60 text-slate-600 hover:bg-white"}`}>
                <input type="radio" name="decision" value="approve" checked={decision === "approve"} onChange={() => setDecision("approve")} className="sr-only" />
                审核通过
              </label>
              <label className={`flex cursor-pointer items-center justify-center rounded-xl border p-3.5 text-sm font-bold transition-all ${decision === "reject" ? "border-red-500 bg-red-50 text-red-700 shadow-sm" : "border-white/60 bg-white/60 text-slate-600 hover:bg-white"}`}>
                <input type="radio" name="decision" value="reject" checked={decision === "reject"} onChange={() => setDecision("reject")} className="sr-only" />
                审核拒绝
              </label>
            </div>
          </div>

          {/* Sub-options based on decision */}
          {decision === "approve" && (
            <div className="rounded-2xl border border-white/60 bg-white/50 p-4 space-y-2">
              <label className="block text-xs font-bold text-slate-700">通过后的目标状态</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                  <input type="radio" name="targetStatus" value="active" checked={targetStatus === "active"} onChange={() => setTargetStatus("active")} />
                  可用 (active)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                  <input type="radio" name="targetStatus" value="disabled" checked={targetStatus === "disabled"} onChange={() => setTargetStatus("disabled")} />
                  禁用 (disabled)
                </label>
              </div>
            </div>
          )}

          {decision === "reject" && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                拒绝原因 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className={`${glassInputClasses} h-24 resize-none`}
                placeholder="请详细说明不通过的原因（1-500 字符）..."
              />
            </div>
          )}

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end gap-3 border-t border-white/50 bg-white/40 p-4 sm:px-8 sm:py-5">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-xl border border-white/60 bg-white/80 px-6 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-white disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            style={{ backgroundColor: decision === "reject" ? "#ef4444" : themeColor }}
            className="rounded-xl px-8 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "提交中..." : decision === "reject" ? "确认拒绝" : "确认通过"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
