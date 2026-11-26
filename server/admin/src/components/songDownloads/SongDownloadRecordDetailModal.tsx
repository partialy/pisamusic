import { Button, Descriptions, Modal, Space, Tag, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { MODAL_BODY_SCROLL_CLASS, MODAL_WIDTH } from "../../constants/theme";
import { ModalTitle } from "../ui/ModalTitle";
import type { SongDownloadRecordItem } from "../../types/songDownloads";
import { formatDurationMs, resolveSongCoverUrl } from "../../utils/songCover";

const { Text } = Typography;

type Props = {
  record: SongDownloadRecordItem | null;
  onClose: () => void;
};

export default function SongDownloadRecordDetailModal({ record, onClose }: Props) {
  const coverSrc = record ? resolveSongCoverUrl(record.coverUrl, 240) : "";

  return (
    <Modal
      open={Boolean(record)}
      centered
      destroyOnClose
      title={
        <ModalTitle
          icon={<DownloadOutlined className="text-blue-500" />}
          title="下载动态详情"
          idText={record?.id}
        />
      }
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>,
      ]}
      width={MODAL_WIDTH.md}
    >
      {record && (
        <div className={MODAL_BODY_SCROLL_CLASS}>
          <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
            {coverSrc ? (
              <img
                src={coverSrc}
                alt={record.songName}
                className="h-16 w-16 shrink-0 rounded-xl object-cover bg-slate-200 shadow-sm"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-xs text-slate-400">
                无封面
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-base font-bold text-slate-800 truncate">{record.songName || "未知歌曲"}</div>
              <div className="text-xs text-slate-500 truncate">
                {record.singer || "未知歌手"}
                {record.album ? ` · ${record.album}` : ""}
              </div>
              <Space size={6} wrap>
                <Tag>{record.source.toUpperCase()}</Tag>
                <Tag color="geekblue" className="font-mono">{record.qualityKey}</Tag>
                <Tag color={record.platform === "android" ? "green" : "blue"}>
                  {record.platform === "android" ? "Android" : "PC"}
                </Tag>
              </Space>
            </div>
          </div>

          <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="歌曲 ID">
              <Text copyable className="font-mono text-xs">{record.songId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="歌曲时长">{formatDurationMs(record.durationMs)}</Descriptions.Item>
            <Descriptions.Item label="音源 / 音质">
              {record.source.toUpperCase()} / <span className="font-mono text-xs">{record.qualityKey}</span>
            </Descriptions.Item>
            <Descriptions.Item label="下载时间">
              {new Date(record.createdAt).toLocaleString("zh-CN")}
            </Descriptions.Item>

            <Descriptions.Item label="计费主体">
              <Space size={4}>
                <Tag color={record.subjectType === "user" ? "blue" : "purple"} className="!mr-0">
                  {record.subjectType === "user" ? "账号配额" : "游客设备配额"}
                </Tag>
                <Text copyable className="font-mono text-xs">{record.subjectKey}</Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="关联账号">
              {record.userId ? (
                <div className="space-y-0.5 text-xs">
                  <div className="font-medium text-slate-800">{record.username || "-"}</div>
                  {record.userEmail && <div className="text-slate-500">{record.userEmail}</div>}
                  <Text copyable className="font-mono text-xs text-slate-400">{record.userId}</Text>
                </div>
              ) : (
                <span className="text-slate-400">未登录（游客）</span>
              )}
            </Descriptions.Item>

            <Descriptions.Item label="关联设备">
              <div className="space-y-0.5 text-xs">
                <div className="font-medium text-slate-800">
                  {record.deviceName || "未命名设备"}（{record.deviceKind === "android" ? "Android" : "PC"}）
                </div>
                <Text copyable className="font-mono text-xs text-slate-400">{record.deviceId}</Text>
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="请求 IP">
              <span className="font-mono text-xs">{record.clientIp || "-"}</span>
            </Descriptions.Item>

            <Descriptions.Item label="服务端批次 ID">
              <Text copyable className="font-mono text-xs">{record.batchId}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="本批歌曲数">
              {record.batchItemCount} 首（日期 {record.downloadDay}）
            </Descriptions.Item>

            <Descriptions.Item label="客户端幂等 ID" span={2}>
              <Text copyable className="font-mono text-xs">{record.clientBatchId || "-"}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="记录 ID" span={2}>
              <Text copyable className="font-mono text-xs">{record.id}</Text>
            </Descriptions.Item>
          </Descriptions>
        </div>
      )}
    </Modal>
  );
}
