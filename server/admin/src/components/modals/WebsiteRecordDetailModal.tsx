import { glassInputClasses } from "../../constants/theme";
import type {
  AdminWebsiteDownloadDetail,
  AdminWebsiteVisitDetail,
} from "../../types/config";
import { formatTimestamp } from "../../utils/date";

type Props =
  | {
      recordType: "visit";
      record: AdminWebsiteVisitDetail;
      themeColor: string;
      onClose: () => void;
    }
  | {
      recordType: "download";
      record: AdminWebsiteDownloadDetail;
      themeColor: string;
      onClose: () => void;
    };

type DetailField = {
  label: string;
  value: string;
  multiline?: boolean;
};

function displayValue(value: string | number | null): string {
  if (value === null || value === "") return "-";
  return String(value);
}

function displayTime(timestamp: number): string {
  return `${formatTimestamp(timestamp)} (${timestamp})`;
}

function visitFields(record: AdminWebsiteVisitDetail): DetailField[] {
  return [
    { label: "记录 ID", value: record.id },
    { label: "访问日期", value: record.visitDay },
    { label: "访问时间", value: displayTime(record.createdAt) },
    { label: "IP 地址", value: displayValue(record.ipAddress) },
    { label: "访问路径", value: displayValue(record.path) },
    { label: "来源页面", value: displayValue(record.referrer), multiline: true },
    { label: "访客哈希", value: displayValue(record.visitorHash), multiline: true },
    { label: "语言", value: displayValue(record.language) },
    { label: "时区", value: displayValue(record.timezone) },
    { label: "屏幕宽度", value: String(record.screenWidth) },
    { label: "屏幕高度", value: String(record.screenHeight) },
    { label: "User-Agent", value: displayValue(record.userAgent), multiline: true },
  ];
}

function downloadFields(record: AdminWebsiteDownloadDetail): DetailField[] {
  return [
    { label: "记录 ID", value: record.id },
    { label: "下载日期", value: record.downloadDay },
    { label: "下载时间", value: displayTime(record.createdAt) },
    { label: "平台", value: record.platform === "desktop" ? "PC（desktop）" : "Android（android）" },
    { label: "版本", value: displayValue(record.version) },
    { label: "文件记录 ID", value: displayValue(record.fileRecordId), multiline: true },
    { label: "IP 地址", value: displayValue(record.ipAddress) },
    { label: "来源页面", value: displayValue(record.referrer), multiline: true },
    { label: "User-Agent", value: displayValue(record.userAgent), multiline: true },
  ];
}

function ReadOnlyField({ field }: { field: DetailField }) {
  if (field.multiline) {
    return (
      <label className="block md:col-span-2">
        <span className="mb-2 ml-1 block text-sm font-semibold text-slate-700">{field.label}</span>
        <textarea
          value={field.value}
          readOnly
          rows={field.label === "User-Agent" ? 4 : 3}
          className="w-full resize-y break-all rounded-2xl border border-white/60 bg-white/50 px-5 py-4 font-mono text-sm text-slate-700 shadow-inner focus:bg-white/80 focus:outline-none"
        />
      </label>
    );
  }
  return (
    <label className="block">
      <span className="mb-2 ml-1 block text-sm font-semibold text-slate-700">{field.label}</span>
      <input value={field.value} readOnly className={`${glassInputClasses} cursor-default font-mono text-slate-700`} />
    </label>
  );
}

export default function WebsiteRecordDetailModal(props: Props) {
  const fields = props.recordType === "visit" ? visitFields(props.record) : downloadFields(props.record);
  const title = props.recordType === "visit" ? "访问记录详情" : "下载记录详情";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={props.onClose} aria-hidden />
      <div className="relative mx-auto my-4 flex w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/85 shadow-2xl backdrop-blur-2xl animate-fade-in-up sm:my-8 sm:max-h-[calc(100dvh-4rem)]">
        <div className="flex items-center justify-between gap-3 border-b border-white/50 bg-white/30 px-5 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <h3 className="text-xl font-extrabold text-slate-800">{title}</h3>
            <p className="mt-1 truncate font-mono text-xs text-slate-400">{props.record.id}</p>
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full bg-white/60 p-2 text-slate-500 shadow-sm hover:bg-white" aria-label="关闭">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {fields.map((field) => <ReadOnlyField key={field.label} field={field} />)}
          </div>
        </div>

        <div className="flex justify-end border-t border-white/50 bg-white/30 p-5 sm:p-6">
          <button
            type="button"
            onClick={props.onClose}
            style={{ backgroundColor: props.themeColor, boxShadow: `0 10px 15px -3px ${props.themeColor}40` }}
            className="rounded-xl px-8 py-3 font-bold text-white transition-opacity hover:opacity-90"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
