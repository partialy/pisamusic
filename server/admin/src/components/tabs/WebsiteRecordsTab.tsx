import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAdminWebsiteDownloadDetail,
  fetchAdminWebsiteDownloadRecords,
  fetchAdminWebsiteVisitDetail,
  fetchAdminWebsiteVisitRecords,
} from "../../api/client";
import { glassCardClasses } from "../../constants/theme";
import type {
  AdminWebsiteDownloadDetail,
  AdminWebsiteDownloadListItem,
  AdminWebsiteVisitDetail,
  AdminWebsiteVisitListItem,
  WebsiteRecordType,
} from "../../types/config";
import { formatTimestamp } from "../../utils/date";
import WebsiteRecordDetailModal from "../modals/WebsiteRecordDetailModal";

type Props = {
  themeColor: string;
};

type RecordOffsets = Record<WebsiteRecordType, number>;

const PAGE_LIMIT = 20;

function shortText(value: string, fallback = "-"): string {
  return value.trim() || fallback;
}

function VisitRows({
  items,
  detailLoadingId,
  onView,
}: {
  items: AdminWebsiteVisitListItem[];
  detailLoadingId: string | null;
  onView: (id: string) => void;
}) {
  return (
    <table className="w-full min-w-[1120px] border-separate border-spacing-0 text-left text-sm">
      <thead>
        <tr className="text-xs font-bold text-slate-500">
          {['访问日期', '访问路径', '来源页面', 'IP 地址', '语言 / 分辨率', '访问时间'].map((label) => <th key={label} className="border-b border-slate-200/70 px-4 py-3">{label}</th>)}
          <th className="sticky right-0 border-b border-slate-200/70 bg-white/80 px-4 py-3 text-right backdrop-blur">操作</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="hover:bg-white/50">
            <td className="whitespace-nowrap border-b border-slate-100/80 px-4 py-4 font-bold text-slate-700">{item.visitDay}</td>
            <td className="max-w-[18rem] border-b border-slate-100/80 px-4 py-4"><div className="truncate font-mono text-xs text-slate-700" title={item.path}>{shortText(item.path, "/")}</div></td>
            <td className="max-w-[19rem] border-b border-slate-100/80 px-4 py-4"><div className="truncate text-xs text-slate-500" title={item.referrer}>{shortText(item.referrer)}</div></td>
            <td className="whitespace-nowrap border-b border-slate-100/80 px-4 py-4 font-mono text-xs text-slate-600">{shortText(item.ipAddress)}</td>
            <td className="whitespace-nowrap border-b border-slate-100/80 px-4 py-4 text-xs text-slate-500">{shortText(item.language)} · {item.screenWidth}×{item.screenHeight}</td>
            <td className="whitespace-nowrap border-b border-slate-100/80 px-4 py-4 text-xs text-slate-500">{formatTimestamp(item.createdAt)}</td>
            <td className="sticky right-0 border-b border-slate-100/80 bg-white/80 px-4 py-4 text-right backdrop-blur">
              <button type="button" disabled={detailLoadingId === item.id} onClick={() => onView(item.id)} className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-white disabled:opacity-50">
                {detailLoadingId === item.id ? "加载中..." : "详情"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DownloadRows({
  items,
  detailLoadingId,
  onView,
}: {
  items: AdminWebsiteDownloadListItem[];
  detailLoadingId: string | null;
  onView: (id: string) => void;
}) {
  return (
    <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
      <thead>
        <tr className="text-xs font-bold text-slate-500">
          {['下载日期', '平台', '版本', '文件记录 ID', 'IP 地址', '下载时间'].map((label) => <th key={label} className="border-b border-slate-200/70 px-4 py-3">{label}</th>)}
          <th className="sticky right-0 border-b border-slate-200/70 bg-white/80 px-4 py-3 text-right backdrop-blur">操作</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="hover:bg-white/50">
            <td className="whitespace-nowrap border-b border-slate-100/80 px-4 py-4 font-bold text-slate-700">{item.downloadDay}</td>
            <td className="border-b border-slate-100/80 px-4 py-4"><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${item.platform === "desktop" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>{item.platform === "desktop" ? "PC" : "Android"}</span></td>
            <td className="whitespace-nowrap border-b border-slate-100/80 px-4 py-4 font-mono text-xs text-slate-700">{shortText(item.version)}</td>
            <td className="max-w-[18rem] border-b border-slate-100/80 px-4 py-4"><div className="truncate font-mono text-xs text-slate-500" title={item.fileRecordId ?? ""}>{shortText(item.fileRecordId ?? "")}</div></td>
            <td className="whitespace-nowrap border-b border-slate-100/80 px-4 py-4 font-mono text-xs text-slate-600">{shortText(item.ipAddress)}</td>
            <td className="whitespace-nowrap border-b border-slate-100/80 px-4 py-4 text-xs text-slate-500">{formatTimestamp(item.createdAt)}</td>
            <td className="sticky right-0 border-b border-slate-100/80 bg-white/80 px-4 py-4 text-right backdrop-blur">
              <button type="button" disabled={detailLoadingId === item.id} onClick={() => onView(item.id)} className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-white disabled:opacity-50">
                {detailLoadingId === item.id ? "加载中..." : "详情"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function WebsiteRecordsTab({ themeColor }: Props) {
  const [recordType, setRecordType] = useState<WebsiteRecordType>("visit");
  const [offsets, setOffsets] = useState<RecordOffsets>({ visit: 0, download: 0 });
  const [visitItems, setVisitItems] = useState<AdminWebsiteVisitListItem[]>([]);
  const [downloadItems, setDownloadItems] = useState<AdminWebsiteDownloadListItem[]>([]);
  const [totals, setTotals] = useState<RecordOffsets>({ visit: 0, download: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [visitDetail, setVisitDetail] = useState<AdminWebsiteVisitDetail | null>(null);
  const [downloadDetail, setDownloadDetail] = useState<AdminWebsiteDownloadDetail | null>(null);
  const requestIdRef = useRef(0);

  const offset = offsets[recordType];
  const total = totals[recordType];
  const itemCount = recordType === "visit" ? visitItems.length : downloadItems.length;
  const pageEnd = Math.min(total, offset + PAGE_LIMIT);

  const loadRecords = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      if (recordType === "visit") {
        const data = await fetchAdminWebsiteVisitRecords(offsets.visit, PAGE_LIMIT);
        if (requestId !== requestIdRef.current) return;
        setVisitItems(data.items);
        setTotals((current) => ({ ...current, visit: data.total }));
      } else {
        const data = await fetchAdminWebsiteDownloadRecords(offsets.download, PAGE_LIMIT);
        if (requestId !== requestIdRef.current) return;
        setDownloadItems(data.items);
        setTotals((current) => ({ ...current, download: data.total }));
      }
    } catch (reason) {
      if (requestId !== requestIdRef.current) return;
      setError(reason instanceof Error ? reason.message : "官网记录加载失败");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [offsets.download, offsets.visit, recordType]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const changePage = (nextOffset: number) => {
    setOffsets((current) => ({ ...current, [recordType]: nextOffset }));
  };

  const openDetail = async (id: string) => {
    setDetailLoadingId(id);
    try {
      if (recordType === "visit") setVisitDetail(await fetchAdminWebsiteVisitDetail(id));
      else setDownloadDetail(await fetchAdminWebsiteDownloadDetail(id));
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : "记录详情加载失败");
    } finally {
      setDetailLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className={glassCardClasses}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">官网记录</h2>
            <p className="mt-1 text-sm text-slate-500">查看官网独立访问与安装包下载记录，详情中包含浏览器和来源等完整字段。</p>
          </div>
          <button type="button" onClick={() => void loadRecords()} disabled={loading} className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50" style={{ backgroundColor: themeColor }}>
            {loading ? "刷新中..." : "刷新"}
          </button>
        </div>
        <div className="mt-6 inline-flex rounded-2xl border border-white/70 bg-white/45 p-1.5 shadow-inner">
          {([{ id: "visit", label: "访问记录" }, { id: "download", label: "下载记录" }] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={recordType === tab.id}
              onClick={() => setRecordType(tab.id)}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${recordType === tab.id ? "text-white shadow-sm" : "text-slate-500 hover:bg-white/70 hover:text-slate-800"}`}
              style={recordType === tab.id ? { backgroundColor: themeColor } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className={glassCardClasses}>
        {loading ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500">正在加载{recordType === "visit" ? "访问" : "下载"}记录...</div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm font-semibold text-rose-600">{error}</p>
            <button type="button" onClick={() => void loadRecords()} className="mt-4 rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: themeColor }}>重试</button>
          </div>
        ) : itemCount === 0 ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500">暂无{recordType === "visit" ? "访问" : "下载"}记录</div>
        ) : (
          <div className="overflow-x-auto">
            {recordType === "visit" ? (
              <VisitRows items={visitItems} detailLoadingId={detailLoadingId} onView={(id) => void openDetail(id)} />
            ) : (
              <DownloadRows items={downloadItems} detailLoadingId={detailLoadingId} onView={(id) => void openDetail(id)} />
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/50 p-4 text-sm font-bold text-slate-600">
        <span>{total === 0 ? "0" : `${offset + 1}-${pageEnd}`} / {total}</span>
        <div className="flex gap-2">
          <button type="button" className="rounded-xl bg-white px-4 py-2 disabled:opacity-50" disabled={loading || offset <= 0} onClick={() => changePage(Math.max(0, offset - PAGE_LIMIT))}>上一页</button>
          <button type="button" className="rounded-xl bg-white px-4 py-2 disabled:opacity-50" disabled={loading || pageEnd >= total} onClick={() => changePage(offset + PAGE_LIMIT)}>下一页</button>
        </div>
      </div>

      {visitDetail && <WebsiteRecordDetailModal recordType="visit" record={visitDetail} themeColor={themeColor} onClose={() => setVisitDetail(null)} />}
      {downloadDetail && <WebsiteRecordDetailModal recordType="download" record={downloadDetail} themeColor={themeColor} onClose={() => setDownloadDetail(null)} />}
    </div>
  );
}
