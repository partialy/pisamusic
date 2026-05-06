import SectionHeader from "../../common/SectionHeader";
import { featureItems } from "../../data/siteContent";

export default function FeatureSection() {
  return (
    <section id="features" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="rise-in">
          <SectionHeader
            eyebrow="What it feels like"
            title="从想听，到开始播放，中间少一点阻力。"
            desc="PisaMusic 适合那些经常搜索、收藏、整理歌单，也在意歌词和下载体验的人。它不喧闹，不抢戏，只把高频听歌动作做得更顺手。"
            align="center"
          />
        </div>

        <div className="mt-10 grid gap-3 sm:mt-14 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {featureItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rise-in group rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-sky-200 hover:shadow-panel sm:p-6"
                style={{ transitionDelay: `${80 + index * 55}ms` }}
              >
                <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-lg sm:mb-6 sm:h-12 sm:w-12 ${item.accent}`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-black text-pisa-ink sm:text-xl">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.desc}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
