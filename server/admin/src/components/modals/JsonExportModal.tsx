import { Button, message, Modal, Space, Typography } from "antd";
import { CopyOutlined, FileTextOutlined } from "@ant-design/icons";
import type { PisaAdminExport } from "../../types/config";

const { Text } = Typography;

type Props = {
  exportData: PisaAdminExport;
  themeColor: string;
  onClose: () => void;
};

export default function JsonExportModal({ exportData, onClose }: Props) {
  const text = JSON.stringify(exportData, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      void message.success("JSON 配置已复制到剪贴板！");
    } catch {
      window.alert("复制失败，请检查剪贴板权限。");
    }
  };

  return (
    <Modal
      open
      centered
      title={
        <Space>
          <FileTextOutlined className="text-blue-500" />
          <span className="font-bold text-slate-800">导出 JSON 配置快照</span>
        </Space>
      }
      width={840}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button
          key="copy"
          type="primary"
          icon={<CopyOutlined />}
          onClick={() => void handleCopy()}
        >
          复制全部配置 JSON
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="space-y-3 pt-2">
        <Text type="secondary" className="text-xs">
          包含系统配置、公告列表与版本发布历史的完整聚合 JSON 数据。
        </Text>
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-emerald-400 leading-relaxed shadow-inner">
          {text}
        </pre>
      </div>
    </Modal>
  );
}
