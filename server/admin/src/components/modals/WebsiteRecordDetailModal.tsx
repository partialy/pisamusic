import { Button, Descriptions, Modal, Space, Tag, Typography } from "antd";
import type {
  AdminWebsiteDownloadDetail,
  AdminWebsiteVisitDetail,
} from "../../types/config";
import { formatTimestamp } from "../../utils/date";

const { Text } = Typography;

type Props =
  | {
      recordType: "visit";
      record: AdminWebsiteVisitDetail;
      themeColor?: string;
      onClose: () => void;
    }
  | {
      recordType: "download";
      record: AdminWebsiteDownloadDetail;
      themeColor?: string;
      onClose: () => void;
    };

export default function WebsiteRecordDetailModal(props: Props) {
  if (props.recordType === "visit") {
    const record = props.record;
    return (
      <Modal
        open
        centered
        title={
          <Space align="center" size={8}>
            <span className="text-base font-bold text-slate-800">访问记录详情</span>
            <span className="text-xs font-mono text-slate-400">({record.id})</span>
          </Space>
        }
        width={800}
        onCancel={props.onClose}
        footer={[
          <Button key="close" type="primary" onClick={props.onClose}>
            关闭
          </Button>,
        ]}
        destroyOnClose
      >
        <div className="space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
          <Descriptions
            bordered
            size="small"
            column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
            className="bg-slate-50/50 rounded-xl overflow-hidden"
          >
            <Descriptions.Item label="记录 ID">
              <Text copyable={{ text: record.id }} className="font-mono text-xs">
                {record.id}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="访问日期">
              {record.visitDay}
            </Descriptions.Item>
            <Descriptions.Item label="访问时间">
              {formatTimestamp(record.createdAt)} ({record.createdAt})
            </Descriptions.Item>
            <Descriptions.Item label="IP 地址">
              <Text copyable={{ text: record.ipAddress }} className="font-mono text-xs">
                {record.ipAddress || "-"}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="访问路径" span={2}>
              <Text copyable={{ text: record.path }} className="font-mono text-xs">
                {record.path || "/"}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="来源页面 (Referrer)" span={2}>
              <Text className="text-xs text-slate-700 break-all">
                {record.referrer || "-"}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="访客哈希 (Visitor Hash)" span={2}>
              <Text copyable={{ text: record.visitorHash }} className="font-mono text-xs text-slate-500 break-all">
                {record.visitorHash || "-"}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="语言">
              {record.language || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="时区">
              {record.timezone || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="屏幕分辨率" span={2}>
              {record.screenWidth} × {record.screenHeight} px
            </Descriptions.Item>
            <Descriptions.Item label="User-Agent" span={2}>
              <div className="rounded-lg bg-slate-100 p-2 font-mono text-xs text-slate-700 break-all leading-5">
                {record.userAgent || "-"}
              </div>
            </Descriptions.Item>
          </Descriptions>
        </div>
      </Modal>
    );
  }

  const record = props.record;
  return (
    <Modal
      open
      centered
      title={
        <Space align="center" size={8}>
          <span className="text-base font-bold text-slate-800">下载记录详情</span>
          <span className="text-xs font-mono text-slate-400">({record.id})</span>
        </Space>
      }
      width={800}
      onCancel={props.onClose}
      footer={[
        <Button key="close" type="primary" onClick={props.onClose}>
          关闭
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
        <Descriptions
          bordered
          size="small"
          column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
          className="bg-slate-50/50 rounded-xl overflow-hidden"
        >
          <Descriptions.Item label="记录 ID">
            <Text copyable={{ text: record.id }} className="font-mono text-xs">
              {record.id}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="下载日期">
            {record.downloadDay}
          </Descriptions.Item>
          <Descriptions.Item label="下载时间">
            {formatTimestamp(record.createdAt)} ({record.createdAt})
          </Descriptions.Item>
          <Descriptions.Item label="平台">
            <Tag color={record.platform === "desktop" ? "blue" : "green"}>
              {record.platform === "desktop" ? "PC（desktop）" : "Android（android）"}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="版本号">
            <Text strong className="font-mono text-xs">
              {record.version || "-"}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="IP 地址">
            <Text copyable={{ text: record.ipAddress }} className="font-mono text-xs">
              {record.ipAddress || "-"}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="文件记录 ID" span={2}>
            <Text copyable={record.fileRecordId ? { text: record.fileRecordId } : undefined} className="font-mono text-xs">
              {record.fileRecordId || "-"}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="来源页面 (Referrer)" span={2}>
            <Text className="text-xs text-slate-700 break-all">
              {record.referrer || "-"}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="User-Agent" span={2}>
            <div className="rounded-lg bg-slate-100 p-2 font-mono text-xs text-slate-700 break-all leading-5">
              {record.userAgent || "-"}
            </div>
          </Descriptions.Item>
        </Descriptions>
      </div>
    </Modal>
  );
}
