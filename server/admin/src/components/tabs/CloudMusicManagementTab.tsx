import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  cleanupCloudMusicTemp,
  deleteCloudMusic,
  fetchCloudMusicPreviewUrl,
  fetchCloudMusicTempSummary,
  fetchCloudMusicTracks,
  saveCloudMusic,
} from "../../api/cloudMusic";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";
import type {
  CloudMusicListFilter,
  CloudMusicStatus,
  CloudMusicTempSummary,
  CloudMusicTrack,
  CloudMusicUploadState,
} from "../../types/cloudMusic";
import CloudMusicEditModal from "../modals/CloudMusicEditModal";
import CloudMusicReviewModal from "../modals/CloudMusicReviewModal";
import CloudMusicUploadModal from "../modals/CloudMusicUploadModal";

type Props = {
  themeColor: string;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "-";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatDate(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function statusBadge(status: CloudMusicStatus) {
  switch (status) {
    case "active":
      return <span className="inline-flex rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">可用</span>;
    case "disabled":
      return <span className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">禁用</span>;
    case "offline":
      return <span className="inline-flex rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">下架</span>;
    case "pending_review":
      return <span className="inline-flex rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">待审核</span>;
    case "rejected":
      return <span className="inline-flex rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">已拒绝</span>;
    case "temp":
      return <span className="inline-flex rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">临时未保存</span>;
    case "deleted":
      return <span className="inline-flex rounded-md bg-zinc-200 px-2 py-0.5 text-[10px] font-bold text-zinc-500">已删除</span>;
    default:
      return <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{status}</span>;
  }
}

export default function CloudMusicManagementTab({ themeColor }: Props) {
  const [tracks, setTracks] = useState<CloudMusicTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<CloudMusicStatus | "all">("all");
  const [uploadStateFilter, setUploadStateFilter] = useState<CloudMusicUploadState | "all">("all");

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingTrack, setEditingTrack] = useState<CloudMusicTrack | null>(null);
  const [reviewingTrack, setReviewingTrack] = useState<CloudMusicTrack | null>(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [tempSummary, setTempSummary] = useState<CloudMusicTempSummary | null>(null);
  const [cleaningHours, setCleaningHours] = useState<0 | 24 | 72>(24);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResultMsg, setCleanupResultMsg] = useState("");

  // Audio preview player state
  const [activePreviewUuid, setActivePreviewUuid] = useState<string | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [loadingPreviewUuid, setLoadingPreviewUuid] = useState<string | null>(null);

  const loadTracks = async (newOffset = offset) => {
    setLoading(true);
    setError("");
    try {
      const filter: CloudMusicListFilter = {
        keyword: keyword.trim() || undefined,
        status: statusFilter,
        uploadState: uploadStateFilter,
        offset: newOffset,
        limit,
      };
      const res = await fetchCloudMusicTracks(filter);
      setTracks(res.items);
      setTotal(res.total);
      setOffset(res.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取网盘音乐列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks(0);
  }, [statusFilter, uploadStateFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadTracks(0);
  };

  const handleOpenCleanup = async () => {
    setShowCleanupModal(true);
    setCleanupResultMsg("");
    try {
      const summary = await fetchCloudMusicTempSummary();
      setTempSummary(summary);
    } catch {
      setTempSummary(null);
    }
  };

  const handleExecuteCleanup = async () => {
    if (cleaningHours === 0) {
      const confirmed = window.confirm("警告：确认要清理【全部】临时文件吗？此操作将立即删除所有未保存的临时音频和资产！");
      if (!confirmed) return;
    }
    setCleaning(true);
    setCleanupResultMsg("");
    try {
      const res = await cleanupCloudMusicTemp(cleaningHours);
      setCleanupResultMsg(`清理完成：扫描 ${res.scanned} 条，已删除 ${res.deleted} 条${res.failed.length > 0 ? `，失败 ${res.failed.length} 条` : ""}`);
      const summary = await fetchCloudMusicTempSummary();
      setTempSummary(summary);
      loadTracks();
    } catch (err) {
      setCleanupResultMsg(`清理失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCleaning(false);
    }
  };

  const handleToggleActiveDisabled = async (track: CloudMusicTrack) => {
    if (track.status !== "active" && track.status !== "disabled") return;
    const targetStatus = track.status === "active" ? "disabled" : "active";
    try {
      await saveCloudMusic(track.uuid, {
        title: track.title,
        artist: track.artist,
        album: track.album,
        durationMs: track.durationMs,
        status: targetStatus,
      });
      loadTracks();
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失败");
    }
  };

  const handleDelete = async (track: CloudMusicTrack) => {
    const confirmed = window.confirm(`确认删除曲目《${track.title || "未命名"}》吗？关联的七牛音频、封面和歌词文件将被永久删除！`);
    if (!confirmed) return;

    try {
      await deleteCloudMusic(track.uuid);
      loadTracks();
    } catch (err) {
      alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handlePlayPreview = async (track: CloudMusicTrack) => {
    if (activePreviewUuid === track.uuid) {
      setActivePreviewUuid(null);
      setPreviewAudioUrl(null);
      return;
    }

    setLoadingPreviewUuid(track.uuid);
    try {
      const urls = await fetchCloudMusicPreviewUrl(track.uuid);
      setActivePreviewUuid(track.uuid);
      setPreviewAudioUrl(urls.audioUrl);
    } catch (err) {
      alert(err instanceof Error ? err.message : "获取试听地址失败");
    } finally {
      setLoadingPreviewUuid(null);
    }
  };

  const pageEnd = Math.min(total, offset + limit);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Top Header Card */}
      <div className={glassCardClasses}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">网盘音乐管理</h2>
            <p className="mt-1 text-sm text-slate-500">管理平台公共网盘曲库，支持音频上传、元数据解析、审核和资产清理。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenCleanup}
              className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-800 shadow-sm hover:bg-amber-100 transition-colors"
            >
              清理临时文件
            </button>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            >
              上传音乐
            </button>
            <button
              type="button"
              onClick={() => loadTracks()}
              className="rounded-2xl border border-white/70 bg-white/80 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-white transition-colors"
            >
              刷新
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <form onSubmit={handleSearch} className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索歌名、歌手、专辑或 UUID..."
              className={glassInputClasses}
            />
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as CloudMusicStatus | "all")}
              className={glassInputClasses}
            >
              <option value="all">全部业务状态</option>
              <option value="active">可用 (active)</option>
              <option value="pending_review">待审核 (pending_review)</option>
              <option value="disabled">禁用 (disabled)</option>
              <option value="offline">下架 (offline)</option>
              <option value="temp">临时未保存 (temp)</option>
              <option value="rejected">已拒绝 (rejected)</option>
            </select>
          </div>
          <div>
            <select
              value={uploadStateFilter}
              onChange={(e) => setUploadStateFilter(e.target.value as CloudMusicUploadState | "all")}
              className={glassInputClasses}
            >
              <option value="all">全部上传状态</option>
              <option value="ready">已就绪 (ready)</option>
              <option value="processing">解析中 (processing)</option>
              <option value="uploaded">已上传 (uploaded)</option>
              <option value="reserved">已预约 (reserved)</option>
              <option value="failed">失败 (failed)</option>
            </select>
          </div>
        </form>
      </div>

      {/* Tracks Table Card */}
      <div className={glassCardClasses}>
        {error && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-600">{error}</div>}

        {loading ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500">正在加载网盘音乐...</div>
        ) : tracks.length === 0 ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500">暂无网盘音乐曲目</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase text-slate-500">
                  <th className="border-b border-slate-200/70 px-4 py-3">歌曲信息</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">状态</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">格式 / 规格</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">时长</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">歌词</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">所有者</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">更新时间</th>
                  <th className="sticky right-0 z-10 border-b border-slate-200/70 bg-white/80 px-4 py-3 text-right backdrop-blur">操作</th>
                </tr>
              </thead>
              <tbody>
                {tracks.map((track) => (
                  <tr key={track.uuid} className="group transition-colors hover:bg-white/50">
                    {/* Song info & cover */}
                    <td className="max-w-[18rem] border-b border-slate-100/80 px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <img
                          src={track.cover.url}
                          alt={track.title}
                          className="h-11 w-11 shrink-0 rounded-xl object-cover shadow-sm bg-slate-100"
                        />
                        <div className="min-w-0">
                          <div className="truncate font-extrabold text-slate-800" title={track.title}>
                            {track.title || "未命名"}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-slate-500" title={track.artist}>
                            {track.artist} {track.album ? `• ${track.album}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status badges */}
                    <td className="border-b border-slate-100/80 px-4 py-3.5">
                      <div className="flex flex-col gap-1 items-start">
                        {statusBadge(track.status)}
                        {track.uploadState !== "ready" && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono text-slate-500">
                            {track.uploadState}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Format & specs */}
                    <td className="border-b border-slate-100/80 px-4 py-3.5 text-xs text-slate-600 font-mono">
                      <div>{track.format ? track.format.toUpperCase() : "-"}</div>
                      <div className="text-[10px] text-slate-400">
                        {track.audioFile ? formatFileSize(track.audioFile.fileSize) : "-"}
                      </div>
                    </td>

                    {/* Duration */}
                    <td className="border-b border-slate-100/80 px-4 py-3.5 text-xs font-mono text-slate-600">
                      {formatDuration(track.durationMs)}
                    </td>

                    {/* Lyrics */}
                    <td className="border-b border-slate-100/80 px-4 py-3.5 text-xs">
                      {track.lyrics ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-600">
                          {track.lyrics.format.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-slate-400">无</span>
                      )}
                    </td>

                    {/* Owner */}
                    <td className="border-b border-slate-100/80 px-4 py-3.5 text-xs font-semibold text-slate-600">
                      {track.owner.displayName}
                    </td>

                    {/* Time */}
                    <td className="border-b border-slate-100/80 px-4 py-3.5 text-xs text-slate-400">
                      {formatDate(track.updatedAt)}
                    </td>

                    {/* Action buttons */}
                    <td className="sticky right-0 z-10 border-b border-slate-100/80 bg-white/80 px-4 py-3.5 backdrop-blur">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {/* Audio preview */}
                        <button
                          type="button"
                          onClick={() => handlePlayPreview(track)}
                          disabled={track.uploadState !== "ready" || loadingPreviewUuid === track.uuid}
                          className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold shadow-sm transition-colors ${activePreviewUuid === track.uuid ? "border-purple-300 bg-purple-100 text-purple-700" : "border-white/70 bg-white/70 text-slate-700 hover:bg-white disabled:opacity-40"}`}
                        >
                          {loadingPreviewUuid === track.uuid ? "加载..." : activePreviewUuid === track.uuid ? "停止" : "试听"}
                        </button>

                        {/* Review button if pending review */}
                        {track.status === "pending_review" && (
                          <button
                            type="button"
                            onClick={() => setReviewingTrack(track)}
                            className="rounded-xl bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                          >
                            审核
                          </button>
                        )}

                        {/* Quick switch active/disabled */}
                        {(track.status === "active" || track.status === "disabled") && (
                          <button
                            type="button"
                            onClick={() => handleToggleActiveDisabled(track)}
                            className="rounded-xl border border-white/70 bg-white/70 px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-white"
                          >
                            {track.status === "active" ? "禁用" : "启用"}
                          </button>
                        )}

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => setEditingTrack(track)}
                          className="rounded-xl border border-white/70 bg-white/70 px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-white"
                        >
                          编辑
                        </button>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDelete(track)}
                          className="rounded-xl bg-red-500 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-red-600"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Global floating preview audio player if active */}
        {activePreviewUuid && previewAudioUrl && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-purple-200 bg-purple-50/80 p-3 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-purple-800">正在试听：</span>
              <audio controls src={previewAudioUrl} autoPlay className="h-8" />
            </div>
            <button
              type="button"
              onClick={() => {
                setActivePreviewUuid(null);
                setPreviewAudioUrl(null);
              }}
              className="rounded-lg bg-purple-200 px-3 py-1 text-xs font-bold text-purple-800 hover:bg-purple-300"
            >
              关闭试听
            </button>
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/50 p-4 text-sm font-bold text-slate-600">
        <span>
          {total === 0 ? "0" : `${offset + 1}-${pageEnd}`} / {total}
        </span>
        <div className="flex gap-2">
          <button
            className="rounded-xl bg-white px-4 py-2 disabled:opacity-50"
            disabled={offset <= 0}
            onClick={() => loadTracks(Math.max(0, offset - limit))}
          >
            上一页
          </button>
          <button
            className="rounded-xl bg-white px-4 py-2 disabled:opacity-50"
            disabled={pageEnd >= total}
            onClick={() => loadTracks(offset + limit)}
          >
            下一页
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <CloudMusicUploadModal
          themeColor={themeColor}
          onClose={() => setShowUploadModal(false)}
          onSuccess={(newTrack) => {
            setShowUploadModal(false);
            setEditingTrack(newTrack);
            loadTracks(0);
          }}
        />
      )}

      {/* Edit Modal */}
      {editingTrack && (
        <CloudMusicEditModal
          track={editingTrack}
          themeColor={themeColor}
          onClose={() => setEditingTrack(null)}
          onSaved={() => {
            setEditingTrack(null);
            loadTracks();
          }}
        />
      )}

      {/* Review Modal */}
      {reviewingTrack && (
        <CloudMusicReviewModal
          track={reviewingTrack}
          themeColor={themeColor}
          onClose={() => setReviewingTrack(null)}
          onReviewed={() => {
            setReviewingTrack(null);
            loadTracks();
          }}
        />
      )}

      {/* Cleanup Modal */}
      {showCleanupModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6">
            <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-md" onClick={() => setShowCleanupModal(false)} aria-hidden />
            <div className="relative z-10 my-auto flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-2xl backdrop-blur-2xl animate-fade-in-up sm:max-h-[calc(100dvh-4rem)]">
              <div className="shrink-0 flex items-center justify-between border-b border-white/50 bg-white/40 px-6 py-4">
                <h3 className="text-lg font-extrabold text-slate-800">清理临时文件</h3>
                <button type="button" onClick={() => setShowCleanupModal(false)} className="rounded-full bg-white/60 p-2 text-slate-500 hover:bg-white">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-6 text-sm text-slate-700">
                <p className="text-xs text-slate-500">清理上传中断或未保存的临时曲目及其关联七牛对象，释放存储空间。</p>

                {tempSummary && (
                  <div className="rounded-2xl border border-white/60 bg-white/50 p-4 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span>全部临时曲目:</span>
                      <span className="font-bold">{tempSummary.total.count} 个 ({formatFileSize(tempSummary.total.bytes)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>24 小时前临时曲目:</span>
                      <span className="font-bold text-amber-700">{tempSummary.olderThan24h.count} 个 ({formatFileSize(tempSummary.olderThan24h.bytes)})</span>
                    </div>
                    <div className="flex justify-between">
                      <span>72 小时前临时曲目:</span>
                      <span className="font-bold text-red-700">{tempSummary.olderThan72h.count} 个 ({formatFileSize(tempSummary.olderThan72h.bytes)})</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-2 block text-xs font-bold text-slate-700">选择清理范围</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setCleaningHours(24)}
                      className={`rounded-xl border p-2.5 text-xs font-bold ${cleaningHours === 24 ? "border-amber-500 bg-amber-50 text-amber-800" : "border-white/60 bg-white/60"}`}
                    >
                      24小时前 (推荐)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCleaningHours(72)}
                      className={`rounded-xl border p-2.5 text-xs font-bold ${cleaningHours === 72 ? "border-amber-500 bg-amber-50 text-amber-800" : "border-white/60 bg-white/60"}`}
                    >
                      72小时前
                    </button>
                    <button
                      type="button"
                      onClick={() => setCleaningHours(0)}
                      className={`rounded-xl border p-2.5 text-xs font-bold ${cleaningHours === 0 ? "border-red-500 bg-red-50 text-red-700" : "border-white/60 bg-white/60"}`}
                    >
                      全部临时记录
                    </button>
                  </div>
                </div>

                {cleanupResultMsg && (
                  <div className="rounded-xl bg-slate-100 p-3 text-xs font-semibold text-slate-700">
                    {cleanupResultMsg}
                  </div>
                )}
              </div>

              <div className="shrink-0 flex justify-end gap-3 border-t border-white/50 bg-white/40 p-4">
                <button
                  type="button"
                  disabled={cleaning}
                  onClick={() => setShowCleanupModal(false)}
                  className="rounded-xl border border-white/60 bg-white/80 px-5 py-2.5 text-xs font-bold text-slate-700"
                >
                  关闭
                </button>
                <button
                  type="button"
                  disabled={cleaning}
                  onClick={handleExecuteCleanup}
                  className="rounded-xl bg-amber-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {cleaning ? "清理中..." : "确认清理"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
