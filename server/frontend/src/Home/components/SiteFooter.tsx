export default function SiteFooter() {
  return (
    <footer className="rise-in border-t border-slate-100 bg-white py-12 select-none">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
        <div className="flex items-center gap-3.5">
          <img className="h-9 w-9 rounded-xl shadow-sm border border-slate-100" src="/assets/app-icon.png" alt="" />
          <div>
            <p className="font-display text-base font-bold tracking-tight text-slate-800">PisaMusic</p>
            <p className="text-xs text-slate-400 mt-1 font-medium">Android 随身版 & 桌面版 · 跨端无间同步</p>
          </div>
        </div>
        <div className="flex flex-col gap-4 md:items-end">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-center text-xs font-semibold text-slate-500 md:justify-end md:text-right">
            <a className="hover:text-sky-600 transition duration-300" href="mailto:pisamusic23@gmail.com" title="pisamusic23@gmail.com">
              联系邮箱
            </a>
            <a className="hover:text-sky-600 transition duration-300" href="/api/config/service-agreement">
              用户协议
            </a>
            <a className="hover:text-sky-600 transition duration-300" href="/api/config/privacy-policy">
              隐私政策
            </a>
            <a className="hover:text-sky-600 transition duration-300" href="https://pisamusic.partialy.cn">
              pisamusic.partialy.cn
            </a>
          </div>
          <p className="text-center text-[11px] font-medium text-slate-400 md:text-right">
            Copyright © 2026 PisaMusic. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
