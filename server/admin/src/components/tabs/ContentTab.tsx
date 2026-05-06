import type { AppConfigJson } from "../../types/config";
import { HtmlEditor } from "../ui/HtmlEditor";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";

type Props = {
  config: AppConfigJson;
  themeColor: string;
  dirty: boolean;
  saving: boolean;
  updateSection: <K extends keyof AppConfigJson, F extends keyof AppConfigJson[K]>(
    section: K,
    field: F,
    value: AppConfigJson[K][F],
  ) => void;
  onSave: () => void;
};

export default function ContentTab({ config, themeColor, dirty, saving, updateSection, onSave }: Props) {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className={`rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${
            dirty && !saving
              ? "bg-slate-900 text-white shadow-[0_8px_20px_rgba(15,23,42,0.22)] hover:-translate-y-0.5 hover:bg-slate-800"
              : "cursor-not-allowed border border-white/60 bg-white/50 text-slate-400"
          }`}
        >
          {saving ? "Saving..." : "Save Content"}
        </button>
      </div>

      <div className={glassCardClasses}>
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-6 sm:mb-8 flex items-center">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-cyan-500 text-white flex items-center justify-center mr-4 shadow-lg shadow-cyan-500/30">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          服务协议 (Agreement)
        </h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">标题</label>
            <input
              type="text"
              value={config.agreement.title}
              onChange={(e) => updateSection("agreement", "title", e.target.value)}
              className={glassInputClasses}
            />
          </div>
          <HtmlEditor
            label="HTML 内容"
            value={config.agreement.content}
            onChange={(val) => updateSection("agreement", "content", val)}
            themeColor={themeColor}
          />
        </div>
      </div>

      <div className={glassCardClasses}>
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-6 sm:mb-8 flex items-center">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-400 to-orange-500 text-white flex items-center justify-center mr-4 shadow-lg shadow-rose-500/30">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          隐私政策 (Privacy)
        </h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">标题</label>
            <input
              type="text"
              value={config.privacy.title}
              onChange={(e) => updateSection("privacy", "title", e.target.value)}
              className={glassInputClasses}
            />
          </div>
          <HtmlEditor
            label="HTML 内容"
            value={config.privacy.content}
            onChange={(val) => updateSection("privacy", "content", val)}
            themeColor={themeColor}
          />
        </div>
      </div>

      <div className={glassCardClasses}>
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-6 sm:mb-8 flex items-center">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-400 to-purple-500 text-white flex items-center justify-center mr-4 shadow-lg shadow-purple-500/30">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          关于我们 (About)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">应用名称</label>
            <input
              type="text"
              value={config.about.appName}
              onChange={(e) => updateSection("about", "appName", e.target.value)}
              className={glassInputClasses}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">团队名称</label>
            <input
              type="text"
              value={config.about.team}
              onChange={(e) => updateSection("about", "team", e.target.value)}
              className={glassInputClasses}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">官网标签 (Label)</label>
            <input
              type="text"
              value={config.about.websiteLabel}
              onChange={(e) => updateSection("about", "websiteLabel", e.target.value)}
              className={glassInputClasses}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">官网链接 (URL)</label>
            <input
              type="text"
              value={config.about.websiteUrl}
              onChange={(e) => updateSection("about", "websiteUrl", e.target.value)}
              className={glassInputClasses}
            />
          </div>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">应用描述</label>
          <textarea
            rows={3}
            value={config.about.description}
            onChange={(e) => updateSection("about", "description", e.target.value)}
            className="w-full rounded-2xl border border-white/60 bg-white/50 px-5 py-4 text-sm text-slate-700 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-slate-400/20 shadow-inner transition-all resize-y"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">版权信息</label>
          <input
            type="text"
            value={config.about.copyright}
            onChange={(e) => updateSection("about", "copyright", e.target.value)}
            className={glassInputClasses}
          />
        </div>
      </div>
    </div>
  );
}
