import type { PisaAdminExport } from "../../types/config";

type Props = {
  exportData: PisaAdminExport;
  themeColor: string;
  onClose: () => void;
};

export default function JsonExportModal({ exportData, themeColor, onClose }: Props) {
  const text = JSON.stringify(exportData, null, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative bg-slate-900 rounded-3xl sm:rounded-[2rem] border border-slate-700 shadow-2xl w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col overflow-hidden animate-fade-in-up"
        style={{ animationDuration: "0.2s" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5 border-b border-slate-800 bg-slate-900">
          <h3 className="text-lg font-bold text-white flex items-center">
            <svg className="w-5 h-5 text-indigo-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            导出 JSON 配置
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 no-scrollbar">
          <pre className="text-[12px] sm:text-[13px] font-mono text-emerald-400 whitespace-pre-wrap break-words leading-relaxed">{text}</pre>
        </div>
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-900/80 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:space-x-4 sm:gap-0">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-slate-300 font-medium hover:bg-slate-800 transition-colors">
            关闭
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(text);
              alert("✅ JSON 配置已成功复制到剪贴板！");
            }}
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            className="px-8 py-3 rounded-xl text-white font-extrabold hover:opacity-90 transition-opacity"
          >
            复制全部
          </button>
        </div>
      </div>
    </div>
  );
}
