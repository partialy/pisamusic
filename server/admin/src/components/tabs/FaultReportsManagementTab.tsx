import { useCallback, useEffect, useState } from "react";
import { fetchAdminFaultReports } from "../../api/client";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";
import type { AdminFaultReportFilter, AdminFaultReportListItem, FaultReportStatus } from "../../types/config";
import { FAULT_REPORT_SCENE_LABELS, FAULT_REPORT_STATUS_LABELS, formatFaultReportTime } from "../../utils/faultReports";

const LIMIT = 20;

type Props = {
  themeColor: string;
  onView: (id: string) => void;
  refreshKey?: number;
};

export default function FaultReportsManagementTab({ themeColor, onView, refreshKey }: Props) {
  const [items, setItems] = useState<AdminFaultReportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<AdminFaultReportFilter>({});
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchAdminFaultReports({ ...filter, offset, limit: LIMIT });
      setItems(result.items);
      setTotal(result.total);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "故障上报读取失败");
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const updateFilter = (next: AdminFaultReportFilter) => {
    setFilter(next);
    setOffset(0);
  };

  const pageEnd = Math.min(total, offset + LIMIT);
  return (
    <div className="space-y-6 animate-fade-in-up">
      <section className={glassCardClasses}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-2xl font-extrabold text-slate-800">故障上报</h2><p className="mt-1 text-sm text-slate-500">查看播放地址请求与播放器失败诊断，维护处理状态。</p></div>
          <button type="button" onClick={() => void load()} className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white" style={{ backgroundColor: themeColor }}>刷新</button>
        </div>
        <form className="grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_minmax(0,1fr)_auto_auto]" onSubmit={(event) => { event.preventDefault(); updateFilter({ ...filter, keyword: keyword.trim() || undefined }); }}>
          <select className={glassInputClasses} value={filter.status ?? ""} onChange={(event) => updateFilter({ ...filter, status: (event.target.value || undefined) as FaultReportStatus | undefined })}>
            <option value="">全部状态</option><option value="pending">待处理</option><option value="processed">已处理</option>
          </select>
          <select className={glassInputClasses} value={filter.scene ?? ""} onChange={(event) => updateFilter({ ...filter, scene: event.target.value === "play_url" ? "play_url" : undefined })}>
            <option value="">全部场景</option><option value="play_url">获取播放地址</option>
          </select>
          <input className={glassInputClasses} value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="报告 ID、用户 ID、版本、方法或歌曲 ID" />
          <button type="submit" className="rounded-2xl px-5 py-3 text-sm font-bold text-white" style={{ backgroundColor: themeColor }}>查询</button>
          <button type="button" className="rounded-2xl bg-white/70 px-5 py-3 text-sm font-bold text-slate-700" onClick={() => { setKeyword(""); updateFilter({}); }}>重置</button>
        </form>
        {error ? <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p> : null}
      </section>

      <section className={glassCardClasses}>
        {loading ? <div className="py-12 text-center text-sm font-semibold text-slate-500">正在加载...</div> : items.length === 0 ? <div className="py-12 text-center text-sm font-semibold text-slate-500">暂无故障上报</div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
            <thead><tr className="text-xs font-bold text-slate-500"><th className="px-4 py-3">场景</th><th className="px-4 py-3">用户</th><th className="px-4 py-3">App / 系统</th><th className="px-4 py-3">日志数</th><th className="px-4 py-3">提交时间</th><th className="px-4 py-3">状态</th><th className="px-4 py-3 text-right">操作</th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100 hover:bg-white/50">
              <td className="px-4 py-4"><span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{FAULT_REPORT_SCENE_LABELS[item.scene]}</span><div className="mt-1 max-w-40 truncate font-mono text-[11px] text-slate-400">{item.id}</div></td>
              <td className="px-4 py-4 font-mono text-xs text-slate-600">{item.userId || "匿名"}</td>
              <td className="px-4 py-4 text-slate-600">{item.appVersion} ({item.appVersionCode})<div className="text-xs text-slate-400">Android {item.osVersion} · {item.brand} {item.model}</div></td>
              <td className="px-4 py-4 font-bold text-slate-700">{item.logCount}</td><td className="px-4 py-4 text-xs text-slate-500">{formatFaultReportTime(item.createdAt)}</td>
              <td className="px-4 py-4"><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${item.status === "processed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{FAULT_REPORT_STATUS_LABELS[item.status]}</span></td>
              <td className="px-4 py-4 text-right"><button type="button" onClick={() => onView(item.id)} className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm">详情</button></td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>

      <div className="flex items-center justify-between rounded-2xl bg-white/50 p-4 text-sm font-bold text-slate-600"><span>{total === 0 ? "0" : `${offset + 1}-${pageEnd}`} / {total}</span><div className="flex gap-2"><button type="button" disabled={offset <= 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))} className="rounded-xl bg-white px-4 py-2 disabled:opacity-50">上一页</button><button type="button" disabled={pageEnd >= total} onClick={() => setOffset(offset + LIMIT)} className="rounded-xl bg-white px-4 py-2 disabled:opacity-50">下一页</button></div></div>
    </div>
  );
}
