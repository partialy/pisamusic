import {
  Button,
  Descriptions,
  Image,
  Modal,
  Tag,
  Typography,
} from "antd";
import { MessageOutlined } from "@ant-design/icons";
import { MODAL_BODY_SCROLL_CLASS, MODAL_WIDTH } from "../../constants/theme";
import { ModalTitle } from "../ui/ModalTitle";
import type { AdminFeedbackDetail, FeedbackStatus } from "../../types/config";
import { FEEDBACK_TYPE_LABELS, formatFeedbackTime } from "../../utils/feedback";

const { Text } = Typography;

type Props = {
  feedback: AdminFeedbackDetail;
  updating: boolean;
  themeColor: string;
  onStatusChange: (status: FeedbackStatus) => void;
  onClose: () => void;
};

function displayDeviceValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "string") return value || "-";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export default function FeedbackDetailModal({
  feedback,
  updating,
  themeColor: _,
  onStatusChange,
  onClose,
}: Props) {
  const deviceEntries = Object.entries(feedback.device || {});
  const isProcessed = feedback.status === "processed";
  const nextStatus: FeedbackStatus = isProcessed ? "pending" : "processed";

  return (
    <Modal
      open
      centered
      title={
        <ModalTitle
          icon={<MessageOutlined className="text-blue-500" />}
          title="反馈详情"
          extra={
            <>
              <Tag color="cyan" className="!mr-0">
                {FEEDBACK_TYPE_LABELS[feedback.feedbackType] || feedback.feedbackType}
              </Tag>
              <Tag color={isProcessed ? "success" : "warning"} className="!mr-0">
                {isProcessed ? "已处理" : "待处理"}
              </Tag>
            </>
          }
          idText={feedback.id}
        />
      }
      width={MODAL_WIDTH.lg}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button
          key="status"
          type="primary"
          loading={updating}
          onClick={() => onStatusChange(nextStatus)}
          className={isProcessed ? "!bg-amber-500 hover:!bg-amber-600" : "!bg-emerald-600 hover:!bg-emerald-700"}
        >
          {isProcessed ? "恢复为待处理" : "标记为已处理"}
        </Button>,
      ]}
      destroyOnClose
    >
      <div className={MODAL_BODY_SCROLL_CLASS}>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <h4 className="text-xs font-bold text-slate-700 mb-2">反馈内容描述</h4>
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-800">
            {feedback.description}
          </p>
        </div>

        <Descriptions
          bordered
          size="small"
          column={{ xxl: 2, xl: 2, lg: 2, md: 2, sm: 1, xs: 1 }}
          className="bg-slate-50/50 rounded-xl overflow-hidden"
        >
          <Descriptions.Item label="反馈 ID">
            <Text copyable={{ text: feedback.id }} className="font-mono text-xs">
              {feedback.id}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="联系方式">
            <Text copyable={feedback.contact ? { text: feedback.contact } : undefined} className="text-xs text-slate-700">
              {feedback.contact || "-"}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="提交时间">
            {formatFeedbackTime(feedback.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="处理时间">
            {feedback.processedAt ? formatFeedbackTime(feedback.processedAt) : "-"}
          </Descriptions.Item>
        </Descriptions>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-xs font-bold text-slate-700 mb-3">
            反馈图片 ({feedback.images.length} 张)
          </h4>
          {feedback.images.length === 0 ? (
            <div className="rounded-lg bg-slate-50 py-6 text-center text-xs text-slate-400">
              未上传图片
            </div>
          ) : (
            <Image.PreviewGroup>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {feedback.images.map((img, idx) => (
                  <div key={img} className="overflow-hidden rounded-lg border border-slate-200 shadow-2xs">
                    <Image
                      src={img}
                      alt={`反馈图片 ${idx + 1}`}
                      className="aspect-square object-cover w-full"
                    />
                  </div>
                ))}
              </div>
            </Image.PreviewGroup>
          )}
        </div>

        {deviceEntries.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="text-xs font-bold text-slate-700 mb-3">
              设备上报环境参数
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {deviceEntries.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs"
                >
                  <span className="font-mono font-semibold text-slate-500">{k}</span>
                  <Text copyable={{ text: displayDeviceValue(v) }} className="font-mono text-slate-800 truncate max-w-[240px]">
                    {displayDeviceValue(v)}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
