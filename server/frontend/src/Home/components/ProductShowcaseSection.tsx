import SectionHeader from "../../common/SectionHeader";
import { androidProduct, desktopHighlights, desktopProduct } from "../../data/siteContent";

function ProductPanel({ product, dark = false }: { product: typeof androidProduct; dark?: boolean }) {
  const Icon = product.icon;
  return (
    <article className={`rise-in relative overflow-hidden rounded-[2rem] border p-6 sm:p-10 transition-all duration-500 hover:-translate-y-1 ${
      dark 
        ? "border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-[0_20px_50px_rgba(15,23,42,0.3)] hover:shadow-[0_30px_60px_rgba(15,23,42,0.45)]" 
        : "border-slate-100 bg-white text-slate-900 shadow-[0_20px_50px_rgba(148,163,184,0.06)] hover:shadow-[0_30px_60px_rgba(148,163,184,0.12)]"
    }`}>
      {/* Absolute decorative gradient glow inside card */}
      {dark && (
        <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />
      )}
      {!dark && (
        <div className="absolute -right-16 -top-16 h-36 w-36 rounded-full bg-sky-100/30 blur-2xl pointer-events-none" />
      )}

      <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl transition duration-300 ${
        dark ? "bg-sky-400 text-slate-950 shadow-lg shadow-sky-400/10" : "bg-sky-50 text-sky-600 border border-sky-100/50"
      }`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>

      <p className={`text-xs font-bold uppercase tracking-[0.2em] ${dark ? "text-sky-400" : "text-sky-600"}`}>{product.label}</p>
      
      <h3 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{product.title}</h3>
      
      <p className={`mt-4 text-sm leading-8 ${dark ? "text-slate-300/90" : "text-slate-600"}`}>{product.desc}</p>
      
      <div className="mt-8 flex flex-wrap gap-2.5">
        {product.points.map((point) => (
          <span 
            key={point} 
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
              dark 
                ? "bg-slate-800/60 text-sky-300 border border-slate-700/80" 
                : "bg-sky-50/50 text-sky-700 border border-sky-100/30"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${dark ? "bg-sky-400" : "bg-sky-500"}`} />
            {point}
          </span>
        ))}
      </div>
    </article>
  );
}

export default function ProductShowcaseSection() {
  return (
    <section id="products" className="bg-[#fbfcff] py-20 sm:py-28 border-t border-slate-100/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="rise-in">
          <SectionHeader
            eyebrow="双端一体"
            title="手机是随身的唱片盒，电脑是私人的音乐书房。"
            desc="PisaMusic 不再只是一款 Android 应用。如今，它以「Android 随身版」与「PisaMusic 桌面版」共同构成你的音乐入口。两端各自独立，又通过云端跨屏互通。"
            align="center"
          />
        </div>

        <div className="mt-12 grid gap-6 sm:mt-16 lg:grid-cols-2 lg:gap-8">
          <ProductPanel product={androidProduct} />
          <ProductPanel product={desktopProduct} dark />
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {desktopHighlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rise-in group relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_10px_35px_rgba(148,163,184,0.04)] transition-all duration-500 hover:-translate-y-1.5 hover:border-sky-200/50 hover:shadow-[0_22px_45px_rgba(14,165,233,0.06)] md:p-7"
                style={{ transitionDelay: `${index * 45}ms` }}
              >
                {/* Visual Accent Corner Glow */}
                <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-sky-100/10 opacity-0 group-hover:opacity-100 blur-xl transition-all duration-500" />

                <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110 ${item.accent} shadow-sm`}>
                  <Icon className="h-5.5 w-5.5" aria-hidden="true" />
                </div>

                <h4 className="text-base font-bold text-slate-800 tracking-tight group-hover:text-sky-700 transition duration-300">
                  {item.title}
                </h4>

                <p className="mt-2 text-xs leading-relaxed text-slate-500 font-medium">
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
