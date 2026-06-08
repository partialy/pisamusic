import type { UpdateHistoryItem } from "../../types/config";
import { glassCardClasses } from "../../constants/theme";

type Props = {
  displayHistory: UpdateHistoryItem[];
  themeColor: string;
  onPublishNew: () => void;
  onEdit: (item: UpdateHistoryItem) => void;
  onDeletePackage: (item: UpdateHistoryItem) => void;
  deletingPackageHistoryId: string | null;
  onDeleteHistory: (item: UpdateHistoryItem) => void;
  deletingHistoryId: string | null;
};

function getFileSourceText(item: UpdateHistoryItem): string {
  if (item.releaseFile?.status === "uploaded") return "七牛上传";
  if (item.releaseFile?.status === "deleted") return "安装包已删除";
  if (item.downloadUrl) return "直链地址";
  return "未配置安装包";
}

export default function UpdateTab({
  displayHistory,
  themeColor,
  onPublishNew,
  onEdit,
  onDeletePackage,
  deletingPackageHistoryId,
  onDeleteHistory,
  deletingHistoryId,
}: Props) {
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-extrabold text-slate-800">版本发布与更新历史</h2>
        <button
          type="button"
          onClick={onPublishNew}
          style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
          className="flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:opacity-90 sm:justify-start"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          发布新版本
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {displayHistory.map((upd, index) => (
          <div key={upd.id} className={`${glassCardClasses} group flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
            <div className="min-w-0 flex-1 sm:pr-6">
              <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-700">{index === 0 ? "最新版本" : "历史版本"}</span>
                <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-extrabold text-sky-700">{upd.platform === "desktop" ? "PC 版" : "Android"}</span>
                <span className="text-lg font-bold text-slate-800">{upd.version}</span>
                <span className="flex items-center text-xs text-slate-400">
                  <svg className="mr-1 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {upd.updateTime}
                </span>
              </div>
              <p className="mt-1 truncate text-sm font-medium text-slate-500">日志：{upd.updateContent}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {upd.forceUpdate ? (
                  <span className="rounded-md border border-red-200 bg-red-100/80 px-2 py-1 text-[10px] font-bold text-red-600 shadow-sm">强制更新</span>
                ) : (
                  <span className="rounded-md border border-emerald-200 bg-emerald-100/80 px-2 py-1 text-[10px] font-bold text-emerald-600 shadow-sm">普通更新</span>
                )}
                <span className="rounded-md border border-white bg-white/80 px-2 py-1 text-[10px] font-bold text-slate-500 shadow-sm">{getFileSourceText(upd)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 transition-opacity sm:flex-row sm:gap-3 lg:opacity-0 lg:group-hover:opacity-100">
              <button type="button" onClick={() => onEdit(upd)} className="flex items-center justify-center rounded-xl border border-white bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-white">
                <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                编辑
              </button>
              {upd.releaseFile?.status === "uploaded" && (
                <button
                  type="button"
                  disabled={deletingPackageHistoryId === upd.id}
                  onClick={() => onDeletePackage(upd)}
                  className="flex items-center justify-center rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 shadow-sm transition-all hover:bg-red-100 disabled:opacity-50"
                >
                  <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  {deletingPackageHistoryId === upd.id ? "删除中..." : "删除安装包"}
                </button>
              )}
              <button
                type="button"
                disabled={index === 0 || deletingHistoryId === upd.id}
                title={index === 0 ? "最新版本不可删除" : "逻辑删除该版本记录"}
                onClick={() => {
                  if (index === 0) return;
                  if (typeof window !== "undefined" && !window.confirm("删除该版本历史？此操作为逻辑删除，可联系开发恢复。")) return;
                  onDeleteHistory(upd);
                }}
                className={`flex items-center justify-center rounded-xl border px-4 py-2 text-sm font-bold shadow-sm transition-all ${
                  index === 0
                    ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                    : "border-red-200 bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50"
                }`}
              >
                <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 6h18M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6h12z"
                  />
                </svg>
                {deletingHistoryId === upd.id ? "删除中..." : "删除版本"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {displayHistory.length === 0 && (
        <div className="rounded-3xl border border-white/60 bg-white/40 py-16 text-center shadow-inner backdrop-blur-md">
          <p className="font-bold text-slate-500">当前暂无版本记录，点击右上角发布</p>
        </div>
      )}
    </div>
  );
}
