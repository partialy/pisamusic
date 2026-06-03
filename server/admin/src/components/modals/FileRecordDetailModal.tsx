import type { FileRecordInfo } from "../../types/config";
import { glassInputClasses } from "../../constants/theme";

type Props = {
  file: FileRecordInfo;
  themeColor: string;
  onClose: () => void;
};

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "-";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function formatDate(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

function usageText(file: FileRecordInfo): string {
  if (file.usageType === "desktop-update") return "PC 自动更新";
  return "发布安装包";
}

function statusText(file: FileRecordInfo): string {
  return file.status === "uploaded" ? "已上传" : "已删除";
}

function referencesText(file: FileRecordInfo): string {
  return file.referencedBy.length ? file.referencedBy.join("、") : "-";
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-2 ml-1 block text-sm font-semibold text-slate-700">{label}</span>
      <input type="text" value={value || "-"} readOnly className={`${glassInputClasses} cursor-default font-mono text-slate-700`} />
    </label>
  );
}

function ReadOnlyTextArea({ label, value, rows = 3 }: { label: string; value: string; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-2 ml-1 block text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        value={value || "-"}
        readOnly
        rows={rows}
        className="w-full resize-y break-all rounded-2xl border border-white/60 bg-white/50 px-5 py-4 font-mono text-sm text-slate-700 shadow-inner transition-all focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
      />
    </label>
  );
}

function ReadOnlyLinkField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-2 ml-1 block text-sm font-semibold text-slate-700">{label}</span>
      {value ? (
        <a
          href={value}
          target="_blank"
          rel="noreferrer"
          className="block break-all rounded-2xl border border-white/60 bg-white/50 px-5 py-4 font-mono text-sm text-sky-700 shadow-inner transition-colors hover:bg-white/80 hover:text-sky-900"
        >
          {value}
        </a>
      ) : (
        <div className="rounded-2xl border border-white/60 bg-white/50 px-5 py-4 font-mono text-sm text-slate-500 shadow-inner">-</div>
      )}
    </div>
  );
}

export default function FileRecordDetailModal({ file, themeColor, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative mx-auto my-4 flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl backdrop-blur-2xl animate-fade-in-up sm:my-8 sm:max-h-[calc(100dvh-4rem)] sm:rounded-[2rem]"
        style={{ animationDuration: "0.2s" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/50 bg-white/30 px-4 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-slate-800 sm:text-xl">文件详情</h3>
            <p className="mt-1 truncate text-sm text-slate-500">{file.fileName || file.id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/50 p-2 text-slate-500 shadow-sm transition-colors hover:bg-white" aria-label="关闭">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <ReadOnlyField label="ID" value={file.id} />
            <ReadOnlyField label="文件名" value={file.fileName} />
            <ReadOnlyField label="用途" value={usageText(file)} />
            <ReadOnlyField label="平台" value={file.platform} />
            <ReadOnlyField label="版本" value={file.version} />
            <ReadOnlyField label="资产类型" value={file.assetType} />
            <ReadOnlyField label="Provider" value={file.provider} />
            <ReadOnlyField label="Bucket" value={file.bucket} />
            <ReadOnlyField label="MIME" value={file.mimeType} />
            <ReadOnlyField label="文件大小" value={`${formatFileSize(file.fileSize)} (${file.fileSize || 0} bytes)`} />
            <ReadOnlyField label="状态" value={statusText(file)} />
            <ReadOnlyField label="上传时间" value={formatDate(file.createdAt)} />
            <ReadOnlyField label="删除时间" value={formatDate(file.deletedAt)} />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <ReadOnlyTextArea label="Object Key" value={file.objectKey} />
            <ReadOnlyTextArea label="Hash" value={file.hash} />
            <ReadOnlyLinkField label="链接地址" value={file.downloadUrl} />
            <ReadOnlyTextArea label="下载地址" value={file.downloadUrl} />
            <ReadOnlyTextArea label="引用" value={referencesText(file)} rows={4} />
          </div>
        </div>

        <div className="flex justify-end border-t border-white/50 bg-white/30 p-4 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            className="rounded-xl px-8 py-3 font-bold text-white transition-opacity hover:opacity-90"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
