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
  onView: (file: FileRecordInfo) => void;
  onDelete: (file: FileRecordInfo) => void;
};

export function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "-";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function formatDate(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

export function usageText(file: FileRecordInfo): string {
  return file.usageType === "desktop-update" ? "PC 自动更新文件" : "发布安装包";
}

function assetTypeText(file: FileRecordInfo): string {
  if (file.assetType === "installer") return "安装包";
  if (file.assetType === "latest-yml") return "latest.yml";
  if (file.assetType === "blockmap") return "blockmap";
  return file.assetType || "-";
}

export function referencesText(file: FileRecordInfo): string {
  return file.referencedBy.length ? file.referencedBy.join("、") : "无引用";
}

function statusBadge(file: FileRecordInfo) {
  const uploaded = file.status === "uploaded";
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold ${uploaded ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
      {uploaded ? "已上传" : "已删除"}
    </span>
  );
}

function versionText(file: FileRecordInfo): string {
  const values = [file.platform, file.version].filter(Boolean);
  return values.length ? values.join(" / ") : "-";
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
  onView,
  onDelete,
}: Props) {
  const pageEnd = Math.min(total, offset + limit);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className={glassCardClasses}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">文件管理</h2>
            <p className="mt-1 text-sm text-slate-500">管理七牛云文件记录、对象 key、发布引用和删除状态。</p>
          </div>
          <button type="button" onClick={onRefresh} className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: themeColor }}>
            刷新
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select className={glassInputClasses} value={filters.status} onChange={(e) => onFilterChange({ ...filters, status: e.target.value as FileFilters["status"] })}>
            <option value="uploaded">仅已上传</option>
            <option value="deleted">仅已删除</option>
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

      <div className={glassCardClasses}>
        {loading ? (
          <div className="py-8 text-center text-sm font-semibold text-slate-500">正在加载文件记录...</div>
        ) : files.length === 0 ? (
          <div className="py-8 text-center text-sm font-semibold text-slate-500">暂无文件记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase text-slate-500">
                  <th className="border-b border-slate-200/70 px-4 py-3">文件</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">用途</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">平台 / 版本</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">资源</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">大小</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">状态</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">引用</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">时间</th>
                  <th className="sticky right-0 z-10 border-b border-slate-200/70 bg-white/80 px-4 py-3 text-right backdrop-blur">操作</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} className="group transition-colors hover:bg-white/50">
                    <td className="max-w-[18rem] border-b border-slate-100/80 px-4 py-4">
                      <div className="truncate font-bold text-slate-800" title={file.fileName}>
                        {file.fileName || "-"}
                      </div>
                      <div className="mt-1 truncate font-mono text-xs text-slate-400" title={file.objectKey}>
                        {file.objectKey || "-"}
                      </div>
                    </td>
                    <td className="border-b border-slate-100/80 px-4 py-4 font-semibold text-slate-600">{usageText(file)}</td>
                    <td className="border-b border-slate-100/80 px-4 py-4 text-slate-600">{versionText(file)}</td>
                    <td className="border-b border-slate-100/80 px-4 py-4 text-slate-600">{assetTypeText(file)}</td>
                    <td className="border-b border-slate-100/80 px-4 py-4 text-slate-600">{formatFileSize(file.fileSize)}</td>
                    <td className="border-b border-slate-100/80 px-4 py-4">{statusBadge(file)}</td>
                    <td className="max-w-[14rem] border-b border-slate-100/80 px-4 py-4 text-slate-600">
                      <div className="truncate" title={referencesText(file)}>
                        {referencesText(file)}
                      </div>
                    </td>
                    <td className="border-b border-slate-100/80 px-4 py-4 text-xs text-slate-500">
                      <div>上传：{formatDate(file.createdAt)}</div>
                      {file.deletedAt && <div className="mt-1">删除：{formatDate(file.deletedAt)}</div>}
                    </td>
                    <td className="sticky right-0 z-10 border-b border-slate-100/80 bg-white/80 px-4 py-4 backdrop-blur">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <button type="button" onClick={() => onView(file)} className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-white">
                          查看
                        </button>
                        <button
                          type="button"
                          disabled={file.status === "deleted" || deletingId === file.id}
                          onClick={() => onDelete(file)}
                          className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === file.id ? "删除中..." : "删除"}
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
