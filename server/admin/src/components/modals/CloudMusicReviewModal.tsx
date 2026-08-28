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
  const [decision, setDecision] = useState<"approve" | "reject" | "resubmit" | "ban_destroy">("approve");
  const [targetStatus, setTargetStatus] = useState<"active" | "disabled">(
    track.status === "disabled" ? "disabled" : "active"
  );
  const [reason, setReason] = useState("");
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
        payload = {
          decision: "approve",
          targetStatus,
          reason: reason.trim() || undefined,
        };
      } else if (decision === "reject") {
        if (!reason.trim()) {
          setError("请填写驳回原因（告知用户如何修改并重新提审）");
          setSubmitting(false);
          return;
        }
        payload = { decision: "reject", reason: reason.trim() };
      } else if (decision === "resubmit") {
        payload = { decision: "resubmit", reason: reason.trim() || undefined };
      } else {
        if (!reason.trim()) {
          setError("请填写违规销毁原因说明");
          setSubmitting(false);
          return;
        }
        payload = { decision: "ban_destroy", reason: reason.trim() };
      }

      const updated = await reviewCloudMusic(track.uuid, payload);
      onReviewed(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "审核提交失败");
      setSubmitting(false);
    }
  };

  const getSubmitBtnStyle = () => {
    if (decision === "ban_destroy") return { backgroundColor: "#dc2626" };
    if (decision === "reject") return { backgroundColor: "#f97316" };
    if (decision === "resubmit") return { backgroundColor: "#2563eb" };
    return { backgroundColor: themeColor || "#059669" };
  };

  const getSubmitBtnText = () => {
    if (submitting) return "提交处理中...";
    if (decision === "ban_destroy") return "确认违规销毁 (直接打死)";
    if (decision === "reject") return "确认驳回修改";
    if (decision === "resubmit") return "重置为待审核";
    if (track.status === "active" && targetStatus === "disabled") return "确认设置为禁用";
    if (track.status === "disabled" && targetStatus === "active") return "确认设置为可用";
    if (track.status === "active" || track.status === "disabled") return "确认保存状态";
    return "确认审核通过";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending_review":
        return <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">待审核</span>;
      case "active":
        return <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">已通过(可用)</span>;
      case "disabled":
        return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">已禁用</span>;
      case "rejected":
        return <span className="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700">已拒绝/驳回</span>;
      case "deleted":
        return <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">已销毁留底</span>;
      default:
        return <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{status}</span>;
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
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-extrabold text-slate-800 sm:text-xl">曲目审核与状态管理</h3>
              {getStatusBadge(track.status)}
            </div>
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
              {track.statusReason && (
                <p className="mt-1 truncate text-xs text-amber-700 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200">
                  当前备注: {track.statusReason}
                </p>
              )}
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

          {/* Decision Selection Grid */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">选择审核流转决策</label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {/* 1. 通过 */}
              <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${decision === "approve" ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm ring-1 ring-emerald-500" : "border-white/60 bg-white/60 text-slate-600 hover:bg-white"}`}>
                <input type="radio" name="decision" value="approve" checked={decision === "approve"} onChange={() => setDecision("approve")} className="sr-only" />
                <span className="text-sm font-bold">审核通过</span>
                <span className="mt-0.5 text-[10px] text-emerald-600">上架曲库</span>
              </label>

              {/* 2. 重新送审 */}
              <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${decision === "resubmit" ? "border-blue-500 bg-blue-50 text-blue-800 shadow-sm ring-1 ring-blue-500" : "border-white/60 bg-white/60 text-slate-600 hover:bg-white"}`}>
                <input type="radio" name="decision" value="resubmit" checked={decision === "resubmit"} onChange={() => setDecision("resubmit")} className="sr-only" />
                <span className="text-sm font-bold">设为待审核</span>
                <span className="mt-0.5 text-[10px] text-blue-600">重回排队</span>
              </label>

              {/* 3. 驳回修改 */}
              <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${decision === "reject" ? "border-orange-500 bg-orange-50 text-orange-800 shadow-sm ring-1 ring-orange-500" : "border-white/60 bg-white/60 text-slate-600 hover:bg-white"}`}>
                <input type="radio" name="decision" value="reject" checked={decision === "reject"} onChange={() => setDecision("reject")} className="sr-only" />
                <span className="text-sm font-bold">驳回修改</span>
                <span className="mt-0.5 text-[10px] text-orange-600">允许用户重提</span>
              </label>

              {/* 4. 违规销毁 (直接打死) */}
              <label className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${decision === "ban_destroy" ? "border-rose-600 bg-rose-50 text-rose-800 shadow-sm ring-1 ring-rose-600" : "border-white/60 bg-white/60 text-slate-600 hover:bg-white"}`}>
                <input type="radio" name="decision" value="ban_destroy" checked={decision === "ban_destroy"} onChange={() => setDecision("ban_destroy")} className="sr-only" />
                <span className="text-sm font-bold">违规销毁</span>
                <span className="mt-0.5 text-[10px] text-rose-600">直接打死留底</span>
              </label>
            </div>
          </div>

          {/* Sub-options based on decision */}
          {decision === "approve" && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
              <label className="block text-xs font-bold text-emerald-900">通过后的目标状态</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                  <input type="radio" name="targetStatus" value="active" checked={targetStatus === "active"} onChange={() => setTargetStatus("active")} />
                  可用 (active) - 立即公开可播放
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 font-semibold cursor-pointer">
                  <input type="radio" name="targetStatus" value="disabled" checked={targetStatus === "disabled"} onChange={() => setTargetStatus("disabled")} />
                  禁用 (disabled) - 只看不播
                </label>
              </div>
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">审核备注 (选填)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={glassInputClasses}
                  placeholder="例如：通过审核，音质符合要求"
                />
              </div>
            </div>
          )}

          {decision === "resubmit" && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
              <label className="block text-xs font-bold text-blue-900">重置说明</label>
              <p className="text-xs text-blue-700">
                将曲目状态直接变更为 <strong>待审核 (pending_review)</strong>，重新进入待审核队列。
              </p>
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">变更备注 (选填)</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={glassInputClasses}
                  placeholder="例如：重新进入复核队列"
                />
              </div>
            </div>
          )}

          {decision === "reject" && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-orange-900">
                  驳回原因 <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-orange-700">用户可查看此原因并修改歌曲信息后重新发起提审</span>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={`${glassInputClasses} h-24 resize-none`}
                placeholder="请详细说明驳回原因，例如：歌名存在错别字，请核对后修改重新提交..."
              />
            </div>
          )}

          {decision === "ban_destroy" && (
            <div className="rounded-2xl border border-rose-300 bg-rose-50/70 p-4 space-y-3">
              <div className="flex items-start gap-2 text-rose-800">
                <svg className="h-5 w-5 shrink-0 mt-0.5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="text-xs leading-relaxed">
                  <strong className="block text-rose-900 font-bold">违规直接销毁说明：</strong>
                  该操作将立即<strong>物理删除七牛云上的音频、封面与歌词文件</strong>，本地保留一条已销毁留底记录。<strong>用户端将彻底无法再次修改或提审！</strong>
                </div>
              </div>
              <div className="pt-1">
                <label className="block text-xs font-bold text-rose-900 mb-1">
                  违规销毁原因 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={`${glassInputClasses} h-20 resize-none border-rose-300 focus:border-rose-500`}
                  placeholder="请详细记录违规判定原因（如：包含侵权违法音频、恶意文件等）..."
                />
              </div>
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
            style={getSubmitBtnStyle()}
            className="rounded-xl px-8 py-2.5 text-sm font-bold text-white shadow-md transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {getSubmitBtnText()}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
