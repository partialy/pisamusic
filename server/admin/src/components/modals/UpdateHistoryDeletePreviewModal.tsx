import type { FileRecordInfo, UpdateHistoryDeletionPreview } from "../../types/config";

type Props = {
  preview: UpdateHistoryDeletionPreview;
  themeColor: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const ASSET_ORDER = ["installer", "latest-yml", "blockmap"];

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "-";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function assetTypeText(file: FileRecordInfo): string {
  if (file.assetType === "installer") return "安装包";
  if (file.assetType === "latest-yml") return "latest.yml";
  if (file.assetType === "blockmap") return "blockmap";
  return file.assetType || "其他文件";
}

function platformText(platform: string): string {
  if (platform === "desktop") return "PC";
  if (platform === "android") return "Android";
  return platform;
}

function statusText(file: FileRecordInfo): string {
  return file.status === "uploaded" ? "已上传" : "已删除";
}

function referencesText(file: FileRecordInfo): string {
  return file.referencedBy.length ? file.referencedBy.join("、") : "无引用";
}

function sortFiles(files: FileRecordInfo[]): FileRecordInfo[] {
  return [...files].sort((a, b) => {
    const aOrder = ASSET_ORDER.includes(a.assetType) ? ASSET_ORDER.indexOf(a.assetType) : ASSET_ORDER.length;
    const bOrder = ASSET_ORDER.includes(b.assetType) ? ASSET_ORDER.indexOf(b.assetType) : ASSET_ORDER.length;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.fileName.localeCompare(b.fileName);
  });
}

function FilePreviewRow({ file }: { file: FileRecordInfo }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/55 p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-extrabold text-sky-700">{assetTypeText(file)}</span>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{statusText(file)}</span>
            <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-slate-500">{formatFileSize(file.fileSize)}</span>
          </div>
          <p className="break-all font-mono text-sm font-bold text-slate-800">{file.fileName || file.id}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600">将删除</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 text-xs text-slate-600 md:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-1 font-bold text-slate-500">对象 key</p>
          <p className="break-all font-mono text-slate-700">{file.objectKey}</p>
        </div>
        <div className="min-w-0">
          <p className="mb-1 font-bold text-slate-500">关联引用</p>
          <p className="break-all text-slate-700">{referencesText(file)}</p>
        </div>
      </div>
    </div>
  );
}

export default function UpdateHistoryDeletePreviewModal({ preview, themeColor, deleting, onClose, onConfirm }: Props) {
  const files = sortFiles(preview.files);
  const { history } = preview;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={deleting ? undefined : onClose} aria-hidden />
      <div
        className="relative mx-auto my-4 flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/85 shadow-2xl backdrop-blur-2xl animate-fade-in-up sm:my-8 sm:max-h-[calc(100dvh-4rem)] sm:rounded-[2rem]"
        style={{ animationDuration: "0.2s" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/50 bg-white/30 px-4 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-slate-800 sm:text-xl">删除版本预览</h3>
            <p className="mt-1 text-sm text-slate-500">
              {platformText(history.platform)} {history.version} · {history.updateTime}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-full bg-white/50 p-2 text-slate-500 shadow-sm transition-colors hover:bg-white disabled:opacity-50"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-8">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
            <p className="font-extrabold">发布历史记录会被逻辑删除。</p>
            <p className="mt-1">
              {files.length > 0
                ? "下面列出的七牛对象会被删除，本地 file_records 会标记为 deleted，并同步清理关联引用。"
                : "该版本没有可删除的已上传文件，只会删除历史版本记录，不会删除七牛文件。"}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/60 bg-white/55 p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500">平台</p>
              <p className="mt-1 font-extrabold text-slate-800">{platformText(history.platform)}</p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/55 p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500">版本</p>
              <p className="mt-1 break-all font-mono font-extrabold text-slate-800">{history.version}</p>
            </div>
            <div className="rounded-2xl border border-white/60 bg-white/55 p-4 shadow-sm">
              <p className="text-xs font-bold text-slate-500">文件数量</p>
              <p className="mt-1 font-extrabold text-slate-800">{files.length}</p>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="text-sm font-extrabold text-slate-700">将删除的文件</h4>
              <span className="rounded-lg bg-white/70 px-2.5 py-1 text-xs font-bold text-slate-500">{files.length} 个</span>
            </div>
            {files.length > 0 ? (
              <div className="space-y-3">
                {files.map((file) => (
                  <FilePreviewRow key={file.id} file={file} />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/40 p-6 text-center text-sm font-bold text-slate-500">
                无关联七牛文件
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/50 bg-white/30 p-4 sm:flex-row sm:justify-end sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-xl border border-white/50 px-6 py-3 font-bold text-slate-600 shadow-sm transition-colors hover:bg-white/60 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-xl px-8 py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
          >
            {deleting ? "删除中..." : "确认删除版本及文件"}
          </button>
        </div>
      </div>
    </div>
  );
}
