import { Button, Descriptions, Modal, Space, Tag, Typography } from "antd";
import type { FileRecordInfo } from "../../types/config";

const { Text } = Typography;

type Props = {
  file: FileRecordInfo;
  themeColor?: string;
  onClose: () => void;
};

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

function usageText(file: FileRecordInfo): string {
  if (file.usageType === "desktop-update") return "PC 自动更新文件";
  if (file.usageType === "cloud-music") return "网盘音乐";
  return "发布安装包";
}

function referencesText(file: FileRecordInfo): string {
  return file.referencedBy.length ? file.referencedBy.join("、") : "无引用";
}

function assetTypeText(file: FileRecordInfo): string {
  if (file.assetType === "installer") return "安装包";
  if (file.assetType === "latest-yml") return "latest.yml";
  if (file.assetType === "blockmap") return "blockmap";
  if (file.assetType === "audio") return "音频";
  if (file.assetType === "cover-uploaded") return "手动封面";
  if (file.assetType === "cover-extracted") return "内嵌封面";
  if (file.assetType === "lyrics") return "歌词";
  return file.assetType || "-";
}

function statusTag(file: FileRecordInfo) {
  if (file.status === "pending") return <Tag color="warning">待上传</Tag>;
  if (file.status === "uploaded") return <Tag color="success">已上传</Tag>;
  return <Tag color="default">已删除</Tag>;
}

export default function FileRecordDetailModal({ file, onClose }: Props) {
  return (
    <Modal
      open
      centered
      title={
        <Space align="center" size={8}>
          <span className="text-base font-bold text-slate-800">文件记录详情</span>
          <span className="text-xs font-mono text-slate-400">({file.id})</span>
        </Space>
      }
      width={860}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
        <Descriptions
          bordered
          size="small"
          column={{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }}
          className="bg-slate-50/50 rounded-xl overflow-hidden"
        >
          <Descriptions.Item label="记录 ID">
            <Text copyable={{ text: file.id }} className="font-mono text-xs">
              {file.id}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="文件名" span={2}>
            <Text strong className="font-mono text-xs text-slate-800">
              {file.fileName || "-"}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="用途">
            <Tag color="geekblue">{usageText(file)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="平台 / 版本">
            <span className="font-mono text-xs">
              {[file.platform, file.version].filter(Boolean).join(" / ") || "-"}
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="资源类型">
            <Tag color="cyan">{assetTypeText(file)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="存储服务">
            {file.provider || "qiniu"}
          </Descriptions.Item>
          <Descriptions.Item label="Bucket 空间">
            <Text className="font-mono text-xs">{file.bucket || "-"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="文件状态">
            {statusTag(file)}
          </Descriptions.Item>
          <Descriptions.Item label="MIME 类型">
            <span className="font-mono text-xs">{file.mimeType || "-"}</span>
          </Descriptions.Item>
          <Descriptions.Item label="文件大小" span={2}>
            <span className="font-mono text-xs font-bold">
              {formatFileSize(file.fileSize)} ({file.fileSize || 0} bytes)
            </span>
          </Descriptions.Item>
          <Descriptions.Item label="上传时间">
            {formatDate(file.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="删除时间" span={2}>
            {formatDate(file.deletedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="七牛对象 Key" span={3}>
            <Text copyable={{ text: file.objectKey }} className="font-mono text-xs text-slate-700 break-all">
              {file.objectKey || "-"}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="Hash / ETag" span={3}>
            <Text copyable={{ text: file.hash }} className="font-mono text-xs text-slate-500 break-all">
              {file.hash || "-"}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="下载入口地址" span={3}>
            {file.downloadUrl ? (
              <a
                href={file.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-blue-600 hover:underline break-all"
              >
                {file.downloadUrl}
              </a>
            ) : (
              "-"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="当前关联引用" span={3}>
            <span className="text-xs text-slate-700 break-all">
              {referencesText(file)}
            </span>
          </Descriptions.Item>
        </Descriptions>
      </div>
    </Modal>
  );
}
