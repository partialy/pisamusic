import type { DynamicConfigItem, DynamicConfigType } from "../../types/config";
import { glassInputClasses } from "../../constants/theme";

type Props = {
  editing: DynamicConfigItem;
  isNew: boolean;
  themeColor: string;
  saving: boolean;
  onClose: () => void;
  onChange: (next: DynamicConfigItem) => void;
  onSave: () => void;
};

const TYPE_OPTIONS: Array<{ value: DynamicConfigType; label: string; hint: string }> = [
  { value: "string", label: "字符串", hint: "通用文本配置" },
  { value: "number", label: "数字", hint: "保存为字符串，服务端校验为有限数值" },
  { value: "url", label: "URL", hint: "仅允许完整 http/https 链接" },
  { value: "html", label: "HTML 片段", hint: "适合公告片段或富文本片段" },
];

export default function DynamicConfigModal({ editing, isNew, themeColor, saving, onClose, onChange, onSave }: Props) {
  const selectedTypeOption = TYPE_OPTIONS.find((option) => option.value === editing.type);
  const contentPlaceholder =
    editing.type === "url"
      ? "https://example.com/path"
      : editing.type === "number"
        ? "例如：123 或 3.14"
        : editing.type === "html"
          ? "<div>可插入 HTML 片段</div>"
          : "请输入配置内容";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative mx-auto my-4 flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl backdrop-blur-2xl animate-fade-in-up sm:my-8 sm:max-h-[calc(100dvh-4rem)] sm:rounded-[2rem]"
        style={{ animationDuration: "0.2s" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/50 bg-white/30 px-4 py-4 sm:px-8 sm:py-5">
          <h3 className="min-w-0 text-lg font-extrabold text-slate-800 sm:text-xl">
            {isNew ? "新增动态配置" : "编辑动态配置"}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full bg-white/50 p-2 text-slate-500 shadow-sm transition-colors hover:bg-white">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-8">
          <div>
            <label className="mb-2 ml-1 block text-sm font-semibold text-slate-700">配置 ID</label>
            <input
              type="text"
              value={editing.id}
              disabled={!isNew}
              onChange={(e) => onChange({ ...editing, id: e.target.value })}
              className={`${glassInputClasses} ${isNew ? "font-mono" : "cursor-not-allowed bg-slate-100/70 font-mono text-slate-500"}`}
              placeholder="例如：homepage_notice"
            />
            <p className="mt-2 ml-1 text-xs text-slate-400">仅支持字母、数字、点号、下划线和短横线；编辑时不允许修改。</p>
          </div>

          <div>
            <label className="mb-2 ml-1 block text-sm font-semibold text-slate-700">配置类型</label>
            <select
              value={editing.type}
              onChange={(e) => onChange({ ...editing, type: e.target.value as DynamicConfigType })}
              className="h-11 w-full rounded-2xl border border-white/60 bg-white/50 px-4 text-sm text-slate-800 shadow-inner transition-all focus:bg-white/90 focus:outline-none focus:ring-2 focus:ring-slate-400/30"
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-2 ml-1 text-xs text-slate-400">{selectedTypeOption?.hint}</p>
          </div>

          <div className={editing.type === "html" ? "grid grid-cols-1 gap-6 xl:grid-cols-2" : undefined}>
            <div>
              <label className="mb-2 ml-1 block text-sm font-semibold text-slate-700">配置内容</label>
              <textarea
                rows={editing.type === "html" ? 14 : 8}
                value={editing.content}
                onChange={(e) => onChange({ ...editing, content: e.target.value })}
                className="w-full resize-y rounded-2xl border border-white/60 bg-white/50 px-5 py-4 text-sm text-slate-700 shadow-inner transition-all focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
                placeholder={contentPlaceholder}
              />
            </div>

            {editing.type === "html" && (
              <div className="min-h-0">
                <div className="mb-2 ml-1 flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-slate-700">HTML 预览</label>
                  <span className="text-xs text-slate-400">内容较长时可在预览区滚动</span>
                </div>
                <div className="max-h-[24rem] overflow-y-auto rounded-2xl border border-white/60 bg-white/70 p-5 shadow-inner">
                  {editing.content.trim() ? (
                    <div className="prose prose-sm max-w-none break-words text-slate-700" dangerouslySetInnerHTML={{ __html: editing.content }} />
                  ) : (
                    <div className="text-sm text-slate-400">输入 HTML 后会在这里实时预览。</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/50 bg-white/30 p-4 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-4 sm:p-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/50 px-6 py-3 font-bold text-slate-600 shadow-sm transition-colors hover:bg-white/60">
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            className="rounded-xl px-8 py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>
    </div>
  );
}
