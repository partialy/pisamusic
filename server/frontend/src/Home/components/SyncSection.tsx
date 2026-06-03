import SectionHeader from "../../common/SectionHeader";
import { syncFeatures } from "../../data/siteContent";

export default function SyncSection() {
  return (
    <section id="sync" className="relative overflow-hidden bg-gradient-to-b from-[#fbfcff] via-white to-sky-50/20 py-24 text-slate-900 sm:py-32 border-t border-slate-100/80">
      {/* Soft elegant background sky-glow overlay */}
      <div className="absolute left-1/2 top-0 h-[500px] w-full max-w-7xl -translate-x-1/2 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.06)_0%,_transparent_65%)] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="rise-in flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            eyebrow="云端为桥"
            title="以云为桥，让两端的陪伴温柔交织。"
            desc="当脚步从嘈杂的街头步入静谧的书房，音轨无需重新寻找。PisaMusic 通过云端轻盈渡引，将你钟爱的旋律与不经意的红心，在掌心与桌面无缝衔接。不必费心同步，随心而动，让属于你的私享乐章如水流般温润贯通。"
            tone="light"
          />
          <div className="rise-in rounded-3xl border border-sky-100/85 bg-gradient-to-br from-sky-50/60 to-white/90 p-6 sm:p-8 max-w-xl shrink-0 shadow-xl shadow-sky-100/20 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-600">呼吸之间 温柔相连</p>
            </div>
            <h4 className="mt-2 text-base font-bold text-slate-800 tracking-tight">去繁留简，不惊扰片刻</h4>
            <p className="mt-3 text-sm leading-8 text-slate-600 font-medium">
              我们只轻手抚平云端的数据：仅为您同步心爱的红心旋律与珍藏歌单。至于那些世俗的偏好设置、繁冗的本地路径与多余缓存，均被妥善留存于各自的设备中。克制而体贴，只为您留存一席明澈而轻盈的听序净土。
            </p>
          </div>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-3 lg:gap-8 lg:mt-16">
          {syncFeatures.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rise-in group relative overflow-hidden rounded-[2rem] border border-slate-150/40 bg-white p-6 shadow-[0_12px_40px_rgba(148,163,184,0.04)] hover:border-sky-200 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(14,165,233,0.06)] transition-all duration-500 md:p-8"
                style={{ transitionDelay: `${index * 70}ms` }}
              >
                {/* Micro accent corner flash hover glow */}
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-sky-100/20 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500" />

                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110 ${item.accent} shadow-sm`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 tracking-tight sm:text-xl group-hover:text-sky-600 transition-colors duration-300">
                  {item.title}
                </h3>
                
                <p className="mt-3.5 text-sm leading-8 text-slate-500 font-medium">
                  {item.desc}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
