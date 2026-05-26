import SectionHeader from "../../common/SectionHeader";
import { androidProduct, desktopHighlights, desktopProduct } from "../../data/siteContent";

function ProductPanel({ product, dark = false }: { product: typeof androidProduct; dark?: boolean }) {
  const Icon = product.icon;
  return (
    <article className={`rise-in rounded-lg border p-5 shadow-sm sm:p-6 ${dark ? "border-slate-800 bg-slate-950 text-white" : "border-slate-200 bg-white text-pisa-ink"}`}>
      <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg ${dark ? "bg-sky-400 text-slate-950" : "bg-sky-100 text-sky-700"}`}>
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className={`text-xs font-extrabold uppercase tracking-[0.22em] ${dark ? "text-sky-300" : "text-sky-600"}`}>{product.label}</p>
      <h3 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{product.title}</h3>
      <p className={`mt-4 text-sm leading-7 ${dark ? "text-white/66" : "text-slate-600"}`}>{product.desc}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        {product.points.map((point) => (
          <span key={point} className={`rounded-full px-3 py-1.5 text-xs font-black ${dark ? "bg-white/10 text-white/78" : "bg-slate-100 text-slate-600"}`}>
            {point}
          </span>
        ))}
      </div>
    </article>
  );
}

export default function ProductShowcaseSection() {
  return (
    <section id="products" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 lg:px-10">
        <div className="rise-in">
          <SectionHeader
            eyebrow="双端一体"
            title="手机是随身的唱片盒，电脑是私人的音乐书房。"
            desc="PisaMusic 不再只是一款 Android 应用。如今，它以「Android 随身版」与「PisaMusic 桌面版」共同构成你的音乐入口。两端各自独立，又通过云端悄然相连。"
            align="center"
          />
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <ProductPanel product={androidProduct} />
          <ProductPanel product={desktopProduct} dark />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {desktopHighlights.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.text}
                className="rise-in flex gap-3 rounded-lg border border-slate-200 bg-[#f8fcff] p-4"
                style={{ transitionDelay: `${index * 45}ms` }}
              >
                <Icon className="mt-0.5 h-5 w-5 flex-none text-pisa-blue" aria-hidden="true" />
                <p className="text-sm leading-7 text-slate-600">{item.text}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
