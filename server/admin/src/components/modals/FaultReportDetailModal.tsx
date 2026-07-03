import type { AdminFaultReportDetail, FaultReportStatus } from "../../types/config";
import { FAULT_REPORT_SCENE_LABELS, FAULT_REPORT_STATUS_LABELS, formatFaultReportTime } from "../../utils/faultReports";

type Props = {
  report: AdminFaultReportDetail;
  busy: boolean;
  themeColor: string;
  onStatusChange: (status: FaultReportStatus) => void;
  onExportLog: (index: number) => void;
  onExportAll: () => void;
  onDelete: () => void;
  onClose: () => void;
};

function Block({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/60 px-4 py-3">
      <div className="text-xs font-bold text-slate-400">{label}</div>
      <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs leading-5 text-slate-700">{value || "-"}</pre>
    </div>
  );
}

export default function FaultReportDetailModal({ report, busy, themeColor, onStatusChange, onExportLog, onExportAll, onDelete, onClose }: Props) {
  const nextStatus: FaultReportStatus = report.status === "processed" ? "pending" : "processed";
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div className="relative mx-auto my-4 flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/90 shadow-2xl backdrop-blur-2xl sm:my-8 sm:max-h-[calc(100dvh-4rem)]">
        <header className="flex items-center justify-between gap-4 border-b border-white/50 px-5 py-4 sm:px-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-extrabold text-slate-800">故障上报详情</h3>
              <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{FAULT_REPORT_SCENE_LABELS[report.scene]}</span>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${report.status === "processed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{FAULT_REPORT_STATUS_LABELS[report.status]}</span>
            </div>
            <p className="mt-1 truncate font-mono text-xs text-slate-400">{report.id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/70 px-3 py-2 font-bold text-slate-500">关闭</button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-8">
          <section className="grid grid-cols-1 gap-3 rounded-2xl border border-white/60 bg-white/45 p-5 text-sm md:grid-cols-3">
            <div><b className="text-slate-500">用户：</b>{report.userId || "匿名"}</div>
            <div><b className="text-slate-500">App：</b>{report.appVersion} ({report.appVersionCode})</div>
            <div><b className="text-slate-500">系统：</b>Android {report.osVersion} / SDK {report.sdkInt}</div>
            <div><b className="text-slate-500">设备：</b>{report.brand} {report.model}</div>
            <div><b className="text-slate-500">网络：</b>{report.networkType || "-"}</div>
            <div><b className="text-slate-500">提交：</b>{formatFaultReportTime(report.createdAt)}</div>
          </section>

          <section className="space-y-4">
            {report.logs.map((log, index) => (
              <details key={log.clientLogId} className="rounded-2xl border border-white/60 bg-white/55 p-4 shadow-sm" open={index === 0}>
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-bold text-slate-700">
                  <span className="min-w-0">
                    <span className="mr-3 text-slate-400">#{index + 1}</span>{log.methodName || log.failureType}
                    <span className="ml-3 text-xs font-normal text-slate-400">{formatFaultReportTime(log.occurredAt)} · {log.songSource}/{log.songId} · {log.quality || "auto"}</span>
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onExportLog(index);
                    }}
                    className="shrink-0 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm disabled:opacity-50"
                  >
                    导出
                  </button>
                </summary>
                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <Block label="失败类型" value={log.failureType} />
                  <Block label="HTTP / nonce" value={`${log.requestMethod || "-"} ${log.responseCode ?? "-"} / ${log.nonceId || "-"}`} />
                  <Block label="请求地址" value={log.requestUrl} />
                  <Block label="解析地址" value={log.resolvedUrl} />
                  <Block label="请求参数" value={log.requestParamsJson} />
                  <Block label="响应" value={log.responseBody} />
                  <Block label="异常" value={`${log.errorType}\n${log.errorMessage}`.trim()} />
                  <Block label="堆栈" value={log.stackTrace} />
                </div>
              </details>
            ))}
          </section>
        </div>

        <footer className="flex flex-col-reverse gap-3 border-t border-white/50 p-5 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={onExportAll} className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm disabled:opacity-50">导出全部</button>
          <button type="button" disabled={busy} onClick={onDelete} className="rounded-xl bg-rose-500 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">删除批次</button>
          <button type="button" disabled={busy} onClick={() => onStatusChange(nextStatus)} className="rounded-xl px-6 py-3 text-sm font-bold text-white disabled:opacity-50" style={{ backgroundColor: report.status === "processed" ? "#f59e0b" : themeColor }}>
            {busy ? "处理中..." : report.status === "processed" ? "恢复为待处理" : "标记为已处理"}
          </button>
        </footer>
      </div>
    </div>
  );
}
