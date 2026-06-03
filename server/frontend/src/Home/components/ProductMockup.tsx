import { 
  Download, 
  Heart, 
  ListMusic, 
  Pause, 
  Play, 
  Search, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Volume2, 
  Repeat, 
  Disc, 
  Radio, 
  FolderDown, 
  User, 
  Bell, 
  Sparkles,
  Laptop
} from "lucide-react";
import { sourcePills } from "../../data/siteContent";

function AndroidMockup() {
  const localPills = [
    { label: "夜晚", color: "bg-indigo-50 text-indigo-600 border-indigo-100/40" },
    { label: "安静", color: "bg-sky-50 text-sky-600 border-sky-100/40" },
    { label: "治愈", color: "bg-emerald-50 text-emerald-600 border-emerald-100/40" }
  ];

  return (
    <div className="relative w-[210px] rounded-[32px] border border-slate-900/10 bg-slate-950 p-2 shadow-2xl sm:w-[240px] sm:rounded-[36px] transition-all duration-500 hover:scale-[1.03] hover:shadow-sky-500/10 hover:-translate-y-1">
      <div className="overflow-hidden rounded-[25px] bg-white sm:rounded-[29px]">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-400">随身版</p>
            <p className="mt-1 text-base font-black text-slate-800">今日推荐</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </div>
        </div>

        {/* Custom vector-drawn visual card covers to ensure 100% robustness without broken images */}
        <div className="flex gap-2 overflow-hidden px-4">
          <div className="h-20 w-20 flex-none rounded-lg bg-gradient-to-tr from-pink-100 to-rose-200 border border-pink-100/50 relative shadow-sm flex items-center justify-center">
            <span className="absolute bottom-1 right-1 text-[8px] font-black text-rose-500/60 bg-white/75 px-1 rounded">FM</span>
            <Heart className="h-5 w-5 text-rose-400" />
          </div>
          <div className="h-20 w-20 flex-none rounded-lg bg-gradient-to-tr from-sky-100 to-indigo-200 border border-sky-100/50 relative shadow-sm flex items-center justify-center">
            <span className="absolute bottom-1 right-1 text-[8px] font-black text-sky-500/60 bg-white/75 px-1 rounded">HOT</span>
            <Disc className="h-5 w-5 text-sky-400 animate-spin-slow" />
          </div>
        </div>

        <div className="px-4 pb-4 pt-4">
          <div className="mb-3 flex flex-wrap gap-1">
            {localPills.map((source) => (
              <span key={source.label} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-extrabold ${source.color}`}>
                {source.label}
              </span>
            ))}
          </div>

          <div className="rounded-xl bg-slate-950 p-3 text-white">
            <p className="text-[10px] font-bold text-sky-400">正在播放</p>
            <p className="mt-0.5 text-[11px] font-bold text-white leading-tight truncate">夜航曲 · PisaMusic Mix</p>
            <div className="mt-3.5 space-y-1.5 text-center">
              <p className="text-[9px] text-white/35">When the city turns blue</p>
              <p className="text-xs font-black text-sky-200">把夜晚调成自己的节拍</p>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              {/* Previous song button - mirrored skip-next SVG to perfectly match style */}
              <button className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all duration-300 hover:scale-110 active:scale-95 border border-white/5 shadow-sm" aria-label="上一首">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 transform -scale-x-100" viewBox="0 0 24 24">
                  <path d="M0 0h24v24H0z" fill="none" />
                  <path fill="currentColor" d="M5 7.766c0-1.554 1.696-2.515 3.029-1.715l7.056 4.234c1.295.777 1.295 2.653 0 3.43L8.03 17.949c-1.333.8-3.029-.16-3.029-1.715zM14.056 12L7 7.766v8.468zM18 6a1 1 0 0 1 1 1v10a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1" />
                </svg>
              </button>

              {/* Central Play/Pause button */}
              <button className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-950 shadow-md hover:scale-110 active:scale-95 transition-all duration-300" aria-label="暂停播放">
                <Pause className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              </button>

              {/* Next song button - custom styled SVG */}
              <button className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white transition-all duration-300 hover:scale-110 active:scale-95 border border-white/5 shadow-sm" aria-label="下一首">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24">
                  <path d="M0 0h24v24H0z" fill="none" />
                  <path fill="currentColor" d="M5 7.766c0-1.554 1.696-2.515 3.029-1.715l7.056 4.234c1.295.777 1.295 2.653 0 3.43L8.03 17.949c-1.333.8-3.029-.16-3.029-1.715zM14.056 12L7 7.766v8.468zM18 6a1 1 0 0 1 1 1v10a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopMockup() {
  const menu = [
    { label: "推荐", icon: Radio, active: true },
    { label: "歌单", icon: ListMusic, active: false },
    { label: "收藏", icon: Heart, active: false },
    { label: "我的", icon: User, active: false },
    { label: "本地与下载", icon: FolderDown, active: false },
    { label: "设置", icon: Settings, active: false }
  ];

  const playlistCards = [
    {
      title: "满满的少女心！上课也要偷偷听的暖心男声",
      grad: "from-pink-200 via-rose-100 to-amber-100 border-rose-200/45",
      color: "text-rose-500",
      icon: Heart
    },
    {
      title: "电音｜压迫感吗，有点意思",
      grad: "from-slate-900 via-indigo-950 to-slate-900 border-indigo-900/40 text-sky-300",
      color: "text-sky-300",
      icon: Radio
    },
    {
      title: "酷酷的男孩爱听的rap，不来试试？",
      grad: "from-teal-400 via-sky-650 to-indigo-500 border-sky-300/30",
      color: "text-teal-600",
      icon: Disc
    },
    {
      title: "无前奏日系 ‖ 洗脑神曲回头率666%",
      grad: "from-cyan-300 via-emerald-100 to-indigo-100 border-cyan-200/30",
      color: "text-emerald-600",
      icon: ListMusic
    },
    {
      title: "睡个好觉！轻柔纯音助你入眠",
      grad: "from-blue-900 via-slate-900 to-indigo-950 border-indigo-950/40",
      color: "text-sky-400",
      icon: Sparkles
    }
  ];

  return (
    <div className="relative w-full rounded-[24px] border border-white/80 bg-white/90 p-1.5 shadow-panel backdrop-blur-md sm:rounded-[28px] sm:p-2.5">
      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-[#f4f9fd] sm:rounded-[22px] flex flex-col">
        
        {/* Top Header Controls Bar */}
        <div className="flex h-12 items-center justify-between border-b border-slate-200 bg-white px-3 sm:px-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400/90" />
            <span className="h-2 w-2 rounded-full bg-amber-400/90" />
            <span className="h-2 w-2 rounded-full bg-emerald-400/90" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0 px-2">
            <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-sky-400 animate-pulse" />
            <p className="text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400 truncate max-w-[120px] xs:max-w-[180px] sm:tracking-[0.2em] sm:max-w-none">PisaMusic Client Preview</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden xs:block h-1 w-2 rounded-full bg-slate-300" />
            <div className="hidden xs:block h-2 w-2 border border-slate-300 rounded-sm" />
            <div className="h-2 w-2 text-slate-300 font-sans text-[9px] leading-none">✕</div>
          </div>
        </div>

        {/* App Main Area (Sidebar + Workspace Split) */}
        <div className="grid grid-cols-[48px_1fr] sm:grid-cols-[144px_1fr] min-h-[360px] bg-[#f5fbfe]">
          
          {/* Main Left Sidebar */}
          <aside className="border-r border-slate-200/80 bg-white/85 p-2 sm:p-3.5 flex flex-col justify-between">
            <div>
              <div className="mb-6 flex items-center justify-center sm:justify-start gap-2">
                <img className="h-6 w-6 sm:h-7 sm:w-7 rounded-lg shadow-sm" src="/assets/app-icon.png" alt="" />
                <span className="hidden text-xs font-black tracking-tight text-slate-800 sm:inline">PisaMusic</span>
              </div>
              
              <nav className="space-y-1">
                {menu.map((item) => {
                  const MenuIcon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className={`flex items-center justify-center sm:justify-start gap-2 rounded-xl p-2 sm:px-2.5 sm:py-1.8 text-[11px] font-extrabold transition duration-300 cursor-pointer ${
                        item.active 
                          ? "bg-sky-500/10 text-sky-600 shadow-inner" 
                          : "text-slate-500 hover:bg-slate-100/50 hover:text-slate-800"
                      }`}
                      title={item.label}
                    >
                      <MenuIcon className={`h-4 w-4 sm:h-3.8 sm:w-3.8 ${item.active ? "text-sky-500" : "text-slate-400"}`} />
                      <span className="hidden sm:inline">{item.label}</span>
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* Purely informational copyright bottom spacer */}
            <div className="hidden sm:block">
              <span className="text-[8px] font-bold uppercase tracking-wider text-slate-300/80">Premium v2.1</span>
            </div>
          </aside>

          {/* Right Workspace Client Content */}
          <main className="p-3 sm:p-5 flex flex-col gap-4 overflow-hidden">
            
            {/* Top Workspace Header Controls */}
            <div className="flex items-center justify-between gap-2.5">
              
              {/* Back navigation and search bar area */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="hidden sm:flex gap-1.5 shrink-0">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm">
                    <ChevronLeft className="h-3 w-3" />
                  </div>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm">
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
                
                {/* Simulated Search Pill */}
                <div className="relative flex items-center min-w-0">
                  <Search className="absolute left-2.5 h-3 w-3 text-slate-400 pointer-events-none" />
                  <div className="rounded-full bg-white border border-slate-100 pl-7 pr-3 py-1 text-[10px] w-24 xs:w-28 sm:w-36 text-slate-400 shadow-sm truncate">
                    搜索
                  </div>
                </div>
              </div>

              {/* User Account panel */}
              <div className="flex items-center gap-1.5 shrink-0">
                
                {/* Partial VIP badge */}
                <div className="shrink-0 inline-flex items-center gap-1 rounded-full bg-white border border-slate-100 py-0.5 sm:py-1 pl-1 pr-2 sm:pl-1.5 sm:pr-2.5 shadow-sm">
                  {/* Custom beautifully drawn user icon avatar */}
                  <img className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 rounded-full object-cover shadow-inner" src="/assets/app-icon.png" alt="Partial" />
                  <span className="text-[9px] sm:text-[10px] font-black text-slate-700 truncate max-w-[32px] xs:max-w-[48px] sm:max-w-none">Partial</span>
                  <span className="shrink-0 rounded bg-gradient-to-r from-amber-500 to-amber-400 px-0.5 py-0.2 sm:px-1 sm:py-0.5 text-[6px] sm:text-[7px] font-black tracking-wider text-slate-950 shadow-sm shadow-amber-500/10 scale-90">VIP</span>
                </div>

                <div className="shrink-0 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-400 shadow-sm cursor-pointer hover:text-slate-600">
                  <Settings className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>
              </div>
            </div>

            {/* Panel Row 1: Notices and Hot Top side-by-side */}
            <div className="grid gap-3 sm:grid-cols-[1.5fr_1fr]">
              
              {/* Left Notice Column */}
              <article className="rounded-2xl border border-sky-100/70 bg-white p-3.5 shadow-[0_4px_16px_rgba(39,184,244,0.03)] relative flex flex-col justify-between min-h-[124px] h-auto pb-4">
                <div>
                  <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.16em]">
                    <span className="text-sky-500">Notice 1/3</span>
                    <span className="text-slate-400 font-mono">2026-04-08 20:00</span>
                  </div>
                  <h4 className="mt-1 text-xs font-black text-slate-800 flex items-center gap-1">
                    <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500 animate-pulse"></span>
                    <span className="truncate">公告栏：最新升级通告</span>
                  </h4>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500 font-semibold line-clamp-2">
                    欢迎使用 PisaMusic！本端支持富媒体展示与本地/在线歌单合并，多设备云端歌单实时联动。
                  </p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-1.5 border-t border-slate-50/80">
                  <div className="flex gap-1 items-center">
                    <span className="h-1.5 w-3 rounded-full bg-sky-500" />
                    <span className="h-1 w-1 rounded-full bg-slate-200" />
                    <span className="h-1 w-1 rounded-full bg-slate-200" />
                  </div>
                  <button className="rounded-full bg-sky-500 px-3 py-1 text-[9px] font-black text-white shadow-sm shadow-sky-500/20 hover:bg-sky-600 transition">
                    我知道了
                  </button>
                </div>
              </article>
 
              {/* Right Hot Top Column */}
              <article className="rounded-2xl border border-sky-100/70 bg-white p-3.5 shadow-[0_4px_16px_rgba(39,184,244,0.03)] flex flex-col justify-between min-h-[124px] h-auto pb-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Hot Top 热门
                  </h4>
                  <span className="text-[9px] font-black text-sky-500 hover:underline cursor-pointer shrink-0">查看更多</span>
                </div>
                <div className="flex flex-col items-center justify-center flex-1 py-1.5">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-400 font-semibold">暂无热门歌曲</p>
                    <p className="text-[8px] text-slate-300 mt-0.5">为您同步全球曲库动态</p>
                  </div>
                </div>
              </article>
            </div>
 
            {/* Panel Row 2: "推荐歌单" Card Rows */}
            <div className="mt-1">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5">
                  <span className="h-3 w-1 rounded-full bg-sky-500" />
                  推荐歌单
                </h4>
                <span className="text-[9px] font-black text-sky-500 hover:underline cursor-pointer">
                  查看更多 &gt;
                </span>
              </div>
              
              {/* Responsive 3-to-5-Column layout of vector cards representation */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-2.5">
                {playlistCards.map((p, idx) => {
                  const isSelected = idx === 1;
                  const isHiddenOnMobile = idx >= 3;
                  return (
                    <div key={idx} className={`group/card cursor-pointer relative ${isHiddenOnMobile ? "hidden sm:block" : ""}`}>
                      <div className={`aspect-square rounded-xl bg-gradient-to-br ${p.grad} relative overflow-hidden flex items-center justify-center transition-all duration-500 ${
                        isSelected 
                          ? "border-2 border-sky-400/90 -translate-y-1 shadow-[0_8px_18px_rgba(14,165,233,0.12)] ring-2 ring-sky-500/10" 
                          : "border border-slate-200/60 shadow-sm group-hover/card:-translate-y-1 group-hover/card:shadow-md"
                      }`}>
                        <div className={`absolute inset-0 bg-black/5 ${isSelected ? "opacity-100" : "opacity-0 group-hover/card:opacity-100"} transition duration-300`} />
                        
                        {/* Audio equalizer animation bars for the selected card to feel alive and professional */}
                        {isSelected && (
                          <div className="absolute top-2 left-2 flex gap-0.5 items-end h-3" aria-hidden="true">
                            <span className="w-[1.5px] bg-sky-400 rounded-full animate-pulse h-1 bg-gradient-to-t from-sky-400 to-indigo-400" style={{ animationDelay: '0.1s', animationDuration: '0.6s' }} />
                            <span className="w-[1.5px] bg-sky-400 rounded-full animate-pulse h-2.5 bg-gradient-to-t from-sky-400 to-indigo-400" style={{ animationDelay: '0.3s', animationDuration: '0.8s' }} />
                            <span className="w-[1.5px] bg-sky-400 rounded-full animate-pulse h-1.5 bg-gradient-to-t from-sky-400 to-indigo-400" style={{ animationDelay: '0.5s', animationDuration: '0.5s' }} />
                          </div>
                        )}
 
                        <div className={`rounded-full shadow-sm text-slate-700 p-1.5 transition duration-350 ${
                          isSelected 
                            ? "bg-sky-500 text-white scale-110 shadow-sky-500/20" 
                            : "bg-white/85 text-slate-700 transform group-hover/card:scale-115"
                        }`}>
                          {isSelected ? (
                            <Pause className="h-3 w-3" />
                          ) : (
                            <p.icon className={`h-3 w-3 ${p.color}`} />
                          )}
                        </div>
                      </div>
                      <p className={`mt-1.5 text-[9px] leading-normal font-extrabold line-clamp-2 transition break-all duration-300 ${
                        isSelected 
                          ? "text-sky-600 font-bold" 
                          : "text-slate-600 group-hover/card:text-sky-600"
                      }`}>
                        {isSelected && <span className="mr-0.5 text-sky-500">▶ </span>}
                        {p.title}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
 
          </main>
        </div>
 
        {/* Bottom Audio Player Bar */}
        <div className="h-14 bg-white border-t border-slate-200 px-3 sm:px-4 flex items-center justify-between">
          
          {/* Active Album cover and track details */}
          <div className="flex items-center gap-1.5 sm:gap-2 max-w-[90px] xs:max-w-[170px] min-w-0">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-gradient-to-br from-indigo-500 via-sky-400 to-emerald-400 relative overflow-hidden shadow-inner flex items-center justify-center flex-none">
              <Disc className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-white/90 animate-spin-slow" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-800 truncate leading-tight">Hanabi (烟火)</p>
              <p className="text-[8px] text-slate-400 font-semibold truncate mt-0.5">Sharman Rock</p>
            </div>
            <div className="hidden xs:flex gap-1 flex-none ml-1">
              <Heart className="h-3 w-3 text-slate-400 hover:text-red-500 transition cursor-pointer" />
            </div>
          </div>
 
          {/* Central Play/pause controllers */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-all duration-300 transform -scale-x-100 hover:scale-110 active:scale-90 animate-none" aria-label="上一首">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-3.5 sm:w-3.5" viewBox="0 0 24 24">
                <path d="M0 0h24v24H0z" fill="none" />
                <path fill="currentColor" d="M5 7.766c0-1.554 1.696-2.515 3.029-1.715l7.056 4.234c1.295.777 1.295 2.653 0 3.43L8.03 17.949c-1.333.8-3.029-.16-3.029-1.715zM14.056 12L7 7.766v8.468zM18 6a1 1 0 0 1 1 1v10a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1" />
              </svg>
            </button>
            <button className="flex h-6.5 w-6.5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-slate-800 text-white shadow-md hover:bg-sky-600 transition hover:scale-105" aria-label="播放">
              <Play className="h-2.5 w-2.5 sm:h-3 sm:w-3 fill-current ml-0.5" />
            </button>
            <button className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-all duration-300 hover:scale-110 active:scale-90 animate-none" aria-label="下一首">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-3.5 sm:w-3.5" viewBox="0 0 24 24">
                <path d="M0 0h24v24H0z" fill="none" />
                <path fill="currentColor" d="M5 7.766c0-1.554 1.696-2.515 3.029-1.715l7.056 4.234c1.295.777 1.295 2.653 0 3.43L8.03 17.949c-1.333.8-3.029-.16-3.029-1.715zM14.056 12L7 7.766v8.468zM18 6a1 1 0 0 1 1 1v10a1 1 0 1 1-2 0V7a1 1 0 0 1 1-1" />
              </svg>
            </button>
            <button className="hidden sm:block text-slate-400 hover:text-slate-800 transition" aria-label="下载本地">
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
 
          {/* Right Status Information */}
          <div className="hidden sm:flex items-center gap-2">
            <span className="rounded bg-sky-50 px-1 py-0.5 text-[8px] font-black text-sky-600 tracking-wider">AUTO</span>
            <span className="text-[9px] font-mono text-slate-400 font-bold">00:00/00:00</span>
            <div className="hidden sm:flex items-center gap-2 ml-2 border-l border-slate-100 pl-2">
              <Volume2 className="h-3 w-3 text-slate-400" />
              <Repeat className="h-3 w-3 text-slate-400" />
            </div>
          </div>
 
        </div>

      </div>
    </div>
  );
}

export default function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-4xl" aria-label="PisaMusic 手机与桌面界面真实模拟">
      {/* Immersive radial glow backing to ground the mockups like an advertisements banner */}
      <div className="absolute -inset-10 rounded-[50px] bg-gradient-to-r from-sky-400/10 via-indigo-400/5 to-transparent blur-3xl pointer-events-none" aria-hidden="true" />
      
      {/* Float design layout */}
      <div className="float-soft relative flex flex-col items-center justify-center px-2 py-6 sm:px-4">
        
        {/* Main Desktop Player App Preview - hidden on mobile, visible on sm and up */}
        <div className="w-full z-10 transition duration-500 hover:scale-[1.008] hidden sm:block">
          <DesktopMockup />
        </div>

        {/* Android App overlaps on bottom right on screens sm and up, and is shown dynamically centered in place of desktop on mobile */}
        <div className="block sm:absolute sm:-bottom-10 sm:right-4 lg:-right-6 z-20">
          <AndroidMockup />
        </div>
      </div>
    </div>
  );
}
