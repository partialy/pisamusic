import type { Announcement } from "../../types/config";
import { Switch } from "../ui/Switch";
import { HtmlEditor } from "../ui/HtmlEditor";
import { glassInputClasses } from "../../constants/theme";

type Props = {
  editing: Announcement;
  isNew: boolean;
  themeColor: string;
  onClose: () => void;
  onChange: (next: Announcement) => void;
  onSave: () => void;
};

export default function NoticeModal({ editing, isNew, themeColor, onClose, onChange, onSave }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white/80 backdrop-blur-2xl rounded-3xl sm:rounded-[2rem] border border-white/60 shadow-2xl w-full max-w-3xl flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-hidden animate-fade-in-up"
        style={{ animationDuration: "0.2s" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5 border-b border-white/50 bg-white/30">
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center min-w-0">
            {isNew ? (
              <>
                <svg className="w-6 h-6 mr-2" style={{ color: themeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                发布新公告
              </>
            ) : (
              <>
                <svg className="w-6 h-6 mr-2" style={{ color: themeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                编辑公告
              </>
            )}
          </h3>
          <button type="button" onClick={onClose} className="p-2 bg-white/50 rounded-full hover:bg-white text-slate-500 transition-colors shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 no-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">发布人 (Publisher)</label>
              <input
                type="text"
                value={editing.publisher}
                onChange={(e) => onChange({ ...editing, publisher: e.target.value })}
                className={glassInputClasses}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">展示时间 (Time)</label>
              <input
                type="datetime-local"
                value={editing.time.replace(" ", "T")}
                onChange={(e) => onChange({ ...editing, time: e.target.value.replace("T", " ") })}
                className={glassInputClasses + " font-mono cursor-pointer"}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">确认按钮文案</label>
            <input
              type="text"
              value={editing.confirmText}
              onChange={(e) => onChange({ ...editing, confirmText: e.target.value })}
              className={glassInputClasses}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 shadow-sm">
              <span className="text-sm font-bold text-slate-700">
                每次都展示 <span className="text-[10px] font-normal text-slate-400 block mt-0.5">不依赖已读状态限制</span>
              </span>
              <Switch
                checked={Boolean(editing.showEveryTime)}
                onChange={(val) => onChange({ ...editing, showEveryTime: val })}
                themeColor={themeColor}
              />
            </div>
            <div className="flex items-center justify-between bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 shadow-sm">
              <span className="text-sm font-bold text-slate-700">
                展示前往按钮 <span className="text-[10px] font-normal text-slate-400 block mt-0.5">附带跳转外部链接功能</span>
              </span>
              <Switch
                checked={editing.showGotoButton}
                onChange={(val) => onChange({ ...editing, showGotoButton: val })}
                themeColor={themeColor}
              />
            </div>
          </div>

          {editing.showGotoButton && (
            <div className="animate-fade-in-up">
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">前往链接 (gotoUrl)</label>
              <input
                type="text"
                value={editing.gotoUrl ?? ""}
                onChange={(e) => onChange({ ...editing, gotoUrl: e.target.value })}
                className={glassInputClasses + " font-mono text-indigo-600 focus:ring-indigo-400/30"}
                placeholder="https://"
              />
            </div>
          )}

          <div>
            <HtmlEditor
              label="公告内容 (支持 HTML 富文本)"
              value={editing.content}
              onChange={(val) => onChange({ ...editing, content: val })}
              themeColor={themeColor}
            />
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-white/50 bg-white/30 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:space-x-4 sm:gap-0">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-white/60 transition-colors shadow-sm border border-white/50">
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            className="px-8 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-opacity"
          >
            保存公告
          </button>
        </div>
      </div>
    </div>
  );
}
