import SectionHeader from "../../common/SectionHeader";
import { sharedFeatures } from "../../data/siteContent";

export default function FeatureSection() {
  return (
    <section id="features" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="rise-in">
          <SectionHeader
            eyebrow="使用感受"
            title="它用起来，是这样的感觉。"
            desc="搜索、播放、下载与整理，终于归于同一个入口。两端共享同一种产品气质：少些平台间的来回切换，多些稳定而从容的整理。移动端轻快如随笔，桌面端沉静如日记。"
            align="center"
          />
        </div>

        <div className="mt-10 grid gap-3 sm:mt-14 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {sharedFeatures.map((item, index) => {
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
