import type { UpdateFormDraft } from "../../types/config";
import { Switch } from "../ui/Switch";
import { glassInputClasses } from "../../constants/theme";

type Props = {
  draft: UpdateFormDraft;
  isNew: boolean;
  themeColor: string;
  saving: boolean;
  uploadingPackage: boolean;
  uploadProgress: number | null;
  onClose: () => void;
  onChange: (next: UpdateFormDraft) => void;
  onUploadPackage: (file: File) => void;
  onSubmit: () => void;
};

export default function UpdateModal({ draft, isNew, themeColor, saving, uploadingPackage, uploadProgress, onClose, onChange, onUploadPackage, onSubmit }: Props) {
  const acceptTypes = draft.platform === "desktop" ? ".exe,.msi,.zip,.7z" : ".apk,.aab";
  const progress = uploadProgress == null ? null : Math.min(100, Math.max(0, Math.round(uploadProgress)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white/80 backdrop-blur-2xl rounded-3xl sm:rounded-[2rem] border border-white/60 shadow-2xl w-full max-w-3xl flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-hidden animate-fade-in-up"
        style={{ animationDuration: "0.2s" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5 border-b border-white/50 bg-white/30">
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center min-w-0">
            {isNew ? (
              <>
                <svg className="w-6 h-6 mr-2" style={{ color: themeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                发布新版本
              </>
            ) : (
              <>
                <svg className="w-6 h-6 mr-2" style={{ color: themeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                编辑版本
              </>
            )}
          </h3>
          <button type="button" onClick={onClose} className="p-2 bg-white/50 rounded-full hover:bg-white text-slate-500 transition-colors shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 no-scrollbar">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">发布平台</label>
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-white/60 bg-white/40 p-2 shadow-sm">
              {[
                { key: "android" as const, label: "Android" },
                { key: "desktop" as const, label: "PC 版" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...draft,
                      platform: item.key,
                      platformLabel: item.key === "desktop" ? "PC 版" : "Android",
                      available: item.key === "android" ? true : draft.available,
                      downloadUrl: item.key === draft.platform ? draft.downloadUrl : "",
                      fileSizeText: item.key === draft.platform ? draft.fileSizeText : "",
                      releaseFileId: item.key === draft.platform ? draft.releaseFileId : undefined,
                    })
                  }
                  className={`rounded-xl px-4 py-3 text-sm font-extrabold transition-all ${
                    draft.platform === item.key ? "text-white shadow-sm" : "bg-white/60 text-slate-600 hover:bg-white"
                  }`}
                  style={draft.platform === item.key ? { backgroundColor: themeColor } : undefined}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {progress !== null && (
              <div className="mt-4 rounded-xl border border-white/60 bg-white/50 p-3">
                <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>{progress >= 100 ? "上传完成" : "上传进度"}</span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${progress}%`, backgroundColor: themeColor }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">版本号 (Version)</label>
              <input
                type="text"
                value={draft.version}
                onChange={(e) => onChange({ ...draft, version: e.target.value })}
                className={glassInputClasses + " font-bold"}
                placeholder="例如: v2.1.2"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">发布时间 (Time)</label>
              <input
                type="datetime-local"
                value={draft.updateTime.replace(" ", "T")}
                onChange={(e) => onChange({ ...draft, updateTime: e.target.value.replace("T", " ") })}
                className={glassInputClasses + " font-mono cursor-pointer"}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">平台显示名</label>
              <input
                type="text"
                value={draft.platformLabel}
                onChange={(e) => onChange({ ...draft, platformLabel: e.target.value })}
                className={glassInputClasses}
                placeholder="Android / PC 版"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">安装包大小</label>
              <input
                type="text"
                value={draft.fileSizeText}
                onChange={(e) => onChange({ ...draft, fileSizeText: e.target.value })}
                className={glassInputClasses}
                placeholder="例如: 26.7MB"
              />
            </div>
          </div>

          <div className="flex items-center justify-between bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 shadow-sm">
            <span className="text-sm font-bold text-slate-700">
              强制更新 (Force Update){" "}
              <span className="text-[10px] font-normal text-slate-400 block mt-0.5">开启后用户必须更新才能继续使用APP</span>
            </span>
            <Switch checked={draft.forceUpdate} onChange={(val) => onChange({ ...draft, forceUpdate: val })} themeColor={themeColor} />
          </div>

          <div className="flex items-center justify-between bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/60 shadow-sm">
            <span className="text-sm font-bold text-slate-700">
              开放下载{" "}
              <span className="text-[10px] font-normal text-slate-400 block mt-0.5">关闭后官网会显示“即将开放”，PC 版可先不填下载地址。</span>
            </span>
            <Switch
              checked={draft.available}
              onChange={(val) => onChange({ ...draft, available: val || draft.platform === "android" })}
              themeColor={themeColor}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">直接下载地址 (Download URL)</label>
            <input
              type="text"
              value={draft.downloadUrl}
              onChange={(e) => onChange({ ...draft, downloadUrl: e.target.value, releaseFileId: undefined })}
              className={glassInputClasses + " font-mono"}
              placeholder={draft.platform === "desktop" ? "EXE/MSI/ZIP 直链，可暂时留空" : "APK直链"}
            />
          </div>

          <div className="rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-700">上传安装包到七牛云</p>
                <p className="mt-1 text-xs text-slate-400">
                  {draft.platform === "desktop" ? "支持 .exe / .msi / .zip / .7z，上传成功后自动填入下载地址。" : "支持 .apk / .aab，上传成功后自动填入下载地址。"}
                </p>
                {draft.releaseFileId && <p className="mt-2 text-xs font-bold text-emerald-600">已关联七牛安装包，发布后可在历史记录中删除。</p>}
              </div>
              <label
                className={`relative inline-flex shrink-0 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity ${
                  uploadingPackage || saving ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:opacity-90"
                }`}
                style={{ backgroundColor: themeColor }}
              >
                {uploadingPackage ? "上传中…" : "选择文件上传"}
                <input
                  type="file"
                  accept={acceptTypes}
                  disabled={uploadingPackage || saving}
                  className="absolute inset-0 opacity-0 disabled:cursor-not-allowed"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (file) onUploadPackage(file);
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">官网引导地址 (Official URL)</label>
            <input
              type="text"
              value={draft.officialUrl}
              onChange={(e) => onChange({ ...draft, officialUrl: e.target.value })}
              className={glassInputClasses + " font-mono"}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">更新日志内容 (使用分号分隔)</label>
            <textarea
              rows={4}
              value={draft.updateContent}
              onChange={(e) => onChange({ ...draft, updateContent: e.target.value })}
              className="w-full rounded-2xl border border-white/60 bg-white/50 px-5 py-4 text-sm text-slate-700 focus:bg-white/80 focus:outline-none focus:ring-2 focus:ring-slate-400/20 font-mono shadow-inner transition-all resize-y"
              placeholder="例如: 1, 修复闪退bug; 2, 优化播放体验"
            />
          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-white/50 bg-white/30 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:space-x-4 sm:gap-0">
          <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-white/60 transition-colors shadow-sm border border-white/50">
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            className="px-8 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "提交中…" : "保存并发布"}
          </button>
        </div>
      </div>
    </div>
  );
}
