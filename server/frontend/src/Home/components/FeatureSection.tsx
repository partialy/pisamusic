import SectionHeader from "../../common/SectionHeader";
import { sharedFeatures } from "../../data/siteContent";

export default function FeatureSection() {
  return (
    <section id="features" className="bg-white py-20 sm:py-28 border-t border-slate-100/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="rise-in">
          <SectionHeader
            eyebrow="听觉温度"
            title="万籁交融，皆在指尖流淌得恰如其分。"
            desc="寻词、览曲、裁切与收纳，繁琐的交互终于复归单纯。两端共享同一种优雅、笃定而本真的设计风骨。少了几分在平台缝隙里辗转的局促，多了几缕温润持久的抚慰。移动端随性洒脱如随笔，桌面版沉静扎实如长记。"
            align="center"
          />
        </div>

        <div className="mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {sharedFeatures.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rise-in group relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_10px_35px_rgba(148,163,184,0.05)] transition-all duration-500 hover:-translate-y-1.5 hover:border-sky-100 hover:shadow-[0_25px_50px_rgba(14,165,233,0.08)] sm:p-8"
                style={{ transitionDelay: `${80 + index * 55}ms` }}
              >
                {/* Visual Accent Corner Glow */}
                <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-sky-100/10 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500" />

                <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110 ${item.accent} shadow-sm`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                
                <h3 className="text-lg font-bold text-slate-800 tracking-tight sm:text-xl group-hover:text-sky-700 transition duration-300">
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
