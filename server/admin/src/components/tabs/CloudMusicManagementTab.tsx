import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ClearOutlined,
  CustomerServiceOutlined,
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  cleanupCloudMusicTemp,
  deleteCloudMusic,
  fetchCloudMusicPreviewUrl,
  fetchCloudMusicTempSummary,
  fetchCloudMusicTracks,
} from "../../api/cloudMusic";
import type {
  CloudMusicListFilter,
  CloudMusicStatus,
  CloudMusicTempSummary,
  CloudMusicTrack,
  CloudMusicUploadState,
} from "../../types/cloudMusic";
import CloudMusicEditModal from "../modals/CloudMusicEditModal";
import CloudMusicReviewModal from "../modals/CloudMusicReviewModal";
import CloudMusicUploadModal from "../modals/CloudMusicUploadModal";

const { Text } = Typography;

type Props = {
  themeColor: string;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

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

function statusTag(status: CloudMusicStatus) {
  switch (status) {
    case "active":
      return <Tag color="success">可用</Tag>;
    case "disabled":
      return <Tag color="warning">禁用</Tag>;
    case "offline":
      return <Tag color="default">下架</Tag>;
    case "pending_review":
      return <Tag color="processing">待审核</Tag>;
    case "rejected":
      return <Tag color="error">已拒绝</Tag>;
    case "temp":
      return <Tag color="purple">临时未保存</Tag>;
    case "deleted":
      return <Tag color="default">已删除</Tag>;
    default:
      return <Tag>{status}</Tag>;
  }
}

export default function CloudMusicManagementTab({ themeColor: _ }: Props) {
  const [tracks, setTracks] = useState<CloudMusicTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<CloudMusicStatus | "all">("all");
  const [uploadStateFilter, setUploadStateFilter] = useState<CloudMusicUploadState | "all">("all");

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingTrack, setEditingTrack] = useState<CloudMusicTrack | null>(null);
  const [reviewingTrack, setReviewingTrack] = useState<CloudMusicTrack | null>(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [tempSummary, setTempSummary] = useState<CloudMusicTempSummary | null>(null);
  const [cleaningHours, setCleaningHours] = useState<0 | 24 | 72>(24);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResultMsg, setCleanupResultMsg] = useState("");

  // Audio preview player state
  const [activePreviewUuid, setActivePreviewUuid] = useState<string | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [loadingPreviewUuid, setLoadingPreviewUuid] = useState<string | null>(null);

  const loadTracks = async (newOffset = offset) => {
    setLoading(true);
    setError("");
    try {
      const filter: CloudMusicListFilter = {
        keyword: keyword.trim() || undefined,
        status: statusFilter,
        uploadState: uploadStateFilter,
        offset: newOffset,
        limit,
      };
      const res = await fetchCloudMusicTracks(filter);
      setTracks(res.items);
      setTotal(res.total);
      setOffset(res.offset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取网盘音乐列表失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks(0);
  }, [statusFilter, uploadStateFilter]);

  const handleSearch = () => {
    loadTracks(0);
  };

  const handleReset = () => {
    setKeyword("");
    setStatusFilter("all");
    setUploadStateFilter("all");
  };

  const handleOpenCleanup = async () => {
    setShowCleanupModal(true);
    setCleanupResultMsg("");
    try {
      const summary = await fetchCloudMusicTempSummary();
      setTempSummary(summary);
    } catch {
      setTempSummary(null);
    }
  };

  const handleExecuteCleanup = async () => {
    setCleaning(true);
    setCleanupResultMsg("");
    try {
      const res = await cleanupCloudMusicTemp(cleaningHours);
      setCleanupResultMsg(
        `清理完成：扫描 ${res.scanned} 条，已删除 ${res.deleted} 条${res.failed.length > 0 ? `，失败 ${res.failed.length} 条` : ""}`
      );
      const summary = await fetchCloudMusicTempSummary();
      setTempSummary(summary);
      loadTracks();
    } catch (err) {
      setCleanupResultMsg(`清理失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCleaning(false);
    }
  };

  const handleDelete = async (track: CloudMusicTrack) => {
    try {
      await deleteCloudMusic(track.uuid);
      loadTracks();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "删除失败");
    }
  };

  const handlePlayPreview = async (track: CloudMusicTrack) => {
    if (activePreviewUuid === track.uuid) {
      setActivePreviewUuid(null);
      setPreviewAudioUrl(null);
      return;
    }

    setLoadingPreviewUuid(track.uuid);
    try {
      const urls = await fetchCloudMusicPreviewUrl(track.uuid);
      setActivePreviewUuid(track.uuid);
      setPreviewAudioUrl(urls.audioUrl);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "获取试听地址失败");
    } finally {
      setLoadingPreviewUuid(null);
    }
  };

  const columns: ColumnsType<CloudMusicTrack> = [
    {
      title: "歌曲信息",
      key: "songInfo",
      width: 260,
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <Avatar
            shape="square"
            size={44}
            src={record.cover?.url}
            icon={<CustomerServiceOutlined />}
            className="rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200"
          />
          <div className="min-w-0 flex-1">
            <Text strong ellipsis className="text-slate-800 block text-xs" title={record.title}>
              {record.title || "未命名"}
            </Text>
            <Text type="secondary" ellipsis className="block text-[11px] text-slate-500" title={record.artist}>
              {record.artist} {record.album ? `· ${record.album}` : ""}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "状态",
      key: "status",
      width: 140,
      render: (_, record) => (
        <div className="flex flex-col gap-1 items-start">
          {statusTag(record.status)}
          {record.statusReason && (
            <Tooltip title={record.statusReason}>
              <span className="text-[10px] text-slate-400 truncate max-w-[120px] block">
                {record.statusReason}
              </span>
            </Tooltip>
          )}
          {record.uploadState !== "ready" && (
            <Tag color="default" className="!mr-0 text-[10px] font-mono">
              {record.uploadState}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "格式 / 大小",
      key: "formatSpecs",
      width: 120,
      render: (_, record) => (
        <div className="text-xs font-mono">
          <Tag color="geekblue">{record.format ? record.format.toUpperCase() : "-"}</Tag>
          <span className="text-[11px] text-slate-400 block mt-0.5">
            {record.audioFile ? formatFileSize(record.audioFile.fileSize) : "-"}
          </span>
        </div>
      ),
    },
    {
      title: "时长",
      dataIndex: "durationMs",
      key: "duration",
      width: 80,
      render: (ms: number) => (
        <span className="font-mono text-xs text-slate-600">
          {formatDuration(ms)}
        </span>
      ),
    },
    {
      title: "歌词",
      key: "lyrics",
      width: 90,
      align: "center",
      render: (_, record) =>
        record.lyrics ? (
          <Tag color="green">{record.lyrics.format.toUpperCase()}</Tag>
        ) : (
          <span className="text-xs text-slate-400">无</span>
        ),
    },
    {
      title: "所有者",
      key: "owner",
      width: 120,
      render: (_, record) => (
        <Text strong className="text-xs text-slate-700">
          {record.owner?.displayName || "未知"}
        </Text>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 170,
      render: (ts: number) => (
        <Text type="secondary" className="text-xs">
          {formatDate(ts)}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 250,
      render: (_, record) => {
        const isPlaying = activePreviewUuid === record.uuid;
        const isLoadingPreview = loadingPreviewUuid === record.uuid;
        return (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              disabled={record.uploadState !== "ready"}
              loading={isLoadingPreview}
              onClick={() => handlePlayPreview(record)}
              className={isPlaying ? "!text-purple-600" : ""}
            >
              {isPlaying ? "停止" : "试听"}
            </Button>

            {record.status !== "deleted" && (
              <Button
                type="link"
                size="small"
                onClick={() => setReviewingTrack(record)}
                className={
                  record.status === "pending_review"
                    ? "!text-blue-600 font-bold"
                    : record.status === "rejected"
                    ? "!text-orange-600"
                    : "!text-indigo-600"
                }
              >
                {record.status === "pending_review"
                  ? "审核"
                  : record.status === "rejected"
                  ? "重审/改态"
                  : "改态"}
              </Button>
            )}

            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => setEditingTrack(record)}
            >
              编辑
            </Button>

            <Popconfirm
              title={`确认删除《${record.title || "未命名"}》？`}
              description="关联的七牛音频、封面和歌词文件将被物理删除！"
              onConfirm={() => handleDelete(record)}
              okText="确认删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Card
        bordered={false}
        className="shadow-sm rounded-2xl"
        title={
          <div>
            <span className="text-lg font-bold text-slate-800">网盘音乐管理</span>
            <span className="ml-2 text-xs font-normal text-slate-500">
              共 {total} 首云盘曲目
            </span>
          </div>
        }
        extra={
          <Space>
            <Button
              icon={<ClearOutlined />}
              onClick={handleOpenCleanup}
            >
              清理临时文件
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setShowUploadModal(true)}
            >
              上传音乐
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => loadTracks()}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        }
      >
        {error && (
          <Alert type="error" showIcon message={error} className="mb-4" />
        )}

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="搜索歌名、歌手、专辑或 UUID..."
            prefix={<SearchOutlined className="text-slate-400" />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            className="w-full sm:w-72"
          />

          <Select
            value={statusFilter}
            onChange={(val) => setStatusFilter(val)}
            className="w-36"
            options={[
              { label: "全部业务状态", value: "all" },
              { label: "可用 (active)", value: "active" },
              { label: "待审核 (pending)", value: "pending_review" },
              { label: "禁用 (disabled)", value: "disabled" },
              { label: "下架 (offline)", value: "offline" },
              { label: "临时未保存 (temp)", value: "temp" },
              { label: "已拒绝 (rejected)", value: "rejected" },
            ]}
          />

          <Select
            value={uploadStateFilter}
            onChange={(val) => setUploadStateFilter(val)}
            className="w-36"
            options={[
              { label: "全部上传状态", value: "all" },
              { label: "已就绪 (ready)", value: "ready" },
              { label: "解析中 (processing)", value: "processing" },
              { label: "已上传 (uploaded)", value: "uploaded" },
              { label: "已预约 (reserved)", value: "reserved" },
              { label: "失败 (failed)", value: "failed" },
            ]}
          />

          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
        </div>

        <Table<CloudMusicTrack>
          rowKey="uuid"
          columns={columns}
          dataSource={tracks}
          loading={loading}
          size="middle"
          scroll={{ x: 1350 }}
          sticky={{ offsetHeader: 0 }}
          bordered
          pagination={{
            current: Math.floor(offset / limit) + 1,
            pageSize: limit,
            total,
            showTotal: (t) => `共 ${t} 首曲目`,
            showQuickJumper: true,
            onChange: (page) => loadTracks((page - 1) * limit),
          }}
        />

        {/* Global floating preview audio player */}
        {activePreviewUuid && previewAudioUrl && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-purple-200 bg-purple-50/80 p-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-purple-800">正在试听：</span>
              <audio controls src={previewAudioUrl} autoPlay className="h-8" />
            </div>
            <Button
              size="small"
              onClick={() => {
                setActivePreviewUuid(null);
                setPreviewAudioUrl(null);
              }}
            >
              关闭试听
            </Button>
          </div>
        )}
      </Card>

      {/* Upload Modal */}
      {showUploadModal && (
        <CloudMusicUploadModal
          themeColor=""
          onClose={() => setShowUploadModal(false)}
          onSuccess={(newTrack) => {
            setShowUploadModal(false);
            setEditingTrack(newTrack);
            loadTracks(0);
          }}
        />
      )}

      {/* Edit Modal */}
      {editingTrack && (
        <CloudMusicEditModal
          track={editingTrack}
          themeColor=""
          onClose={() => setEditingTrack(null)}
          onSaved={() => {
            setEditingTrack(null);
            loadTracks();
          }}
        />
      )}

      {/* Review Modal */}
      {reviewingTrack && (
        <CloudMusicReviewModal
          track={reviewingTrack}
          themeColor=""
          onClose={() => setReviewingTrack(null)}
          onReviewed={() => {
            setReviewingTrack(null);
            loadTracks();
          }}
        />
      )}

      {/* Cleanup Modal */}
      {showCleanupModal && (
        <Modal
          open
          centered
          title="清理临时网盘文件"
          width={520}
          onCancel={() => setShowCleanupModal(false)}
          footer={[
            <Button key="close" onClick={() => setShowCleanupModal(false)}>
              关闭
            </Button>,
            <Button
              key="clean"
              type="primary"
              danger={cleaningHours === 0}
              loading={cleaning}
              onClick={handleExecuteCleanup}
            >
              确认清理
            </Button>,
          ]}
          destroyOnClose
        >
          <div className="space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
            <p className="text-xs text-slate-500">
              清理上传中断或未保存的临时曲目及其关联七牛对象，释放存储空间。
            </p>

            {tempSummary && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-1 text-xs font-mono">
                <div className="flex justify-between">
                  <span>全部临时曲目:</span>
                  <span className="font-bold">
                    {tempSummary.total.count} 个 ({formatFileSize(tempSummary.total.bytes)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>24 小时前临时曲目:</span>
                  <span className="font-bold text-amber-600">
                    {tempSummary.olderThan24h.count} 个 ({formatFileSize(tempSummary.olderThan24h.bytes)})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>72 小时前临时曲目:</span>
                  <span className="font-bold text-red-600">
                    {tempSummary.olderThan72h.count} 个 ({formatFileSize(tempSummary.olderThan72h.bytes)})
                  </span>
                </div>
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-bold text-slate-700">
                选择清理范围
              </label>
              <Radio.Group
                value={cleaningHours}
                onChange={(e) => setCleaningHours(e.target.value)}
                className="w-full"
              >
                <Space direction="vertical" className="w-full">
                  <Radio value={24}>24 小时前 (推荐)</Radio>
                  <Radio value={72}>72 小时前</Radio>
                  <Radio value={0}>
                    <span className="text-red-500 font-bold">全部临时记录 (立即删除)</span>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>

            {cleanupResultMsg && (
              <Alert
                type="info"
                showIcon
                message={cleanupResultMsg}
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
