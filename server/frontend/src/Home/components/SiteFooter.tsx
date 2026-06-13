import { useRef, useState } from "react";
import LegalDialog from "./LegalDialog";
import type { LegalPageKind } from "../../api/content";

type LegalTarget = {
  kind: LegalPageKind;
  title: string;
  requestId: number;
};

export default function SiteFooter() {
  const [legal, setLegal] = useState<LegalTarget | null>(null);
  const legalRequestId = useRef(0);

  const openLegal = (kind: LegalPageKind, title: string) => {
    legalRequestId.current += 1;
    setLegal({ kind, title, requestId: legalRequestId.current });
  };

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
            <button
              type="button"
              className="cursor-pointer font-semibold text-slate-500 transition duration-300 hover:text-sky-600"
              onClick={() => openLegal("service-agreement", "用户协议")}
            >
              用户协议
            </button>
            <button
              type="button"
              className="cursor-pointer font-semibold text-slate-500 transition duration-300 hover:text-sky-600"
              onClick={() => openLegal("privacy-policy", "隐私政策")}
            >
              隐私政策
            </button>
            <a className="hover:text-sky-600 transition duration-300" href="https://pisamusic.partialy.cn">
              pisamusic.partialy.cn
            </a>
          </div>
          <p className="text-center text-[11px] font-medium text-slate-400 md:text-right">
            Copyright © 2026 PisaMusic. All rights reserved.
          </p>
        </div>
      </div>

      {legal && (
        <LegalDialog
          kind={legal.kind}
          fallbackTitle={legal.title}
          requestId={legal.requestId}
          onClose={() => setLegal(null)}
        />
      )}
    </footer>
  );
}
