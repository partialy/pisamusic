import { useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Input,
  Modal,
  Radio,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CustomerServiceOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { fetchCloudMusicPreviewUrl, reviewCloudMusic } from "../../api/cloudMusic";
import type { CloudMusicReviewInput, CloudMusicTrack } from "../../types/cloudMusic";

const { Text } = Typography;
const { TextArea } = Input;

type Props = {
  track: CloudMusicTrack;
  themeColor: string;
  onClose: () => void;
  onReviewed: (track: CloudMusicTrack) => void;
};

export default function CloudMusicReviewModal({
  track,
  onClose,
  onReviewed,
}: Props) {
  const [decision, setDecision] = useState<"approve" | "reject" | "resubmit" | "ban_destroy">("approve");
  const [targetStatus, setTargetStatus] = useState<"active" | "disabled">(
    track.status === "disabled" ? "disabled" : "active"
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);

  const handlePlayPreview = async () => {
    if (previewUrl) return;
    setLoadingAudio(true);
    setError("");
    try {
      const urls = await fetchCloudMusicPreviewUrl(track.uuid);
      setPreviewUrl(urls.audioUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取试听地址失败");
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);

    try {
      let payload: CloudMusicReviewInput;
      if (decision === "approve") {
        payload = {
          decision: "approve",
          targetStatus,
          reason: reason.trim() || undefined,
        };
      } else if (decision === "reject") {
        if (!reason.trim()) {
          setError("请填写驳回原因（告知用户如何修改并重新提审）");
          setSubmitting(false);
          return;
        }
        payload = { decision: "reject", reason: reason.trim() };
      } else if (decision === "resubmit") {
        payload = { decision: "resubmit", reason: reason.trim() || undefined };
      } else {
        if (!reason.trim()) {
          setError("请填写违规销毁原因说明");
          setSubmitting(false);
          return;
        }
        payload = { decision: "ban_destroy", reason: reason.trim() };
      }

      const updated = await reviewCloudMusic(track.uuid, payload);
      onReviewed(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "审核提交失败");
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      centered
      title={
        <Space align="center" size={8}>
          <AuditOutlined className="text-blue-500 text-lg" />
          <span className="text-base font-bold text-slate-800">网盘歌曲审核与状态流转</span>
          <span className="text-xs font-mono text-slate-400">({track.uuid})</span>
        </Space>
      }
      width={760}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText={
        decision === "ban_destroy"
          ? "确认违规销毁"
          : decision === "reject"
          ? "确认驳回修改"
          : decision === "resubmit"
          ? "重置为待审核"
          : "确认审核通过"
      }
      okButtonProps={{
        danger: decision === "ban_destroy" || decision === "reject",
      }}
      cancelText="取消"
      destroyOnClose
    >
      <div className="space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
        {error && <Alert type="error" showIcon message={error} />}

        {/* Track Summary Card */}
        <Card size="small" className="bg-slate-50/80 border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar
                shape="square"
                size={52}
                src={track.cover?.url}
                icon={<CustomerServiceOutlined />}
                className="rounded-lg object-cover bg-slate-100 shrink-0 border border-slate-200"
              />
              <div className="min-w-0">
                <Text strong className="text-sm text-slate-800 block">
                  {track.title || "未命名"}
                </Text>
                <Text type="secondary" className="text-xs block">
                  {track.artist} {track.album ? `· ${track.album}` : ""}
                </Text>
                <div className="mt-1 flex items-center gap-2">
                  <Tag color="geekblue">{track.format?.toUpperCase() || "-"}</Tag>
                  <Tag color="purple">{track.owner?.displayName}</Tag>
                </div>
              </div>
            </div>

            <div>
              {previewUrl ? (
                <audio controls src={previewUrl} autoPlay className="h-8 w-48" />
              ) : (
                <Button
                  icon={<PlayCircleOutlined />}
                  loading={loadingAudio}
                  onClick={handlePlayPreview}
                >
                  试听音频
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Decision Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            审核决策与处理动作
          </label>
          <Radio.Group
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            className="w-full"
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Radio.Button value="approve" className="text-center h-auto py-2">
                <CheckCircleOutlined className="text-emerald-500 mr-1" />
                <span>审核通过</span>
              </Radio.Button>
              <Radio.Button value="reject" className="text-center h-auto py-2">
                <CloseCircleOutlined className="text-orange-500 mr-1" />
                <span>驳回修改</span>
              </Radio.Button>
              <Radio.Button value="resubmit" className="text-center h-auto py-2">
                <SyncOutlined className="text-blue-500 mr-1" />
                <span>重新提审</span>
              </Radio.Button>
              <Radio.Button value="ban_destroy" className="text-center h-auto py-2">
                <DeleteOutlined className="text-red-500 mr-1" />
                <span>违规销毁</span>
              </Radio.Button>
            </div>
          </Radio.Group>
        </div>

        {/* Dynamic options based on decision */}
        {decision === "approve" && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              通过后的初始状态
            </label>
            <Radio.Group
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value)}
            >
              <Radio value="active">
                <span className="font-bold text-emerald-700">可用 (active) - 立即开放播放</span>
              </Radio>
              <Radio value="disabled">
                <span className="font-bold text-amber-700">禁用 (disabled) - 仅可检索，暂不开放播</span>
              </Radio>
            </Radio.Group>
          </div>
        )}

        {decision === "ban_destroy" && (
          <Alert
            type="error"
            showIcon
            message="高风险操作"
            description="执行违规销毁后，将立即从七牛云物理删除曲目的音频、封面和歌词文件，并永久清理关联记录！"
          />
        )}

        {/* Reason TextArea */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            审核说明 / 驳回或销毁原因{" "}
            {decision === "reject" || decision === "ban_destroy" ? (
              <span className="text-red-500">* (必填)</span>
            ) : (
              "(可选)"
            )}
          </label>
          <TextArea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              decision === "reject"
                ? "例如: 音频音质受损严重或歌名歌手与音频不符，请重新上传。"
                : decision === "ban_destroy"
                ? "例如: 严重涉及违规内容，已予以物理销毁。"
                : "例如: 审核通过，音质与元数据完备。"
            }
          />
        </div>
      </div>
    </Modal>
  );
}
