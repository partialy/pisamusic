import { Download } from "lucide-react";
import { navItems } from "../../data/siteContent";

export default function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/70 bg-white/80 backdrop-blur-2xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10" aria-label="主导航">
        <a href="#top" className="flex items-center gap-3" aria-label="PisaMusic 首页">
          <img className="h-9 w-9 rounded-lg shadow-sm" src="/assets/app-icon.png" alt="" />
          <span className="font-display text-lg font-black text-pisa-ink">PisaMusic</span>
        </a>
        <div className="hidden items-center gap-6 lg:flex">
          {navItems.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-bold text-slate-600 transition hover:text-pisa-blue">
              {item.label}
            </a>
          ))}
        </div>
        <a
          href="#download"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-pisa-ink px-4 text-sm font-extrabold text-white shadow-panel transition hover:-translate-y-0.5 hover:bg-slate-800"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          下载
        </a>
      </nav>
    </header>
  );
}
