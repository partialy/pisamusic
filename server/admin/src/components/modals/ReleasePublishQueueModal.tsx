import {
  Alert,
  Button,
  Empty,
  Modal,
  Progress,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CheckCircleFilled,
  ClearOutlined,
  CloseCircleFilled,
  CloudUploadOutlined,
  DeleteOutlined,
  LaptopOutlined,
  LoadingOutlined,
  MobileOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { MODAL_WIDTH } from "../../constants/theme";
import { ModalTitle } from "../ui/ModalTitle";
import {
  useReleasePublishQueue,
  type ReleasePublishTaskItem,
} from "../../state/ReleasePublishQueueContext";
import {
  DESKTOP_REQUIRED_SLOTS,
  formatReleaseFileSize,
} from "../../utils/releaseFormHelpers";

const { Text } = Typography;

function formatPhaseText(task: ReleasePublishTaskItem): string {
  switch (task.phase) {
    case "waiting":
      return "排队等待执行...";
    case "uploading":
      return `正在直传安装包到七牛云 (${task.overallPercent}%)...`;
    case "activating":
      return "正在校验并启用 PC 自动更新资产...";
    case "publishing":
      return task.mode === "create" ? "正在提交发布配置..." : "正在保存版本修改...";
    case "done":
      return task.mode === "create" ? "上传并发布成功" : "上传并保存修改成功";
    case "error":
      return task.errorMessage || "发布任务执行失败";
    default:
      return "";
  }
}

function renderTaskStateTag(task: ReleasePublishTaskItem) {
  switch (task.state) {
    case "running":
      return (
        <Tag color="processing" icon={<LoadingOutlined />}>
          执行中
        </Tag>
      );
    case "queued":
      return <Tag color="default">等待中</Tag>;
    case "completed":
      return (
        <Tag color="success" icon={<CheckCircleFilled />}>
          已完成
        </Tag>
      );
    case "failed":
      return (
        <Tag color="error" icon={<CloseCircleFilled />}>
          失败
        </Tag>
      );
  }
}

export default function ReleasePublishQueueModal() {
  const {
    tasks,
    queueModalOpen,
    closeQueueModal,
    retryTask,
    removeTask,
    clearCompletedTasks,
    stats,
  } = useReleasePublishQueue();

  return (
    <Modal
      open={queueModalOpen}
      onCancel={closeQueueModal}
      footer={[
        <Button key="close" type="primary" onClick={closeQueueModal}>
          关闭
        </Button>,
      ]}
      width={MODAL_WIDTH.lg}
      centered
      destroyOnClose
      title={
        <ModalTitle
          icon={<CloudUploadOutlined className="text-blue-500" />}
          title="版本发布后台任务"
          extra={
            stats.active > 0 ? (
              <Tag color="processing" className="font-mono !mr-0">
                进行中 {stats.active}
              </Tag>
            ) : null
          }
        />
      }
    >
      <div className="space-y-4 pt-2">
        <Alert
          type="info"
          showIcon
          className="text-xs"
          message="关闭此窗口或切换管理菜单不会中断版本上传，上传完成后将自动执行激活与发布（切勿刷新或关闭浏览器标签页）。"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              总任务：<strong className="font-mono text-slate-800">{stats.total}</strong>
            </span>
            <span>
              进行中：<strong className="font-mono text-blue-600">{stats.running}</strong>
            </span>
            <span>
              排队中：<strong className="font-mono text-slate-600">{stats.queued}</strong>
            </span>
            <span>
              已完成：<strong className="font-mono text-emerald-600">{stats.completed}</strong>
            </span>
            {stats.failed > 0 && (
              <span>
                失败：<strong className="font-mono text-red-600">{stats.failed}</strong>
              </span>
            )}
          </div>

          {stats.completed > 0 && (
            <Button size="small" icon={<ClearOutlined />} onClick={clearCompletedTasks}>
              清理已完成
            </Button>
          )}
        </div>

        {tasks.length === 0 ? (
          <Empty description="当前暂无后台发布任务" className="py-12" />
        ) : (
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-200/70 bg-white">
            {tasks.map((task) => {
              const isDesktop = task.draft.platform === "desktop";
              return (
                <div key={task.id} className="p-4 space-y-2.5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag
                        color={isDesktop ? "blue" : "green"}
                        icon={isDesktop ? <LaptopOutlined /> : <MobileOutlined />}
                        className="!mr-0"
                      >
                        {isDesktop ? "PC 版" : "Android"}
                      </Tag>
                      <Text strong className="font-mono text-sm text-slate-800">
                        {task.draft.version}
                      </Text>
                      <Tag className="!mr-0 text-[11px]">
                        {task.mode === "create" ? "发布新版本" : "编辑更新"}
                      </Tag>
                      {renderTaskStateTag(task)}
                    </div>

                    <Space size={6}>
                      {task.state === "failed" && (
                        <Button
                          size="small"
                          type="link"
                          icon={<ReloadOutlined />}
                          onClick={() => retryTask(task.id)}
                        >
                          重试
                        </Button>
                      )}
                      {task.state !== "running" && (
                        <Tooltip title="移除记录">
                          <Button
                            size="small"
                            type="text"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => removeTask(task.id)}
                          />
                        </Tooltip>
                      )}
                    </Space>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span
                        className={
                          task.state === "failed"
                            ? "text-red-600 font-medium"
                            : task.state === "completed"
                            ? "text-emerald-600 font-medium"
                            : "text-slate-600"
                        }
                      >
                        {formatPhaseText(task)}
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {task.overallPercent}%
                      </span>
                    </div>
                    <Progress
                      percent={task.overallPercent}
                      size="small"
                      showInfo={false}
                      status={
                        task.state === "failed"
                          ? "exception"
                          : task.state === "completed"
                          ? "success"
                          : "active"
                      }
                    />
                  </div>

                  {/* 子文件进度明细 */}
                  {!isDesktop && task.androidFile && (
                    <div className="rounded-lg bg-slate-50 border border-slate-200/70 px-3 py-2 text-[11px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-slate-700">
                          安装包：{task.androidFile.name}（
                          {formatReleaseFileSize(task.androidFile.size)}）
                        </span>
                        <span className="font-mono text-slate-500 shrink-0">
                          {task.uploadedAndroidFile
                            ? "已登记"
                            : `${task.fileProgress.package ?? 0}%`}
                        </span>
                      </div>
                    </div>
                  )}

                  {isDesktop && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {DESKTOP_REQUIRED_SLOTS.map((slot) => {
                        const file = task.desktopFiles?.[slot.type];
                        const uploaded = task.uploadedDesktopAssets?.[slot.type];
                        const existing = task.existingDesktopAssets?.[slot.type];
                        const pct = uploaded ? 100 : (task.fileProgress[slot.type] ?? 0);
                        return (
                          <div
                            key={slot.type}
                            className="rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-2 text-[11px]"
                          >
                            <div className="flex items-center justify-between gap-1 font-semibold text-slate-700">
                              <span>{slot.label}</span>
                              <span className="font-mono text-slate-500">
                                {file
                                  ? uploaded
                                    ? "已完成"
                                    : `${pct}%`
                                  : existing
                                  ? "沿用原文件"
                                  : "-"}
                              </span>
                            </div>
                            <div className="truncate text-slate-500 mt-0.5">
                              {file ? file.name : existing?.fileName || "未变更"}
                            </div>
                            {file && (
                              <Progress
                                percent={pct}
                                size="small"
                                showInfo={false}
                                className="!mt-1 !mb-0"
                                status={
                                  uploaded
                                    ? "success"
                                    : task.state === "failed"
                                    ? "exception"
                                    : "active"
                                }
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
