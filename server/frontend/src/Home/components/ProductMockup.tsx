import { Download, Heart, ListMusic, Pause, Search, Settings } from "lucide-react";
import { sourcePills } from "../../data/siteContent";

function AndroidMockup() {
  return (
    <div className="relative w-[210px] rounded-[32px] border border-slate-900/10 bg-slate-950 p-2 shadow-glow sm:w-[250px] sm:rounded-[36px]">
      <div className="overflow-hidden rounded-[25px] bg-white sm:rounded-[29px]">
        <div className="flex items-center justify-between px-4 py-4">
          <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-400">随身版</p>
            <p className="mt-1 text-lg font-black text-pisa-ink">今日推荐</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100">
            <Search className="h-4 w-4 text-slate-600" aria-hidden="true" />
          </div>
        </div>

        <div className="flex gap-2 overflow-hidden px-4">
          <img className="h-24 w-24 flex-none rounded-lg object-cover shadow-panel" src="/assets/card-guess.png" alt="猜你喜欢推荐卡片" />
          <img className="h-24 w-24 flex-none rounded-lg object-cover shadow-panel" src="/assets/card-daily.png" alt="每日推荐卡片" />
        </div>

        <div className="px-4 pb-4 pt-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {sourcePills.map((source) => (
              <span key={source.label} className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-black ${source.color}`}>
                {source.image ? <img className="h-3.5 w-3.5" src={source.image} alt="" /> : null}
                {source.label}
              </span>
            ))}
          </div>

          <div className="rounded-lg bg-slate-950 p-4 text-white">
            <p className="text-xs font-black">正在播放</p>
            <p className="mt-1 text-[11px] text-white/55">夜航曲 · PisaMusic Mix</p>
            <div className="mt-5 space-y-2 text-center">
              <p className="text-[11px] text-white/45">When the city turns blue</p>
              <p className="text-sm font-black text-white">把夜晚调成自己的节拍</p>
              <p className="text-[11px] text-white/45">Keep the loop</p>
            </div>
            <div className="mt-5 flex items-center justify-center">
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg" aria-label="暂停预览">
                <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopMockup() {
  const menu = ["推荐", "歌单", "收藏", "我的", "本地与下载", "设置"];
  return (
    <div className="relative w-full min-w-[300px] max-w-[620px] rounded-[24px] border border-white/70 bg-white/80 p-2 shadow-panel backdrop-blur sm:rounded-[28px] sm:p-3">
      <div className="overflow-hidden rounded-[18px] border border-slate-200 bg-[#f6fbff] sm:rounded-[22px]">
        <div className="flex h-11 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-400" />
            <span className="h-3 w-3 rounded-full bg-amber-400" />
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">PisaMusic 桌面版</p>
        </div>
        <div className="grid min-h-[300px] grid-cols-[92px_1fr] sm:grid-cols-[132px_1fr]">
          <aside className="border-r border-slate-200 bg-white/86 p-3">
            <div className="mb-5 flex items-center gap-2">
              <img className="h-8 w-8 rounded-lg" src="/assets/app-icon.png" alt="" />
              <span className="hidden text-sm font-black text-pisa-ink sm:inline">PisaMusic</span>
            </div>
            <div className="space-y-1.5">
              {menu.map((item, index) => (
                <div
                  key={item}
                  className={`rounded-lg px-2.5 py-2 text-[11px] font-bold sm:text-xs ${index === 0 ? "bg-sky-100 text-sky-700" : "text-slate-500"}`}
                >
                  {item}
                </div>
              ))}
            </div>
          </aside>

          <section className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-400">音乐书房</p>
                <h3 className="mt-1 text-xl font-black text-pisa-ink sm:text-2xl">推荐与本地曲库</h3>
              </div>
              <div className="flex gap-2 text-slate-500">
                <Heart className="h-5 w-5" aria-hidden="true" />
                <Download className="h-5 w-5" aria-hidden="true" />
                <Settings className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <img className="aspect-square rounded-lg object-cover shadow-sm" src="/assets/card-radar.png" alt="雷达歌单卡" />
              <img className="aspect-square rounded-lg object-cover shadow-sm" src="/assets/playlist-focus.png" alt="专注歌单封面" />
              <img className="aspect-square rounded-lg object-cover shadow-sm" src="/assets/playlist-pop.png" alt="City Pop 歌单封面" />
            </div>

            <div className="mt-4 rounded-lg bg-slate-950 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black">桌面歌词</p>
                  <p className="mt-1 text-xs text-white/50">置顶透明 · 不必切回主界面</p>
                </div>
                <ListMusic className="h-5 w-5 text-sky-300" aria-hidden="true" />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="shine-line h-full w-[68%] rounded-full bg-pisa-blue" />
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ProductMockup() {
  return (
    <div className="relative mx-auto min-h-[420px] w-full max-w-[min(620px,calc(100vw-32px))]" aria-label="PisaMusic 手机与桌面界面预览">
      <div className="absolute -inset-4 rounded-[40px] bg-[#27B8F4]/12 blur-2xl" aria-hidden="true" />
      <div className="float-soft relative flex items-end justify-center pt-8">
        <div className="w-full">
          <DesktopMockup />
        </div>
        <div className="absolute -bottom-8 left-0 hidden sm:block lg:-left-8">
          <AndroidMockup />
        </div>
      </div>
    </div>
  );
}
