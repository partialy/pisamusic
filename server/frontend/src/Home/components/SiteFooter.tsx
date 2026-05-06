export default function SiteFooter() {
  return (
    <footer className="rise-in border-t border-slate-200 bg-white py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
        <div className="flex items-center gap-3">
          <img className="h-10 w-10 rounded-lg" src="/assets/app-icon.png" alt="" />
          <div>
            <p className="font-display text-lg font-black text-pisa-ink">PisaMusic</p>
            <p className="text-sm text-slate-500">年轻、干净的安卓多音源音乐播放器。</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-center text-sm font-bold text-slate-500 md:justify-end md:text-right">
          <a className="hover:text-pisa-blue" href="/api/config/service-agreement">
            用户协议
          </a>
          <a className="hover:text-pisa-blue" href="/api/config/privacy-policy">
            隐私政策
          </a>
          <a className="hover:text-pisa-blue" href="https://pisamusic.partialy.cn">
            pisamusic.partialy.cn
          </a>
          <span className="w-full text-center md:w-auto">Copyright © 2026 PisaMusic</span>
        </div>
      </div>
    </footer>
  );
}
