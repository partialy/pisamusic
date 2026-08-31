import {
  Alert,
  Button,
  Collapse,
  Descriptions,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  BugOutlined,
  DeleteOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import type {
  AdminFaultReportDetail,
  FaultReportStatus,
} from "../../types/config";
import {
  FAULT_REPORT_SCENE_LABELS,
  FAULT_REPORT_STATUS_LABELS,
  formatFaultReportTime,
} from "../../utils/faultReports";

const { Text } = Typography;

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

function LogField({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-200/80">
      <span className="text-[11px] font-bold text-slate-500 block mb-1">
        {label}
      </span>
      <pre className="whitespace-pre-wrap break-all font-mono text-xs text-slate-700 leading-5 m-0 max-h-48 overflow-y-auto">
        {value}
      </pre>
    </div>
  );
}

export default function FaultReportDetailModal({
  report,
  busy,
  themeColor: _,
  onStatusChange,
  onExportLog,
  onExportAll,
  onDelete,
  onClose,
}: Props) {
  const isProcessed = report.status === "processed";
  const nextStatus: FaultReportStatus = isProcessed ? "pending" : "processed";
  const isDesktop = report.platform === "desktop";

  const collapseItems = report.logs.map((log, index) => ({
    key: log.clientLogId || String(index),
    label: (
      <div className="flex items-center justify-between gap-3 pr-2">
        <div className="flex items-center gap-2 min-w-0">
          <Tag color="blue">#{index + 1}</Tag>
          <Text strong className="text-xs text-slate-800 truncate">
            {log.methodName || log.failureType}
          </Text>
          <span className="text-xs text-slate-400 truncate hidden sm:inline">
            {isDesktop
              ? `${formatFaultReportTime(log.occurredAt)} · ${log.requestMethod || "-"} · ${log.errorType || "network"}`
              : `${formatFaultReportTime(log.occurredAt)} · ${log.songSource || ""}/${log.songId || ""} · ${log.quality || "auto"}`}
          </span>
        </div>

        <Button
          size="small"
          icon={<DownloadOutlined />}
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onExportLog(index);
          }}
        >
          导出单条
        </Button>
      </div>
    ),
    children: (
      <div className="space-y-2 pt-1">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <LogField label="失败类型" value={log.failureType} />
          <LogField
            label={isDesktop ? "HTTP 方法 / 状态码" : "HTTP / Nonce ID"}
            value={`${log.requestMethod || "-"} ${log.responseCode ?? "-"} / ${log.nonceId || "-"}`}
          />
        </div>

        <LogField label="请求完整地址" value={log.requestUrl} />
        {!isDesktop && <LogField label="解析音频直链" value={log.resolvedUrl} />}
        <LogField label="请求参数 (JSON)" value={log.requestParamsJson} />
        <LogField label="响应体 (Response Body)" value={log.responseBody} />
        <LogField
          label="异常信息"
          value={`${log.errorType || ""}\n${log.errorMessage || ""}`.trim()}
        />
        <LogField label="调用栈 (Stack Trace)" value={log.stackTrace} />
      </div>
    ),
  }));

  return (
    <Modal
      open
      centered
      title={
        <Space align="center" size={8}>
          <BugOutlined className="text-rose-500 text-lg" />
          <span className="text-base font-bold text-slate-800">故障上报批次详情</span>
          <Tag color={isDesktop ? "blue" : "cyan"}>
            {FAULT_REPORT_SCENE_LABELS[report.scene] || report.scene}
          </Tag>
          <Tag color={isProcessed ? "success" : "warning"}>
            {FAULT_REPORT_STATUS_LABELS[report.status] || report.status}
          </Tag>
          <span className="text-xs font-mono text-slate-400">({report.id})</span>
        </Space>
      }
      width={900}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button
          key="export"
          icon={<DownloadOutlined />}
          disabled={busy}
          onClick={onExportAll}
        >
          导出全部日志
        </Button>,
        <Popconfirm
          key="delete"
          title="确认删除该故障批次？"
          description="删除后将永久清理该故障报告及其全部子日志！"
          onConfirm={onDelete}
          okText="确认删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button danger disabled={busy} icon={<DeleteOutlined />}>
            删除批次
          </Button>
        </Popconfirm>,
        <Button
          key="status"
          type="primary"
          loading={busy}
          onClick={() => onStatusChange(nextStatus)}
          className={isProcessed ? "!bg-amber-500 hover:!bg-amber-600" : "!bg-emerald-600 hover:!bg-emerald-700"}
        >
          {isProcessed ? "恢复为待处理" : "标记为已处理"}
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
        <Descriptions
          bordered
          size="small"
          column={{ xxl: 3, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}
          className="bg-slate-50/50 rounded-xl overflow-hidden"
        >
          <Descriptions.Item label="上报用户">
            {report.userId ? (
              <Text copyable={{ text: report.userId }} className="font-mono text-xs text-slate-800">
                {report.userId}
              </Text>
            ) : (
              <span className="text-slate-400">匿名上报</span>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="App 版本">
            <Text strong className="font-mono text-xs">
              {report.appVersion}
              {report.appVersionCode > 0 ? ` (${report.appVersionCode})` : ""}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="系统环境">
            {isDesktop
              ? `${report.brand} ${report.osVersion}`
              : `Android ${report.osVersion} / SDK ${report.sdkInt}`}
          </Descriptions.Item>
          <Descriptions.Item label="设备型号">
            {isDesktop
              ? `${report.model} / ${report.arch}`
              : `${report.brand} ${report.model}`}
          </Descriptions.Item>
          <Descriptions.Item label="网络类型">
            {report.networkType || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="提交时间">
            {formatFaultReportTime(report.createdAt)}
          </Descriptions.Item>
        </Descriptions>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">
              关联故障日志 ({report.logs.length} 条)
            </span>
          </div>

          {report.logs.length === 0 ? (
            <Alert type="info" showIcon message="该报告无子日志记录" />
          ) : (
            <Collapse
              defaultActiveKey={report.logs.length > 0 ? [report.logs[0].clientLogId || "0"] : []}
              items={collapseItems}
              size="small"
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
