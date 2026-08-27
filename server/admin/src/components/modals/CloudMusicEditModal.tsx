import { useState } from "react";
import { createPortal } from "react-dom";
import {
  completeCloudMusicAsset,
  removeCloudMusicManualCover,
  reserveCloudMusicAsset,
  saveCloudMusic,
} from "../../api/cloudMusic";
import { uploadFileToQiniu } from "../../api/client";
import { glassInputClasses } from "../../constants/theme";
import type { CloudMusicAdminSaveInput, CloudMusicTrack } from "../../types/cloudMusic";

type Props = {
  track: CloudMusicTrack;
  themeColor: string;
  onClose: () => void;
  onSaved: (track: CloudMusicTrack) => void;
};

function formatMsToTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseTimeToMs(str: string): number {
  const parts = str.trim().split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s < 60) {
      return (m * 60 + s) * 1000;
    }
  }
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (!isNaN(h) && !isNaN(m) && !isNaN(s) && h >= 0 && m >= 0 && m < 60 && s >= 0 && s < 60) {
      return (h * 3600 + m * 60 + s) * 1000;
    }
  }
  const numeric = parseInt(str, 10);
  return !isNaN(numeric) && numeric >= 0 ? numeric : 0;
}

export default function CloudMusicEditModal({ track: initialTrack, themeColor, onClose, onSaved }: Props) {
  const [track, setTrack] = useState<CloudMusicTrack>(initialTrack);
  const [title, setTitle] = useState(track.title || "");
  const [artist, setArtist] = useState(track.artist || "");
  const [album, setAlbum] = useState(track.album || "");
  const [durationStr, setDurationStr] = useState(formatMsToTime(track.durationMs));
  const [status, setStatus] = useState<"active" | "disabled" | "offline">(
    track.status === "disabled" ? "disabled" : track.status === "offline" ? "offline" : "active",
  );
  const [statusReason, setStatusReason] = useState(track.statusReason || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [coverUpdating, setCoverUpdating] = useState(false);
  const [lyricsUpdating, setLyricsUpdating] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      setError("歌名不能为空");
      return;
    }
    if (!artist.trim()) {
      setError("歌手不能为空");
      return;
    }
    const durationMs = parseTimeToMs(durationStr);
    if (durationMs <= 0) {
      setError("时长格式不正确 (例如 03:45)");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const payload: CloudMusicAdminSaveInput = {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
        durationMs,
        status,
        statusReason: statusReason.trim(),
      };
      const updated = await saveCloudMusic(track.uuid, payload);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      setSaving(false);
    }
  };

  const handleRemoveCover = async () => {
    if (coverUpdating) return;
    setCoverUpdating(true);
    try {
      const updated = await removeCloudMusicManualCover(track.uuid);
      setTrack(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "移除封面失败");
    } finally {
      setCoverUpdating(false);
    }
  };

  const handleUploadCover = async (file: File) => {
    if (coverUpdating) return;
    setCoverUpdating(true);
    setError("");
    try {
      const ticket = await reserveCloudMusicAsset(track.uuid, file, "cover-uploaded");
      await uploadFileToQiniu(file, {
        uploadToken: ticket.uploadToken,
        uploadUrl: ticket.uploadUrl,
        key: ticket.key,
        bucket: "",
        domain: "",
        cdnDomain: "",
        downloadUrl: "",
        expiresAt: 0,
      });
      const updated = await completeCloudMusicAsset(track.uuid, "cover-uploaded");
      setTrack(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新封面失败");
    } finally {
      setCoverUpdating(false);
    }
  };

  const handleUploadLyrics = async (file: File) => {
    if (lyricsUpdating) return;
    setLyricsUpdating(true);
    setError("");
    try {
      const ticket = await reserveCloudMusicAsset(track.uuid, file, "lyrics");
      await uploadFileToQiniu(file, {
        uploadToken: ticket.uploadToken,
        uploadUrl: ticket.uploadUrl,
        key: ticket.key,
        bucket: "",
        domain: "",
        cdnDomain: "",
        downloadUrl: "",
        expiresAt: 0,
      });
      const updated = await completeCloudMusicAsset(track.uuid, "lyrics");
      setTrack(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新歌词失败");
    } finally {
      setLyricsUpdating(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6">
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative z-10 my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-2xl backdrop-blur-2xl animate-fade-in-up sm:max-h-[calc(100dvh-4rem)] sm:rounded-[2rem]"
        style={{ animationDuration: "0.2s" }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-white/50 bg-white/40 px-5 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-slate-800 sm:text-xl">编辑网盘曲目</h3>
            <p className="mt-1 truncate font-mono text-xs text-slate-500">{track.uuid}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/60 p-2 text-slate-500 shadow-sm hover:bg-white" aria-label="关闭">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-8">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 ml-1 block text-sm font-semibold text-slate-700">
                歌名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={glassInputClasses}
                placeholder="歌曲名称"
              />
            </div>
            <div>
              <label className="mb-2 ml-1 block text-sm font-semibold text-slate-700">
                歌手 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className={glassInputClasses}
                placeholder="歌手名称 (多位用 / 分隔)"
              />
            </div>
            <div>
              <label className="mb-2 ml-1 block text-sm font-semibold text-slate-700">专辑</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className={glassInputClasses}
                placeholder="专辑名称 (可选)"
              />
            </div>
            <div>
              <label className="mb-2 ml-1 block text-sm font-semibold text-slate-700">
                时长 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={durationStr}
                onChange={(e) => setDurationStr(e.target.value)}
                className={glassInputClasses}
                placeholder="格式 mm:ss"
              />
            </div>
          </div>

          {/* Status Selection */}
          <div className="rounded-2xl border border-white/60 bg-white/50 p-4 shadow-sm">
            <label className="mb-2 block text-sm font-bold text-slate-700">业务状态</label>
            <div className="grid grid-cols-3 gap-3">
              <label className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-sm font-bold transition-all ${status === "active" ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm" : "border-white/60 bg-white/60 text-slate-600 hover:bg-white"}`}>
                <input type="radio" name="status" value="active" checked={status === "active"} onChange={() => setStatus("active")} className="sr-only" />
                可用 (正常播放)
              </label>
              <label className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-sm font-bold transition-all ${status === "disabled" ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm" : "border-white/60 bg-white/60 text-slate-600 hover:bg-white"}`}>
                <input type="radio" name="status" value="disabled" checked={status === "disabled"} onChange={() => setStatus("disabled")} className="sr-only" />
                禁用 (可搜不可播)
              </label>
              <label className={`flex cursor-pointer items-center justify-center rounded-xl border p-3 text-sm font-bold transition-all ${status === "offline" ? "border-slate-500 bg-slate-100 text-slate-700 shadow-sm" : "border-white/60 bg-white/60 text-slate-600 hover:bg-white"}`}>
                <input type="radio" name="status" value="offline" checked={status === "offline"} onChange={() => setStatus("offline")} className="sr-only" />
                下架 (客户端不可见)
              </label>
            </div>
            {status !== "active" && (
              <input
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                className={`mt-3 ${glassInputClasses}`}
                placeholder="说明禁用或下架的原因 (可选)"
              />
            )}
          </div>

          {/* Cover & Lyrics Assets Section */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Cover Card */}
            <div className="rounded-2xl border border-white/60 bg-white/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">封面图片</span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {track.cover.source === "uploaded" ? "手动上传" : track.cover.source === "embedded" ? "内嵌提取" : "默认封面"}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <img
                  src={track.cover.url}
                  alt={track.title}
                  className="h-16 w-16 rounded-xl object-cover shadow-sm bg-slate-100"
                />
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer rounded-xl border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-white text-center">
                    {coverUpdating ? "上传中..." : "更换封面"}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      disabled={coverUpdating}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadCover(file);
                      }}
                      className="hidden"
                    />
                  </label>
                  {track.cover.source === "uploaded" && (
                    <button
                      type="button"
                      disabled={coverUpdating}
                      onClick={handleRemoveCover}
                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      移除手动封面
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Lyrics Card */}
            <div className="rounded-2xl border border-white/60 bg-white/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-700">歌词文件</span>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {track.lyrics ? track.lyrics.format.toUpperCase() : "无歌词"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="truncate text-xs text-slate-600 max-w-[160px]">
                  {track.lyrics ? track.lyrics.fileName : "暂无关联歌词"}
                </div>
                <label className="cursor-pointer rounded-xl border border-white/70 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-white">
                  {lyricsUpdating ? "上传中..." : track.lyrics ? "更换歌词" : "上传歌词"}
                  <input
                    type="file"
                    accept=".lrc,.txt"
                    disabled={lyricsUpdating}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadLyrics(file);
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Technical Audio Summary */}
          {track.audioFile && (
            <div className="rounded-2xl border border-white/60 bg-white/40 p-3 text-xs text-slate-500 grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
              <div>格式: <span className="text-slate-800 font-bold">{track.format || "-"}</span></div>
              <div>编码: <span className="text-slate-800 font-bold">{track.codec || "-"}</span></div>
              <div>比特率: <span className="text-slate-800 font-bold">{track.bitrate ? `${Math.round(track.bitrate / 1000)} kbps` : "-"}</span></div>
              <div>采样率: <span className="text-slate-800 font-bold">{track.sampleRate ? `${track.sampleRate} Hz` : "-"}</span></div>
            </div>
          )}

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end gap-3 border-t border-white/50 bg-white/40 p-4 sm:px-8 sm:py-5">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-xl border border-white/60 bg-white/80 px-6 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-white disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            className="rounded-xl px-8 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
