import {
  Alert,
  Descriptions,
  Modal,
  Space,
  Tag,
  Typography,
} from "antd";
import type {
  FileRecordInfo,
  UpdateHistoryDeletionPreview,
} from "../../types/config";

const { Text } = Typography;

type Props = {
  preview: UpdateHistoryDeletionPreview;
  themeColor: string;
  deleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const ASSET_ORDER = ["installer", "latest-yml", "blockmap"];

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "-";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function assetTypeText(file: FileRecordInfo): string {
  if (file.assetType === "installer") return "安装包";
  if (file.assetType === "latest-yml") return "latest.yml";
  if (file.assetType === "blockmap") return "blockmap";
  return file.assetType || "其他文件";
}

function platformText(platform: string): string {
  if (platform === "desktop") return "PC 版";
  if (platform === "android") return "Android";
  return platform;
}

function sortFiles(files: FileRecordInfo[]): FileRecordInfo[] {
  return [...files].sort((a, b) => {
    const aOrder = ASSET_ORDER.includes(a.assetType)
      ? ASSET_ORDER.indexOf(a.assetType)
      : ASSET_ORDER.length;
    const bOrder = ASSET_ORDER.includes(b.assetType)
      ? ASSET_ORDER.indexOf(b.assetType)
      : ASSET_ORDER.length;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.fileName.localeCompare(b.fileName);
  });
}

export default function UpdateHistoryDeletePreviewModal({
  preview,
  deleting,
  onClose,
  onConfirm,
}: Props) {
  const files = sortFiles(preview.files);
  const { history } = preview;

  return (
    <Modal
      open
      centered
      title={
        <Space align="center" size={8}>
          <span className="text-base font-bold text-slate-800">
            删除版本及文件确认
          </span>
          <Tag color="geekblue" className="font-mono">
            {history.version}
          </Tag>
        </Space>
      }
      width={720}
      onCancel={deleting ? undefined : onClose}
      onOk={onConfirm}
      confirmLoading={deleting}
      okText="确认删除版本及文件"
      okButtonProps={{ danger: true }}
      cancelText="取消"
      destroyOnClose
    >
      <div className="space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
        <Alert
          type="warning"
          showIcon
          message="发布历史记录将被逻辑删除"
          description={
            files.length > 0
              ? "下列关联的七牛对象将被物理删除，本地文件记录将标记为 deleted 并同步清理关联引用。"
              : "该版本无关联已上传文件，仅清理版本历史记录。"
          }
        />

        <Descriptions
          bordered
          size="small"
          column={3}
          className="bg-slate-50/50 rounded-xl overflow-hidden"
        >
          <Descriptions.Item label="平台">
            <Tag color={history.platform === "desktop" ? "blue" : "green"}>
              {platformText(history.platform)}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="版本号">
            <Text strong className="font-mono text-xs">
              {history.version}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="关联文件">
            <span className="font-bold text-red-600">{files.length} 个</span>
          </Descriptions.Item>
        </Descriptions>

        <div>
          <h4 className="mb-2 text-xs font-bold text-slate-700">
            将物理删除的七牛文件对象：
          </h4>

          {files.length > 0 ? (
            <div className="space-y-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Tag color="geekblue">{assetTypeText(file)}</Tag>
                      <Text strong className="font-mono text-xs text-slate-800">
                        {file.fileName || file.id}
                      </Text>
                      <span className="text-xs text-slate-400">
                        ({formatFileSize(file.fileSize)})
                      </span>
                    </div>
                    <Tag color="error">将物理删除</Tag>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                    <div>
                      <span className="font-semibold">对象 Key：</span>
                      <Text copyable={{ text: file.objectKey }} className="font-mono text-[11px] text-slate-700">
                        {file.objectKey}
                      </Text>
                    </div>
                    <div>
                      <span className="font-semibold">关联引用：</span>
                      <span>
                        {file.referencedBy.length
                          ? file.referencedBy.join("、")
                          : "无其他引用"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-400">
              无关联七牛文件需要物理删除
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
