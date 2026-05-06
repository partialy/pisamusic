import SectionHeader from "../../common/SectionHeader";
import { experienceRows, playlistItems } from "../../data/siteContent";

export default function ExperienceSection() {
  return (
    <section id="experience" className="bg-[#101828] py-20 text-white sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:gap-12 lg:px-10">
        <div className="rise-in">
          <SectionHeader
            eyebrow="Listening mood"
            title="清爽的入口，保留听歌时该有的氛围。"
            desc="白天快速找歌，夜晚沉浸歌词，通勤时继续播放。PisaMusic 的界面不追求夸张装饰，而是让封面、歌词和队列自然成为你的听歌节奏。"
            tone="dark"
          />

          <div className="mt-8 grid gap-3 sm:mt-10">
            {experienceRows.map((row, index) => {
              const Icon = row.icon;
              return (
                <div
                  key={row.text}
                  className="rise-in flex gap-3 rounded-lg border border-white/10 bg-white/[0.06] p-4"
                  style={{ transitionDelay: `${index * 50}ms` }}
                >
                  <Icon className="mt-0.5 h-5 w-5 flex-none text-pisa-blue" aria-hidden="true" />
                  <p className="text-sm leading-7 text-white/74">{row.text}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <img className="rounded-lg border border-white/10 object-cover shadow-2xl" src="/assets/card-guess.png" alt="PisaMusic 猜你喜欢推荐卡" />
            <img className="rounded-lg border border-white/10 object-cover shadow-2xl" src="/assets/card-daily.png" alt="PisaMusic 每日推荐卡" />
            <img className="rounded-lg border border-white/10 object-cover shadow-2xl" src="/assets/card-radar.png" alt="PisaMusic 雷达歌单卡" />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {playlistItems.map((item, index) => (
              <article key={item.title} className={`rounded-lg border border-white/10 bg-white/[0.07] p-3 ${index === 3 ? "sm:hidden" : ""}`}>
                <img className="aspect-square w-full rounded-lg object-cover" src={item.image} alt={`${item.title} 歌单封面`} />
                <h3 className="mt-4 text-base font-black sm:text-lg">{item.title}</h3>
                <p className="mt-1 text-sm text-white/55">{item.desc}</p>
              </article>
            ))}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.07] p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-pisa-blue sm:text-sm">Now Playing</p>
            <div className="mt-5 grid gap-3 text-lg font-black sm:text-2xl">
              <p className="text-white/45">把噪声调低一点</p>
              <p>让旋律靠近一点</p>
              <p className="text-white/45">下一首，继续亮着</p>
            </div>
            <div className="mt-6 flex items-center justify-between text-xs font-black tracking-[0.12em] text-white/45 sm:text-sm">
              <span>2:33</span>
              <span>5:20</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="shine-line h-full w-[64%] rounded-full bg-pisa-blue" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
