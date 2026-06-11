import { useEffect, useState } from "react";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";
import type {
  AdminFeedbackFilter,
  AdminFeedbackListItem,
  FeedbackStatus,
  FeedbackType,
} from "../../types/config";
import { FEEDBACK_TYPE_LABELS, formatFeedbackTime } from "../../utils/feedback";

type Props = {
  items: AdminFeedbackListItem[];
  total: number;
  offset: number;
  limit: number;
  filter: AdminFeedbackFilter;
  loading: boolean;
  updatingId: string | null;
  themeColor: string;
  onFilterChange: (filter: AdminFeedbackFilter) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onView: (item: AdminFeedbackListItem) => void;
  onStatusChange: (item: AdminFeedbackListItem, status: FeedbackStatus) => void;
};

function statusClasses(status: FeedbackStatus): string {
  return status === "processed"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
}

export default function FeedbackManagementTab({
  items,
  total,
  offset,
  limit,
  filter,
  loading,
  updatingId,
  themeColor,
  onFilterChange,
  onPageChange,
  onRefresh,
  onView,
  onStatusChange,
}: Props) {
  const [keyword, setKeyword] = useState(filter.keyword ?? "");
  const pageEnd = Math.min(total, offset + limit);

  useEffect(() => {
    setKeyword(filter.keyword ?? "");
  }, [filter.keyword]);

  const applyFilter = () => onFilterChange({ ...filter, keyword: keyword.trim() || undefined });
  const resetFilter = () => {
    setKeyword("");
    onFilterChange({});
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className={glassCardClasses}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">反馈管理</h2>
            <p className="mt-1 text-sm text-slate-500">查看用户反馈、附件和联系方式，并维护处理状态。</p>
          </div>
          <button type="button" onClick={onRefresh} className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: themeColor }}>
            刷新
          </button>
        </div>

        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilter();
          }}
        >
          <select
            className={glassInputClasses}
            value={filter.status ?? ""}
            onChange={(event) => onFilterChange({ ...filter, status: (event.target.value || undefined) as FeedbackStatus | undefined })}
          >
            <option value="">全部状态</option>
            <option value="pending">待处理</option>
            <option value="processed">已处理</option>
          </select>
          <select
            className={glassInputClasses}
            value={filter.type ?? ""}
            onChange={(event) => onFilterChange({ ...filter, type: (event.target.value || undefined) as FeedbackType | undefined })}
          >
            <option value="">全部类型</option>
            {Object.entries(FEEDBACK_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input className={glassInputClasses} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索反馈 ID、描述或联系方式" />
          <button type="submit" className="rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: themeColor }}>查询</button>
          <button type="button" onClick={resetFilter} className="rounded-2xl border border-white/60 bg-white/60 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-white">重置</button>
        </form>
      </div>

      <div className={glassCardClasses}>
        {loading ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500">正在加载反馈...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500">暂无符合条件的反馈</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs font-bold text-slate-500">
                  <th className="border-b border-slate-200/70 px-4 py-3">图片</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">类型</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">反馈内容</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">联系方式</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">提交时间</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">状态</th>
                  <th className="sticky right-0 border-b border-slate-200/70 bg-white/80 px-4 py-3 text-right backdrop-blur">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-white/50">
                    <td className="border-b border-slate-100/80 px-4 py-4">
                      <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/70 bg-slate-100">
                        {item.firstImageUrl ? <img src={item.firstImageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">无图</div>}
                        {item.imageCount > 0 && <span className="absolute bottom-0 right-0 rounded-tl-lg bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{item.imageCount}</span>}
                      </div>
                    </td>
                    <td className="border-b border-slate-100/80 px-4 py-4"><span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{FEEDBACK_TYPE_LABELS[item.feedbackType]}</span></td>
                    <td className="max-w-[26rem] border-b border-slate-100/80 px-4 py-4">
                      <button type="button" onClick={() => onView(item)} className="block w-full text-left">
                        <div className="line-clamp-2 font-semibold text-slate-700">{item.description}</div>
                        <div className="mt-1 truncate font-mono text-[11px] text-slate-400">{item.id}</div>
                      </button>
                    </td>
                    <td className="max-w-[14rem] border-b border-slate-100/80 px-4 py-4"><div className="truncate text-slate-600" title={item.contact ?? ""}>{item.contact || "-"}</div></td>
                    <td className="whitespace-nowrap border-b border-slate-100/80 px-4 py-4 text-xs text-slate-500">{formatFeedbackTime(item.createdAt)}</td>
                    <td className="border-b border-slate-100/80 px-4 py-4"><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${statusClasses(item.status)}`}>{item.status === "processed" ? "已处理" : "待处理"}</span></td>
                    <td className="sticky right-0 border-b border-slate-100/80 bg-white/80 px-4 py-4 backdrop-blur">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <button type="button" onClick={() => onView(item)} className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-white">详情</button>
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() => onStatusChange(item, item.status === "processed" ? "pending" : "processed")}
                          className="rounded-xl px-3 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
                          style={{ backgroundColor: item.status === "processed" ? "#f59e0b" : "#10b981" }}
                        >
                          {updatingId === item.id ? "更新中..." : item.status === "processed" ? "恢复待处理" : "标记已处理"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/50 p-4 text-sm font-bold text-slate-600">
        <span>{total === 0 ? "0" : `${offset + 1}-${pageEnd}`} / {total}</span>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl bg-white px-4 py-2 disabled:opacity-50" disabled={offset <= 0} onClick={() => onPageChange(Math.max(0, offset - limit))}>上一页</button>
          <button type="button" className="rounded-xl bg-white px-4 py-2 disabled:opacity-50" disabled={pageEnd >= total} onClick={() => onPageChange(offset + limit)}>下一页</button>
        </div>
      </div>
    </div>
  );
}
