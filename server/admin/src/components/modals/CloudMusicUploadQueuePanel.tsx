import {
  Alert,
  Avatar,
  Button,
  Empty,
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
  DeleteOutlined,
  LoadingOutlined,
  PictureOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useCloudMusicUploadQueue } from "../../state/CloudMusicUploadQueueContext";
import type { CloudMusicUploadTaskItem } from "../../types/cloudMusic";

const { Text } = Typography;

function formatPhaseText(task: CloudMusicUploadTaskItem): string {
  switch (task.phase) {
    case "waiting":
      return "排队等待中...";
    case "reserving":
      return "正在创建七牛上传会话...";
    case "audio":
      return `正在直传音频 (${task.percent}%)...`;
    case "cover":
      return `正在直传封面 (${task.percent}%)...`;
    case "lyrics":
      return `正在直传歌词 (${task.percent}%)...`;
    case "saving":
      return "正在写入元数据并激活状态...";
    case "done":
      return "上传并入库成功";
    case "error":
      return task.errorMessage || "上传失败";
    default:
      return "";
  }
}

function taskStateBadge(task: CloudMusicUploadTaskItem) {
  switch (task.state) {
    case "uploading":
      return (
        <Tag color="processing" icon={<LoadingOutlined />}>
          上传中
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

export default function CloudMusicUploadQueuePanel() {
  const {
    tasks,
    stats,
    retryTask,
    retryAllFailed,
    removeTask,
    clearCompletedTasks,
    openUploadWizard,
  } = useCloudMusicUploadQueue();

  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        message="关闭此窗口不会中断上传任务，队列将在后台继续执行（最大并发 3 首），每完成一首会自动刷新曲库列表。"
        className="text-xs"
      />

      {/* Summary & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span>
            总任务：<strong className="font-mono text-slate-800">{stats.total}</strong>
          </span>
          <span>
            进行中：<strong className="font-mono text-blue-600">{stats.uploading}</strong>
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

        <Space size={8} wrap>
          {stats.failed > 0 && (
            <Button
              size="small"
              type="primary"
              danger
              icon={<ReloadOutlined />}
              onClick={retryAllFailed}
            >
              重试全部失败 ({stats.failed})
            </Button>
          )}
          {stats.completed > 0 && (
            <Button
              size="small"
              icon={<ClearOutlined />}
              onClick={clearCompletedTasks}
            >
              清理已完成
            </Button>
          )}
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={openUploadWizard}
          >
            继续添加音乐
          </Button>
        </Space>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <Empty
          description="当前暂无上传任务"
          className="py-16"
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={openUploadWizard}>
            选择音频开始上传
          </Button>
        </Empty>
      ) : (
        <div className="max-h-[calc(85vh-260px)] overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-200/70 bg-white">
          {tasks.map((task) => {
            const { draft } = task;
            return (
              <div
                key={task.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {draft.coverPreviewUrl ? (
                    <img
                      src={draft.coverPreviewUrl}
                      alt={draft.title}
                      className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                    />
                  ) : (
                    <Avatar
                      shape="square"
                      size={44}
                      icon={<PictureOutlined />}
                      className="bg-slate-100 text-slate-400 rounded-lg shrink-0"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Text strong ellipsis className="text-xs text-slate-800">
                        {draft.title}
                      </Text>
                      <Text type="secondary" ellipsis className="text-[11px] text-slate-500">
                        {draft.artist} {draft.album ? `· ${draft.album}` : ""}
                      </Text>
                    </div>

                    <div className="mt-1 flex items-center gap-2">
                      {taskStateBadge(task)}
                      <span
                        className={`text-[11px] truncate ${
                          task.state === "failed"
                            ? "text-red-600 font-medium"
                            : task.state === "completed"
                            ? "text-emerald-600"
                            : "text-slate-500"
                        }`}
                        title={formatPhaseText(task)}
                      >
                        {formatPhaseText(task)}
                      </span>
                    </div>

                    {(task.state === "uploading" || task.state === "queued") && (
                      <div className="mt-1.5 max-w-md">
                        <Progress
                          percent={task.percent}
                          size="small"
                          status={task.state === "uploading" ? "active" : "normal"}
                          showInfo={task.state === "uploading"}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <Space size={6} className="shrink-0">
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
                  {task.state !== "uploading" && (
                    <Tooltip title={task.state === "queued" ? "取消排队" : "移除记录"}>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
