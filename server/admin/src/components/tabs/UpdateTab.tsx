import type { UpdateHistoryItem } from "../../types/config";
import { glassCardClasses } from "../../constants/theme";

type Props = {
  displayHistory: UpdateHistoryItem[];
  themeColor: string;
  onPublishNew: () => void;
  onEdit: (item: UpdateHistoryItem) => void;
  onDeleteAttempt: () => void;
};

export default function UpdateTab({ displayHistory, themeColor, onPublishNew, onEdit, onDeleteAttempt }: Props) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-extrabold text-slate-800">版本发布与更新历史</h2>
        <button
          type="button"
          onClick={onPublishNew}
          style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
          className="text-white px-5 py-2.5 rounded-2xl text-sm font-bold transition-all hover:-translate-y-0.5 hover:opacity-90 flex items-center justify-center sm:justify-start"
        >
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          发布新版本
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {displayHistory.map((upd, index) => (
          <div key={upd.id} className={`${glassCardClasses} flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center group`}>
            <div className="flex-1 min-w-0 sm:pr-6">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                <span className="bg-amber-100 text-amber-700 text-xs font-extrabold px-2.5 py-1 rounded-lg">
                  {index === 0 ? "最新版本" : "历史版本"}
                </span>
                <span className="text-lg font-bold text-slate-800">{upd.version}</span>
                <span className="text-xs text-slate-400 flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {upd.updateTime}
                </span>
              </div>
              <p className="text-slate-500 text-sm font-medium truncate mt-1">日志: {upd.updateContent}</p>
              <div className="flex flex-wrap gap-3 mt-3">
                {upd.forceUpdate ? (
                  <span className="text-[10px] bg-red-100/80 border border-red-200 text-red-600 px-2 py-1 rounded-md font-bold shadow-sm">强制更新</span>
                ) : (
                  <span className="text-[10px] bg-emerald-100/80 border border-emerald-200 text-emerald-600 px-2 py-1 rounded-md font-bold shadow-sm">普通更新</span>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onEdit(upd)}
                className="bg-white/80 hover:bg-white text-slate-700 border border-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                编辑
              </button>
              <button
                type="button"
                onClick={onDeleteAttempt}
                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>

      {displayHistory.length === 0 && (
        <div className="text-center py-16 bg-white/40 backdrop-blur-md rounded-3xl border border-white/60 shadow-inner">
          <p className="text-slate-500 font-bold">当前暂无版本记录，点击右上角发布</p>
        </div>
      )}
    </div>
  );
}
