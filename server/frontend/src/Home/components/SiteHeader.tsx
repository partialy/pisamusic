import { Download } from "lucide-react";
import { navItems } from "../../data/siteContent";

export default function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-100/40 bg-white/75 backdrop-blur-md select-none">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10" aria-label="主导航">
        <a href="#top" className="flex items-center gap-2.5 group" aria-label="PisaMusic 首页">
          <img className="h-8 w-8 rounded-xl shadow-sm group-hover:scale-[1.03] transition-all duration-300" src="/assets/app-icon.png" alt="" />
          <span className="font-display text-base font-bold tracking-tight text-slate-900 group-hover:text-sky-600 transition-colors duration-300">PisaMusic</span>
        </a>
        <div className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <a 
              key={item.href} 
              href={item.href} 
              className="relative text-sm font-semibold text-slate-500 transition-all duration-300 hover:text-sky-600 py-1.5 after:absolute after:bottom-0 after:left-1/2 after:h-[2px] after:w-0 after:bg-sky-400 after:transition-all after:duration-300 hover:after:w-full hover:after:left-0"
            >
              {item.label}
            </a>
          ))}
        </div>
        <a
          href="#download"
          className="inline-flex h-9 text-xs items-center gap-1.5 rounded-full bg-slate-900 px-4 font-bold text-white shadow-md hover:shadow-lg hover:shadow-sky-500/5 transition-all duration-300 hover:-translate-y-0.5 hover:bg-slate-800"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          <span>客户端下载</span>
        </a>
      </nav>
    </header>
  );
}
