import SectionHeader from "../../common/SectionHeader";
import { syncFeatures } from "../../data/siteContent";

export default function SyncSection() {
  return (
    <section id="sync" className="bg-[#101828] py-20 text-white sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="rise-in flex flex-col lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            eyebrow="云端为桥"
            title="跨端同步，云端为桥。"
            desc="两端不直接触碰彼此的本地世界，一切同步交由云端悄然完成。手机与桌面端的收藏、歌单，由云端统一承载；以同步码绑定个人空间，经授权、增量合并与版本协调，各自的空间始终清楚。"
            tone="dark"
          />
          <div className="mt-6 lg:mt-0 rise-in rounded-lg border border-sky-300/20 bg-sky-300/10 p-5 max-w-xl shrink-0">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-300">同步范围</p>
            <p className="mt-3 text-sm leading-7 text-white/72">
              仅同步稳定的核心数据：收藏歌曲、收藏歌单、自建歌单及其曲目。播放链接、本地路径、歌词正文与本地封面，不作为跨端数据推送。
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:gap-5 lg:mt-12">
          {syncFeatures.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rise-in rounded-lg border border-white/10 bg-white/[0.07] p-5 sm:p-6"
                style={{ transitionDelay: `${index * 70}ms` }}
              >
                <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-lg ${item.accent}`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-black">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/68">{item.desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
