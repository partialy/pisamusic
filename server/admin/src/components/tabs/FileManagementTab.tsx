import type { FileRecordInfo } from "../../types/config";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";

type FileFilters = {
  status: "uploaded" | "deleted" | "all";
  usageType: "release-package" | "desktop-update" | "all";
  keyword: string;
};

type Props = {
  files: FileRecordInfo[];
  total: number;
  offset: number;
  limit: number;
  filters: FileFilters;
  loading: boolean;
  deletingId: string | null;
  themeColor: string;
  onFilterChange: (filters: FileFilters) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onDelete: (file: FileRecordInfo) => void;
};

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "-";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatDate(ts: number): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function usageText(file: FileRecordInfo): string {
  if (file.usageType === "desktop-update") return `PC 自动更新 / ${file.assetType || "-"}`;
  return `发布安装包 / ${file.platform || "-"}`;
}

function statusBadge(file: FileRecordInfo) {
  const uploaded = file.status === "uploaded";
  return (
    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${uploaded ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-500"}`}>
      {uploaded ? "已上传" : "已删除"}
    </span>
  );
}

function referencesText(file: FileRecordInfo): string {
  return file.referencedBy.length ? file.referencedBy.join("、") : "-";
}

export default function FileManagementTab({
  files,
  total,
  offset,
  limit,
  filters,
  loading,
  deletingId,
  themeColor,
  onFilterChange,
  onPageChange,
  onRefresh,
  onDelete,
}: Props) {
  const pageEnd = Math.min(total, offset + limit);
  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className={glassCardClasses}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-800">文件管理</h3>
            <p className="mt-1 text-sm text-slate-500">统一查看七牛上传文件、引用版本和存储信息。</p>
          </div>
          <button type="button" onClick={onRefresh} className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: themeColor }}>
            刷新
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select className={glassInputClasses} value={filters.status} onChange={(e) => onFilterChange({ ...filters, status: e.target.value as FileFilters["status"] })}>
            <option value="uploaded">已上传</option>
            <option value="deleted">已删除</option>
            <option value="all">全部状态</option>
          </select>
          <select className={glassInputClasses} value={filters.usageType} onChange={(e) => onFilterChange({ ...filters, usageType: e.target.value as FileFilters["usageType"] })}>
            <option value="all">全部用途</option>
            <option value="release-package">发布安装包</option>
            <option value="desktop-update">PC 自动更新</option>
          </select>
          <input className={glassInputClasses} value={filters.keyword} onChange={(e) => onFilterChange({ ...filters, keyword: e.target.value })} placeholder="搜索文件名或七牛 key" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading && <div className={glassCardClasses}>加载中...</div>}
        {!loading && files.length === 0 && <div className={glassCardClasses}>暂无文件记录</div>}
        {!loading &&
          files.map((file) => (
            <div key={file.id} className={glassCardClasses}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h4 className="max-w-full truncate text-lg font-extrabold text-slate-800">{file.fileName}</h4>
                    {statusBadge(file)}
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <p>用途：{usageText(file)}</p>
                    <p>版本：{file.version || "-"}</p>
                    <p>大小：{formatFileSize(file.fileSize)}</p>
                    <p>上传时间：{formatDate(file.createdAt)}</p>
                    <p>引用：{referencesText(file)}</p>
                    <p>Provider：{file.provider}</p>
                  </div>
                  <p className="mt-3 break-all rounded-xl bg-white/50 p-3 font-mono text-xs text-slate-500">{file.objectKey}</p>
                </div>
                <button
                  type="button"
                  disabled={file.status === "deleted" || deletingId === file.id}
                  onClick={() => onDelete(file)}
                  className="shrink-0 rounded-xl bg-red-500 px-4 py-2 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deletingId === file.id ? "删除中" : "删除七牛文件"}
                </button>
              </div>
            </div>
          ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/50 p-4 text-sm font-bold text-slate-600">
        <span>
          {total === 0 ? "0" : `${offset + 1}-${pageEnd}`} / {total}
        </span>
        <div className="flex gap-2">
          <button className="rounded-xl bg-white px-4 py-2 disabled:opacity-50" disabled={offset <= 0} onClick={() => onPageChange(Math.max(0, offset - limit))}>
            上一页
          </button>
          <button className="rounded-xl bg-white px-4 py-2 disabled:opacity-50" disabled={pageEnd >= total} onClick={() => onPageChange(offset + limit)}>
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
