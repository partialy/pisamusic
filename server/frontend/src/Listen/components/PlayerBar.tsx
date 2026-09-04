import { useEffect, useMemo, useRef, useState } from "react";
import {
  Heart,
  ListMusic,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import type { ModalTriggerReason } from "./DownloadModal";
import type { WebSong } from "../../api/webMusicApi";
import { getWebSongLyric, getWebSongUrl } from "../../api/webMusicApi";

interface PlayerBarProps {
  currentSong: WebSong | null;
  playlist: WebSong[];
  currentIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onSelectSong: (index: number) => void;
  onOpenDownloadModal: (reason: ModalTriggerReason) => void;
}

type LyricLine = {
  time: number;
  text: string;
};

function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split("\n");
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of lines) {
    const text = line.replace(timeRegex, "").trim();
    let match: RegExpExecArray | null;
    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const msStr = match[3] || "0";
      const ms = msStr.length === 2 ? parseInt(msStr, 10) * 10 : parseInt(msStr, 10);
      const totalSeconds = min * 60 + sec + ms / 1000;
      if (text) {
        result.push({ time: totalSeconds, text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m < 10 ? "0" + m : m}:${s < 10 ? "0" + s : s}`;
}

export default function PlayerBar({
  currentSong,
  playlist,
  currentIndex,
  onPrev,
  onNext,
  onSelectSong,
  onOpenDownloadModal,
}: PlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [rawLrc, setRawLrc] = useState("");
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [expandLyrics, setExpandLyrics] = useState(false);

  // Parse lyrics
  const parsedLyrics = useMemo(() => parseLrc(rawLrc), [rawLrc]);

  // Find active lyric index
  const activeLyricIndex = useMemo(() => {
    if (!parsedLyrics.length) return -1;
    for (let i = parsedLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= parsedLyrics[i].time) {
        return i;
      }
    }
    return 0;
  }, [parsedLyrics, currentTime]);

  const currentLyric = activeLyricIndex >= 0 ? parsedLyrics[activeLyricIndex]?.text : "";

  // When currentSong changes, fetch URL and lyric
  useEffect(() => {
    if (!currentSong) {
      setAudioUrl("");
      setRawLrc("");
      return;
    }

    let isCancelled = false;
    setLoadingAudio(true);
    setCurrentTime(0);

    Promise.all([
      getWebSongUrl(currentSong.source, currentSong.id),
      getWebSongLyric(currentSong.source, currentSong.id),
    ])
      .then(([urlRes, lrcRes]) => {
        if (isCancelled) return;
        setAudioUrl(urlRes.url || "");
        setRawLrc(lrcRes.lrc || "");
        setLoadingAudio(false);
      })
      .catch((err) => {
        if (isCancelled) return;
        // eslint-disable-next-line no-console
        console.warn("加载歌曲失败:", err);
        setLoadingAudio(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [currentSong]);

  // Handle play/pause with audio tag
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    audio.src = audioUrl;
    audio.load();

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay was prevented
          setIsPlaying(false);
        });
    }
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val > 0 && isMuted) {
        setIsMuted(false);
        audioRef.current.muted = false;
      }
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      audioRef.current.muted = nextMuted;
    }
  };

  if (!currentSong) return null;

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) {
            setDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          onNext();
        }}
      />

      {/* Floating Mini Lyrics Panel when expanded */}
      {expandLyrics && (
        <div className="fixed bottom-24 inset-x-4 sm:inset-x-auto sm:right-6 sm:w-96 z-40 rounded-2xl border border-white/60 bg-white/95 p-4 shadow-xl shadow-slate-900/10 backdrop-blur-xl animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700">实时歌词</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full font-medium">
                App 支持逐字动感歌词
              </span>
              <button
                type="button"
                onClick={() => setExpandLyrics(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="mt-3 space-y-2 text-center text-xs">
            {parsedLyrics.length > 0 ? (
              <>
                <p className="text-slate-400 truncate text-[11px]">
                  {activeLyricIndex > 0 ? parsedLyrics[activeLyricIndex - 1]?.text : "..."}
                </p>
                <p className="text-sky-600 font-bold text-sm leading-relaxed scale-105 transition-all">
                  {currentLyric || currentSong.name}
                </p>
                <p className="text-slate-400 truncate text-[11px]">
                  {activeLyricIndex < parsedLyrics.length - 1
                    ? parsedLyrics[activeLyricIndex + 1]?.text
                    : "..."}
                </p>
              </>
            ) : (
              <p className="text-slate-400 py-3">暂无歌词或纯音乐</p>
            )}
          </div>
        </div>
      )}

      {/* Floating Playlist Queue Drawer */}
      {showQueue && (
        <div className="fixed bottom-24 right-4 sm:right-10 z-40 w-80 sm:w-96 max-h-80 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl animate-fadeIn flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <ListMusic className="h-4 w-4 text-sky-600" />
              <span className="text-xs font-bold text-slate-800">当前试听队列（共 {playlist.length} 首）</span>
            </div>
            <button
              type="button"
              onClick={() => setShowQueue(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-medium"
            >
              关闭
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100/60 p-1">
            {playlist.map((song, idx) => (
              <div
                key={`${song.source}-${song.id}-${idx}`}
                onClick={() => onSelectSong(idx)}
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                  idx === currentIndex
                    ? "bg-sky-50 text-sky-600 font-bold"
                    : "text-slate-700 hover:bg-slate-100/70"
                }`}
              >
                <div className="flex items-center gap-2.5 truncate pr-2">
                  <span className="w-4 text-center text-[11px] text-slate-400">{idx + 1}</span>
                  <span className="truncate">{song.name}</span>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{song.singer}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fixed Bottom Player Bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 shadow-lg shadow-slate-900/10 backdrop-blur-md select-none transition-all">
        <div className="mx-auto flex h-20 sm:h-22 max-w-7xl items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4">
          {/* Left: Song Info */}
          <div className="flex items-center gap-3 w-40 sm:w-64 min-w-0">
            <div className="relative group shrink-0">
              <img
                src={currentSong.cover || "/assets/app-icon.png"}
                alt=""
                className={`h-12 w-12 sm:h-14 sm:w-14 rounded-xl object-cover shadow-md transition-all ${
                  isPlaying ? "animate-spin-slow ring-2 ring-sky-400/40" : ""
                }`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/assets/app-icon.png";
                }}
              />
              <button
                type="button"
                onClick={() => onOpenDownloadModal("favorite")}
                title="收藏需登录客户端"
                className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-white/90 text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100"
              >
                <Heart className="h-3 w-3" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs sm:text-sm font-bold text-slate-900">
                  {currentSong.name}
                </span>
              </div>
              <p className="truncate text-[11px] sm:text-xs text-slate-500 mt-0.5">
                {currentSong.singer} {currentSong.album ? `· ${currentSong.album}` : ""}
              </p>
            </div>
          </div>

          {/* Center: Controls + Direct Lyric Display */}
          <div className="flex-1 max-w-xl flex flex-col items-center">
            {/* Direct Integrated Lyrics Line (Requirement 3) */}
            <div className="w-full flex items-center justify-center gap-2 mb-1 px-2">
              <div
                onClick={() => setExpandLyrics(!expandLyrics)}
                className="flex items-center gap-1.5 cursor-pointer max-w-full group"
                title="点击展开多行歌词"
              >
                <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold text-sky-600 group-hover:text-sky-700 truncate transition-colors">
                  <Music2 className="h-3 w-3 shrink-0 animate-bounce" />
                  <span className="truncate">
                    {currentLyric || "PisaMusic · 听见你的热爱"}
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 group-hover:text-sky-500 shrink-0">
                  {expandLyrics ? (
                    <Minimize2 className="h-3 w-3" />
                  ) : (
                    <Maximize2 className="h-3 w-3" />
                  )}
                </span>
              </div>
            </div>

            {/* Playback Control Buttons */}
            <div className="flex items-center gap-3 sm:gap-5">
              <button
                type="button"
                onClick={onPrev}
                className="p-1.5 text-slate-500 hover:text-sky-600 transition-colors"
                title="上一首"
              >
                <SkipBack className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>

              <button
                type="button"
                onClick={togglePlay}
                disabled={loadingAudio}
                className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-md hover:bg-sky-600 hover:scale-105 active:scale-95 transition-all"
                title={isPlaying ? "暂停" : "播放"}
              >
                {loadingAudio ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : isPlaying ? (
                  <Pause className="h-4 w-4 sm:h-5 sm:w-5 fill-current" />
                ) : (
                  <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={onNext}
                className="p-1.5 text-slate-500 hover:text-sky-600 transition-colors"
                title="下一首"
              >
                <SkipForward className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {/* Progress Slider */}
            <div className="w-full flex items-center gap-2 mt-1 px-1">
              <span className="text-[10px] sm:text-xs text-slate-400 w-9 text-right font-mono">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600 hover:accent-sky-500"
              />
              <span className="text-[10px] sm:text-xs text-slate-400 w-9 font-mono">
                {formatTime(duration || currentSong.duration / 1000)}
              </span>
            </div>
          </div>

          {/* Right: Quality & Actions */}
          <div className="flex items-center gap-2 sm:gap-3 w-36 sm:w-64 justify-end">
            {/* Audio Quality Tag with Trigger */}
            <button
              type="button"
              onClick={() => onOpenDownloadModal("quality")}
              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50/70 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-bold text-sky-700 hover:bg-sky-100 hover:border-sky-300 transition-all group"
              title="网页版仅提供标准 128K 试听，点击切换无损"
            >
              <Zap className="h-3 w-3 text-sky-500 group-hover:scale-110 transition-transform" />
              <span>标准 128K</span>
              <span className="hidden md:inline text-sky-400 text-[10px] font-normal">| 换音质</span>
            </button>

            {/* Volume Control (hidden on very small screens) */}
            <div className="hidden lg:flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-700"
              />
            </div>

            {/* Queue Toggle Button */}
            <button
              type="button"
              onClick={() => setShowQueue(!showQueue)}
              className={`p-2 rounded-xl transition-colors ${
                showQueue ? "bg-sky-50 text-sky-600" : "text-slate-500 hover:text-slate-700"
              }`}
              title="播放队列"
            >
              <ListMusic className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
