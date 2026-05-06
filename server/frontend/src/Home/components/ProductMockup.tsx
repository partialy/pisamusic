import { Download, Heart, ListMusic, Pause, Search } from "lucide-react";
import { sourcePills } from "../../data/siteContent";

export default function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[min(340px,calc(100vw-32px))] sm:max-w-[440px] lg:max-w-[520px]" aria-label="PisaMusic 应用界面预览">
      <div className="absolute -inset-4 rounded-[38px] bg-[#27B8F4]/15 blur-2xl sm:-inset-5 sm:rounded-[42px]" aria-hidden="true" />
      <div className="float-soft relative rounded-[34px] border border-slate-900/10 bg-slate-950 p-2.5 shadow-glow sm:rounded-[40px] sm:p-3">
        <div className="overflow-hidden rounded-[27px] bg-white sm:rounded-[32px]">
          <div className="flex items-center justify-between px-4 py-4 sm:px-5 sm:py-5">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-slate-400 sm:text-xs">Pisa Music</p>
              <p className="mt-1 text-xl font-black text-pisa-ink sm:text-2xl">今日推荐</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 sm:h-11 sm:w-11">
              <Search className="h-5 w-5 text-slate-600" aria-hidden="true" />
            </div>
          </div>

          <div className="flex gap-2 overflow-hidden px-4 sm:gap-3 sm:px-5">
            <img className="h-28 w-28 flex-none rounded-lg object-cover shadow-panel sm:h-36 sm:w-36" src="/assets/card-guess.png" alt="猜你喜欢推荐卡片" />
            <img className="h-28 w-28 flex-none rounded-lg object-cover shadow-panel sm:h-36 sm:w-36" src="/assets/card-daily.png" alt="每日推荐卡片" />
            <img className="h-28 w-28 flex-none rounded-lg object-cover shadow-panel sm:h-36 sm:w-36" src="/assets/card-radar.png" alt="雷达歌单卡片" />
          </div>

          <div className="px-4 pb-4 pt-5 sm:px-5 sm:pb-5 sm:pt-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {sourcePills.map((source) => (
                <span key={source.label} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${source.color}`}>
                  {source.image ? <img className="h-4 w-4" src={source.image} alt="" /> : null}
                  {source.label}
                </span>
              ))}
            </div>

            <div className="rounded-lg bg-slate-950 p-4 text-white">
              <div className="mb-7 flex items-center justify-between sm:mb-8">
                <div>
                  <p className="text-sm font-black">正在播放</p>
                  <p className="mt-1 text-xs text-white/55">夜航曲 · PisaMusic Mix</p>
                </div>
                <div className="flex gap-1.5">
                  <Heart className="h-5 w-5 text-rose-300" aria-hidden="true" />
                  <Download className="h-5 w-5 text-sky-300" aria-hidden="true" />
                  <ListMusic className="h-5 w-5 text-white/70" aria-hidden="true" />
                </div>
              </div>

              <div className="space-y-3 text-center">
                <p className="text-xs text-white/45 sm:text-sm">When the city turns blue</p>
                <p className="text-base font-black text-white sm:text-lg">把夜晚调成自己的节拍</p>
                <p className="text-xs text-white/45 sm:text-sm">Keep the loop, keep the glow</p>
              </div>

              <div className="mt-7 flex items-center justify-center sm:mt-8">
                <button className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg sm:h-14 sm:w-14" aria-label="暂停预览">
                  <Pause className="h-5 w-5 fill-current sm:h-6 sm:w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
