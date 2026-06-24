import { useEffect, useState } from "react";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";
import type { AdminShareFilter, AdminShareListItem, ShareType } from "../../types/config";
import { formatTimestamp } from "../../utils/date";
import { buildMusicShareWebLink } from "../../utils/shareLink";

type Props = {
  items: AdminShareListItem[];
  total: number;
  offset: number;
  limit: number;
  filter: AdminShareFilter;
  loading: boolean;
  invalidatingId: string | null;
  themeColor: string;
  onFilterChange: (filter: AdminShareFilter) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onInvalidate: (item: AdminShareListItem) => void;
};

const SHARE_TYPE_LABELS: Record<ShareType, string> = {
  song: "歌曲",
  playlist: "歌单",
};

function statusClasses(valid: boolean): string {
  return valid ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500";
}

function coverNode(item: AdminShareListItem) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-slate-100 shadow-sm">
      {item.coverUrl ? (
        <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[11px] font-bold text-slate-400">无封面</span>
      )}
    </div>
  );
}

export default function ShareManagementTab({
  items,
  total,
  offset,
  limit,
  filter,
  loading,
  invalidatingId,
  themeColor,
  onFilterChange,
  onPageChange,
  onRefresh,
  onInvalidate,
}: Props) {
  const [sharer, setSharer] = useState(filter.sharer ?? "");
  const [copiedUuid, setCopiedUuid] = useState<string | null>(null);
  const pageEnd = Math.min(total, offset + limit);

  useEffect(() => {
    setSharer(filter.sharer ?? "");
  }, [filter.sharer]);

  const applyFilter = () => onFilterChange({ ...filter, sharer: sharer.trim() || undefined });
  const resetFilter = () => {
    setSharer("");
    onFilterChange({ valid: "all" });
  };
  const copyShareLink = async (item: AdminShareListItem) => {
    try {
      await navigator.clipboard.writeText(buildMusicShareWebLink(item.uuid));
      setCopiedUuid(item.uuid);
      window.setTimeout(() => {
        setCopiedUuid((current) => (current === item.uuid ? null : current));
      }, 1800);
    } catch {
      window.alert("复制分享链接失败，请检查浏览器的剪贴板权限。");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className={glassCardClasses}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">分享管理</h2>
            <p className="mt-1 text-sm text-slate-500">查看歌曲和歌单分享记录、访问次数，并将不需要继续公开的分享标记失效。</p>
          </div>
          <button type="button" onClick={onRefresh} className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: themeColor }}>
            刷新
          </button>
        </div>

        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-[160px_160px_minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilter();
          }}
        >
          <select
            className={glassInputClasses}
            value={filter.type ?? ""}
            onChange={(event) => onFilterChange({ ...filter, type: (event.target.value || undefined) as ShareType | undefined })}
          >
            <option value="">全部类型</option>
            <option value="song">歌曲</option>
            <option value="playlist">歌单</option>
          </select>
          <select
            className={glassInputClasses}
            value={filter.valid ?? "all"}
            onChange={(event) => onFilterChange({ ...filter, valid: event.target.value as AdminShareFilter["valid"] })}
          >
            <option value="all">全部状态</option>
            <option value="true">有效</option>
            <option value="false">已失效</option>
          </select>
          <input
            className={glassInputClasses}
            value={sharer}
            onChange={(event) => setSharer(event.target.value)}
            placeholder="搜索分享人 ID、用户名或邮箱"
          />
          <button type="submit" className="rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: themeColor }}>
            查询
          </button>
          <button type="button" onClick={resetFilter} className="rounded-2xl border border-white/60 bg-white/60 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-white">
            重置
          </button>
        </form>
      </div>

      <div className={glassCardClasses}>
        {loading ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500">正在加载分享记录...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm font-semibold text-slate-500">暂无符合条件的分享记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs font-bold text-slate-500">
                  <th className="border-b border-slate-200/70 px-4 py-3">分享内容</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">类型</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">分享人</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">访问次数</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">创建时间</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">最近更新</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">状态</th>
                  <th className="sticky right-0 border-b border-slate-200/70 bg-white/80 px-4 py-3 text-right backdrop-blur">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.uuid} className="hover:bg-white/50">
                    <td className="border-b border-slate-100/80 px-4 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {coverNode(item)}
                        <div className="min-w-0">
                          <div className="truncate font-bold text-slate-800">{item.title || "未命名分享"}</div>
                          <div className="mt-1 line-clamp-1 max-w-[28rem] text-xs font-semibold text-slate-500">{item.description || `${item.source}:${item.sourceId}`}</div>
                          <div className="mt-1 truncate font-mono text-[11px] text-slate-400">{item.uuid}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-slate-100/80 px-4 py-4">
                      <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{SHARE_TYPE_LABELS[item.type]}</span>
                    </td>
                    <td className="border-b border-slate-100/80 px-4 py-4">
                      <div className="font-bold text-slate-700">{item.sharer.username || "-"}</div>
                      <div className="mt-1 font-mono text-[11px] text-slate-400">{item.sharer.id}</div>
                    </td>
                    <td className="border-b border-slate-100/80 px-4 py-4 font-mono font-bold text-slate-700">{item.accessCount}</td>
                    <td className="whitespace-nowrap border-b border-slate-100/80 px-4 py-4 text-xs text-slate-500">{formatTimestamp(item.createdAt)}</td>
                    <td className="whitespace-nowrap border-b border-slate-100/80 px-4 py-4 text-xs text-slate-500">{formatTimestamp(item.updatedAt)}</td>
                    <td className="border-b border-slate-100/80 px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`w-fit rounded-lg px-2.5 py-1 text-xs font-bold ${statusClasses(item.valid)}`}>{item.valid ? "有效" : "已失效"}</span>
                        {!item.valid && item.invalidatedAt && <span className="text-[11px] text-slate-400">{formatTimestamp(item.invalidatedAt)}</span>}
                      </div>
                    </td>
                    <td className="sticky right-0 border-b border-slate-100/80 bg-white/80 px-4 py-4 backdrop-blur">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <a
                          href={buildMusicShareWebLink(item.uuid)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 shadow-sm hover:bg-sky-100"
                        >
                          预览公开页
                        </a>
                        <button
                          type="button"
                          onClick={() => void copyShareLink(item)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
                        >
                          {copiedUuid === item.uuid ? "已复制" : "复制分享链接"}
                        </button>
                        <button
                          type="button"
                          disabled={!item.valid || invalidatingId === item.uuid}
                          onClick={() => onInvalidate(item)}
                          className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {invalidatingId === item.uuid ? "处理中..." : item.valid ? "标记失效" : "已失效"}
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
          <button type="button" className="rounded-xl bg-white px-4 py-2 disabled:opacity-50" disabled={offset <= 0} onClick={() => onPageChange(Math.max(0, offset - limit))}>
            上一页
          </button>
          <button type="button" className="rounded-xl bg-white px-4 py-2 disabled:opacity-50" disabled={pageEnd >= total} onClick={() => onPageChange(offset + limit)}>
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
