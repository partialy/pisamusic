import { useState } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  label: string;
  themeColor: string;
};

export function HtmlEditor({ value, onChange, label, themeColor }: Props) {
  const [isPreview, setIsPreview] = useState(false);
  return (
    <div className="flex flex-col space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="block text-sm font-semibold text-slate-700">{label}</label>
        <div className="flex bg-white/40 backdrop-blur-md rounded-xl p-1 border border-white/50">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            style={!isPreview ? { color: themeColor } : {}}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${!isPreview ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            代码
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            style={isPreview ? { color: themeColor } : {}}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${isPreview ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            预览
          </button>
        </div>
      </div>
      {isPreview ? (
        <div
          className="w-full min-h-[140px] rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md p-4 sm:p-5 text-sm text-slate-700 overflow-y-auto shadow-inner"
          dangerouslySetInnerHTML={{ __html: value || '<span class="text-gray-400">暂无内容</span>' }}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          className="w-full min-w-0 rounded-2xl border border-white/60 bg-white/50 px-4 sm:px-5 py-4 text-sm text-slate-700 focus:border-slate-400 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-slate-400/20 font-mono shadow-inner transition-all resize-y"
        />
      )}
    </div>
  );
}
