import { useEffect, useState } from "react";
import {
  ChevronRight,
  Download,
  Music,
  Play,
  Search,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import DownloadModal, { type ModalTriggerReason } from "./components/DownloadModal";
import PlayerBar from "./components/PlayerBar";
import {
  type WebMusicSource,
  type WebSong,
  getWebRecommendations,
  searchWebMusic,
} from "../api/webMusicApi";

interface ListenPageProps {
  onBackToHome: () => void;
}

const SOURCES: { key: WebMusicSource; name: string }[] = [
  { key: "wy", name: "音源1" },
  { key: "kg", name: "音源2" },
  { key: "kw", name: "音源3" },
];

const QUICK_TAGS = ["周杰伦", "林俊杰", "热歌榜", "陈奕迅", "邓紫棋", "轻音乐"];

export default function ListenPage({ onBackToHome }: ListenPageProps) {
  const [source, setSource] = useState<WebMusicSource>("wy");
  const [keywordInput, setKeywordInput] = useState("");
  const [activeKeyword, setActiveKeyword] = useState("");

  const [recommendSongs, setRecommendSongs] = useState<WebSong[]>([]);
  const [searchResults, setSearchResults] = useState<WebSong[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Player State
  const [playlist, setPlaylist] = useState<WebSong[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalReason, setModalReason] = useState<ModalTriggerReason>("general");

  const openDownloadModal = (reason: ModalTriggerReason) => {
    setModalReason(reason);
    setModalOpen(true);
  };

  // Load recommendations when source changes or initially
  useEffect(() => {
    let cancelled = false;
    if (!activeKeyword) {
      setLoading(true);
      getWebRecommendations(source)
        .then((res) => {
          if (cancelled) return;
          setRecommendSongs(res.songs || []);
          setPlaylist(res.songs || []);
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          // eslint-disable-next-line no-console
          console.warn("加载推荐失败:", err);
          setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [source, activeKeyword]);

  // Execute Search
  const handleSearch = (kw = keywordInput) => {
    const trimmed = kw.trim();
    if (!trimmed) {
      setActiveKeyword("");
      return;
    }
    setActiveKeyword(trimmed);
    setLoading(true);

    searchWebMusic(source, trimmed)
      .then((res) => {
        setSearchResults(res.songs || []);
        setSearchTotal(res.total || res.songs.length);
        setPlaylist(res.songs || []);
        setCurrentIndex(-1); // Reset selection
        setLoading(false);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("搜索出错:", err);
        setLoading(false);
      });
  };

  // Switch Source
  const handleSelectSource = (s: WebMusicSource) => {
    if (s === source) return;
    setSource(s);
    if (activeKeyword) {
      setLoading(true);
      searchWebMusic(s, activeKeyword)
        .then((res) => {
          setSearchResults(res.songs || []);
          setSearchTotal(res.total || res.songs.length);
          setPlaylist(res.songs || []);
          setCurrentIndex(-1);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  };

  const handlePlaySong = (song: WebSong, list: WebSong[], index: number) => {
    setPlaylist(list);
    setCurrentIndex(index);
  };

  const currentSong = currentIndex >= 0 && playlist[currentIndex] ? playlist[currentIndex] : null;

  return (
    <div className="min-h-screen bg-[#f8fcff] text-slate-900 pb-32 select-none">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
            title="PisaMusic 首页"
          >
            <img src="/assets/app-icon.png" alt="PisaMusic" className="h-8 w-8 rounded-xl shadow-sm group-hover:scale-[1.03] transition-all duration-300" />
            <span className="font-display text-base font-bold tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors duration-300">PisaMusic</span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => openDownloadModal("general")}
              className="inline-flex h-8 sm:h-9 text-xs items-center gap-1.5 rounded-full bg-slate-900 px-3.5 sm:px-4 font-bold text-white shadow-sm hover:bg-sky-600 transition-all hover:scale-[1.02]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>下载客户端</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 sm:px-8 pt-6 sm:pt-8">
        {/* Source Switcher & Search Bar */}
        <div className="flex flex-col gap-4 rounded-3xl border border-white/60 bg-white/80 p-4 sm:p-6 shadow-sm shadow-slate-200/50 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Source Pill Switchers */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl">
              {SOURCES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => handleSelectSource(s.key)}
                  className={`flex items-center px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    source === s.key
                      ? "bg-white text-sky-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Search Input Box */}
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              placeholder="搜索歌曲、歌手或专辑..."
              className="h-11 sm:h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 pl-11 pr-24 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
            />
            {keywordInput && (
              <button
                type="button"
                onClick={() => {
                  setKeywordInput("");
                  setActiveKeyword("");
                }}
                className="absolute right-20 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSearch()}
              className="absolute right-1.5 sm:right-2 h-8 sm:h-9 rounded-xl bg-sky-600 px-3.5 sm:px-4 text-xs font-bold text-white shadow-sm hover:bg-sky-500 transition-colors"
            >
              搜索
            </button>
          </div>

          {/* Quick Tags */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
            <span className="text-[11px] font-medium text-slate-400 mr-1">大家都在搜:</span>
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setKeywordInput(tag);
                  handleSearch(tag);
                }}
                className="rounded-full bg-slate-100 hover:bg-sky-50 hover:text-sky-600 border border-slate-200/50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="my-16 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
            <p className="text-xs text-slate-400 font-medium">正在检索万籁曲库...</p>
          </div>
        ) : activeKeyword ? (
          /* Search Results Mode */
          <div className="mt-8 space-y-4">
            {/* Header info */}
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                “{activeKeyword}” 的搜索结果
              </h2>
              <span className="text-xs text-slate-400">
                找到 {searchTotal} 首 · 网页版展示前 10 首试听
              </span>
            </div>

            {/* Song List */}
            {searchResults.length > 0 ? (
              <div className="divide-y divide-slate-100 rounded-3xl border border-white/60 bg-white/80 shadow-sm backdrop-blur-md overflow-hidden">
                {searchResults.map((song, idx) => {
                  const isCurrent = currentSong?.id === song.id;
                  return (
                    <div
                      key={`${song.source}-${song.id}-${idx}`}
                      onClick={() => handlePlaySong(song, searchResults, idx)}
                      className={`group flex items-center justify-between p-3 sm:p-4 transition-colors cursor-pointer ${
                        isCurrent ? "bg-sky-50/70" : "hover:bg-slate-50/80"
                      }`}
                    >
                      {/* Left: Index + Cover + Title */}
                      <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        <span
                          className={`w-5 text-center text-xs font-mono font-bold ${
                            idx < 3 ? "text-sky-600" : "text-slate-400"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="relative h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                          <img
                            src={song.cover || "/assets/app-icon.png"}
                            alt=""
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/assets/app-icon.png";
                            }}
                          />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="h-4 w-4 text-white fill-white" />
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`truncate text-xs sm:text-sm font-bold ${
                                isCurrent ? "text-sky-600" : "text-slate-900"
                              }`}
                            >
                              {song.name}
                            </span>
                            <span className="hidden sm:inline-block rounded border border-sky-200 bg-sky-50 px-1 py-0.2 text-[9px] font-bold text-sky-600">
                              标准 128K
                            </span>
                          </div>
                          <p className="truncate text-[11px] sm:text-xs text-slate-500 mt-0.5">
                            {song.singer} {song.album ? `· ${song.album}` : ""}
                          </p>
                        </div>
                      </div>

                      {/* Right: Quick actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlaySong(song, searchResults, idx);
                          }}
                          className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                            isCurrent
                              ? "bg-sky-600 text-white"
                              : "bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white"
                          }`}
                        >
                          <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Bottom App Download Prompt Card (Key conversion requirement) */}
                <div className="p-6 sm:p-8 bg-gradient-to-b from-transparent to-sky-50/50 flex flex-col items-center text-center">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600 mb-3 shadow-inner">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900">
                    仅展示前 10 首试听结果 · 解锁全部千万曲库
                  </h4>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm">
                    想要查看此关键词下的全部搜索结果，或享受无损 SQ / Hi-Res 音质，请下载 PisaMusic 完整客户端。
                  </p>
                  <button
                    type="button"
                    onClick={() => openDownloadModal("search_more")}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-sky-600 transition-colors"
                  >
                    <span>下载客户端查看全部结果</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="my-12 rounded-3xl border border-slate-200/80 bg-white/70 p-8 text-center backdrop-blur-sm">
                <Music className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs text-slate-400">未找到相关歌曲，换个关键词或源试试吧</p>
              </div>
            )}
          </div>
        ) : (
          /* Recommendation / Homepage Layout Mode */
          <div className="mt-8 space-y-8">
            {/* Promo Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl shadow-sky-950/10">
              <div className="relative z-10 max-w-xl">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-300 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>随身唱片盒 · 案头音乐书房</span>
                </div>
                <h2 className="mt-3 text-xl sm:text-2xl font-bold tracking-tight">
                  免装即听 · 全源汇流音乐体验
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  网页版支持免登录快速检索与标准试听。下载客户端尊享无损 FLAC、桌面悬浮动感歌词、自建歌单与跨端实时同步。
                </p>
                <div className="mt-5 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => openDownloadModal("general")}
                    className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-md hover:bg-sky-50 transition-all hover:scale-105"
                  >
                    <Download className="h-3.5 w-3.5 text-sky-600" />
                    <span>立即下载客户端</span>
                  </button>
                </div>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] opacity-10 pointer-events-none">
                <Music className="h-64 w-64 text-white" />
              </div>
            </div>

            {/* Recommendations Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">今日精选推荐</h3>
                  <span className="text-[10px] rounded-full bg-slate-200/70 px-2 py-0.5 font-semibold text-slate-600">
                    {SOURCES.find((s) => s.key === source)?.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openDownloadModal("search_more")}
                  className="text-xs text-sky-600 hover:text-sky-700 font-semibold"
                >
                  发现更多
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                {recommendSongs.map((song, idx) => {
                  const isCurrent = currentSong?.id === song.id;
                  return (
                    <div
                      key={`${song.source}-${song.id}-${idx}`}
                      onClick={() => handlePlaySong(song, recommendSongs, idx)}
                      className="group flex flex-col rounded-2xl border border-white/60 bg-white/70 p-2.5 shadow-sm hover:shadow-md hover:border-sky-200 backdrop-blur-sm transition-all cursor-pointer"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-100 mb-2">
                        <img
                          src={song.cover || "/assets/app-icon.png"}
                          alt=""
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/assets/app-icon.png";
                          }}
                        />
                        <div
                          className={`absolute inset-0 bg-black/25 flex items-center justify-center transition-opacity ${
                            isCurrent
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-900 shadow-md">
                            {isCurrent ? (
                              <Volume2 className="h-4 w-4 text-sky-600 animate-pulse" />
                            ) : (
                              <Play className="h-4 w-4 fill-slate-900 ml-0.5" />
                            )}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`truncate text-xs font-bold leading-tight ${
                          isCurrent ? "text-sky-600" : "text-slate-900"
                        }`}
                      >
                        {song.name}
                      </span>
                      <span className="truncate text-[11px] text-slate-400 mt-1">
                        {song.singer}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Integrated Bottom PlayerBar */}
      <PlayerBar
        currentSong={currentSong}
        playlist={playlist}
        currentIndex={currentIndex}
        onPrev={() => {
          if (playlist.length <= 1) return;
          setCurrentIndex((currentIndex - 1 + playlist.length) % playlist.length);
        }}
        onNext={() => {
          if (playlist.length <= 1) return;
          setCurrentIndex((currentIndex + 1) % playlist.length);
        }}
        onSelectSong={(idx) => setCurrentIndex(idx)}
        onOpenDownloadModal={openDownloadModal}
      />

      {/* App Download Guidance Modal */}
      <DownloadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        reason={modalReason}
      />
    </div>
  );
}
