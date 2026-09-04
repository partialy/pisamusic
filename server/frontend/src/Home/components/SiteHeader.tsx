import { Download, Headphones } from "lucide-react";
import { navItems } from "../../data/siteContent";

export default function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-100/40 bg-white/75 backdrop-blur-md select-none">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8 lg:px-10" aria-label="主导航">
        <a href="#top" className="flex items-center gap-2.5 group" aria-label="PisaMusic 首页">
          <img className="h-8 w-8 rounded-xl shadow-sm group-hover:scale-[1.03] transition-all duration-300" src="/assets/app-icon.png" alt="" />
          <span className="font-display text-base font-bold tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors duration-300">PisaMusic</span>
        </a>
        <div className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <a 
              key={item.href} 
              href={item.href} 
              className={`relative text-sm font-semibold transition-all duration-300 py-1.5 after:absolute after:bottom-0 after:left-1/2 after:h-[2px] after:w-0 after:bg-sky-400 after:transition-all after:duration-300 hover:after:w-full hover:after:left-0 ${
                item.href.includes("listen")
                  ? "text-sky-600 hover:text-sky-700"
                  : "text-slate-500 hover:text-sky-600"
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="#/listen"
            className="inline-flex h-9 text-xs items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50/80 px-3 sm:px-3.5 font-bold text-sky-700 shadow-sm hover:shadow-md hover:bg-sky-100 transition-all duration-300 hover:-translate-y-0.5"
          >
            <Headphones className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
            <span>在线收听</span>
          </a>
          <a
            href="#download"
            className="inline-flex h-9 text-xs items-center gap-1.5 rounded-full bg-slate-900 px-3 sm:px-4 font-bold text-white shadow-md hover:shadow-lg hover:shadow-sky-500/5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-800"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">客户端</span><span>下载</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
