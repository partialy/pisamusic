import { useState } from "react";
import { createPortal } from "react-dom";
import { createCloudMusicUploadSession, uploadCloudMusicSession } from "../../api/cloudMusic";
import { glassInputClasses } from "../../constants/theme";
import type { CloudMusicTrack } from "../../types/cloudMusic";

type Props = {
  themeColor: string;
  onClose: () => void;
  onSuccess: (track: CloudMusicTrack) => void;
};

export default function CloudMusicUploadModal({ themeColor, onClose, onSuccess }: Props) {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [lyricsFile, setLyricsFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<"reserving" | "audio" | "cover" | "lyrics" | "processing" | "">("");
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState("");

  const handleStartUpload = async () => {
    if (!audioFile) {
      setError("请选择音频文件");
      return;
    }
    setError("");
    setUploading(true);
    setPhase("reserving");
    setPercent(0);

    try {
      const session = await createCloudMusicUploadSession({
        audio: audioFile,
        cover: coverFile || undefined,
        lyrics: lyricsFile || undefined,
      });

      const track = await uploadCloudMusicSession(
        session,
        {
          audio: audioFile,
          cover: coverFile || undefined,
          lyrics: lyricsFile || undefined,
        },
        (progress) => {
          setPhase(progress.phase);
          setPercent(progress.percent);
        },
      );

      onSuccess(track);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
      setUploading(false);
      setPhase("");
    }
  };

  const getPhaseText = () => {
    switch (phase) {
      case "reserving":
        return "正在创建上传会话...";
      case "audio":
        return `正在上传音频文件 (${percent}%)...`;
      case "cover":
        return `正在上传封面图片 (${percent}%)...`;
      case "lyrics":
        return `正在上传歌词文件 (${percent}%)...`;
      case "processing":
        return "正在解析音频元数据与提取封面...";
      default:
        return "";
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6">
      <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-md" onClick={uploading ? undefined : onClose} aria-hidden />
      <div
        className="relative z-10 my-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-2xl backdrop-blur-2xl animate-fade-in-up sm:max-h-[calc(100dvh-4rem)] sm:rounded-[2rem]"
        style={{ animationDuration: "0.2s" }}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-white/50 bg-white/40 px-5 py-4 sm:px-8 sm:py-5">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 sm:text-xl">上传网盘音乐</h3>
            <p className="mt-1 text-xs text-slate-500">上传音频文件至私有存储，并自动解析元数据。</p>
          </div>
          {!uploading && (
            <button type="button" onClick={onClose} className="rounded-full bg-white/60 p-2 text-slate-500 shadow-sm hover:bg-white" aria-label="关闭">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-8">
          {/* Audio file (required) */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              音频文件 <span className="text-red-500">*</span>
              <span className="ml-2 font-normal text-xs text-slate-400">支持 MP3, FLAC, M4A, AAC, OGG, OPUS, WAV，上限 500MB</span>
            </label>
            <input
              type="file"
              accept=".mp3,.flac,.m4a,.mp4,.aac,.ogg,.opus,.wav"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setAudioFile(file);
                setError("");
              }}
              className={glassInputClasses}
            />
            {audioFile && (
              <p className="mt-1.5 text-xs text-emerald-600 font-medium">
                已选音频: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Cover file (optional) */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              封面图片 <span className="font-normal text-xs text-slate-400">（可选，支持 JPG, PNG, WEBP，上限 10MB）</span>
            </label>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              disabled={uploading}
              onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              className={glassInputClasses}
            />
            {coverFile && (
              <p className="mt-1.5 text-xs text-emerald-600 font-medium">
                已选封面: {coverFile.name} ({(coverFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Lyrics file (optional) */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              歌词文件 <span className="font-normal text-xs text-slate-400">（可选，支持 UTF-8 LRC, TXT，上限 2MB）</span>
            </label>
            <input
              type="file"
              accept=".lrc,.txt"
              disabled={uploading}
              onChange={(e) => setLyricsFile(e.target.files?.[0] || null)}
              className={glassInputClasses}
            />
            {lyricsFile && (
              <p className="mt-1.5 text-xs text-emerald-600 font-medium">
                已选歌词: {lyricsFile.name} ({(lyricsFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Progress & Error */}
          {uploading && (
            <div className="rounded-2xl border border-white/60 bg-white/60 p-4 space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-700">
                <span>{getPhaseText()}</span>
                <span>{percent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full transition-all duration-300 rounded-full"
                  style={{ width: `${percent}%`, backgroundColor: themeColor }}
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
            disabled={uploading}
            onClick={onClose}
            className="rounded-xl border border-white/60 bg-white/80 px-6 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-white disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={uploading || !audioFile}
            onClick={handleStartUpload}
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            className="rounded-xl px-8 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "上传解析中..." : "开始上传"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
