import {
  Button,
  Card,
  Popconfirm,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { UpdateHistoryItem } from "../../types/config";

const { Text } = Typography;

type Props = {
  displayHistory: UpdateHistoryItem[];
  themeColor: string;
  onPublishNew: () => void;
  onEdit: (item: UpdateHistoryItem) => void;
  onDeletePackage: (item: UpdateHistoryItem) => void;
  deletingPackageHistoryId: string | null;
  onDeleteHistory: (item: UpdateHistoryItem) => void;
  deletingHistoryId: string | null;
};

function getFileSourceText(item: UpdateHistoryItem): string {
  if (item.releaseFile?.status === "uploaded") return "七牛上传";
  if (item.releaseFile?.status === "deleted") return "安装包已删除";
  if (item.downloadUrl) return "直链地址";
  return "未配置安装包";
}

function getFileSourceTagColor(item: UpdateHistoryItem): string {
  if (item.releaseFile?.status === "uploaded") return "cyan";
  if (item.releaseFile?.status === "deleted") return "error";
  if (item.downloadUrl) return "purple";
  return "default";
}

function getCurrentHistoryIds(displayHistory: UpdateHistoryItem[]): Set<string> {
  const currentIds = new Set<string>();
  const platforms = new Set<string>();
  for (const item of displayHistory) {
    if (platforms.has(item.platform)) continue;
    platforms.add(item.platform);
    currentIds.add(item.id);
  }
  return currentIds;
}

export default function UpdateTab({
  displayHistory,
  onPublishNew,
  onEdit,
  onDeletePackage,
  deletingPackageHistoryId,
  onDeleteHistory,
  deletingHistoryId,
}: Props) {
  const currentHistoryIds = getCurrentHistoryIds(displayHistory);

  const columns: ColumnsType<UpdateHistoryItem> = [
    {
      title: "版本类型 / 平台",
      key: "statusPlatform",
      width: 170,
      render: (_, record) => {
        const isCurrent = currentHistoryIds.has(record.id);
        const isDesktop = record.platform === "desktop";
        return (
          <Space size={4} wrap>
            <Tag color={isCurrent ? "gold" : "default"}>
              {isCurrent ? "当前版本" : "历史版本"}
            </Tag>
            <Tag color={isDesktop ? "blue" : "green"}>
              {isDesktop ? "PC 版" : "Android"}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: "版本号",
      dataIndex: "version",
      key: "version",
      width: 120,
      render: (ver: string) => (
        <Text strong className="font-mono text-sm text-slate-800">
          {ver}
        </Text>
      ),
    },
    {
      title: "更新模式",
      dataIndex: "forceUpdate",
      key: "forceUpdate",
      width: 110,
      align: "center",
      render: (force: boolean) => (
        <Tag color={force ? "error" : "success"}>
          {force ? "强制更新" : "普通更新"}
        </Tag>
      ),
    },
    {
      title: "安装包来源",
      key: "fileSource",
      width: 130,
      align: "center",
      render: (_, record) => (
        <Tag color={getFileSourceTagColor(record)}>
          {getFileSourceText(record)}
        </Tag>
      ),
    },
    {
      title: "更新日志",
      dataIndex: "updateContent",
      key: "updateContent",
      ellipsis: true,
      render: (content: string) => (
        <Tooltip title={content} placement="topLeft">
          <span className="text-slate-600 text-xs truncate">{content || "-"}</span>
        </Tooltip>
      ),
    },
    {
      title: "发布时间",
      dataIndex: "updateTime",
      key: "updateTime",
      width: 180,
      render: (time: string) => (
        <Text type="secondary" className="text-xs">
          {time}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 230,
      render: (_, record) => {
        const isCurrent = currentHistoryIds.has(record.id);
        const hasUploadedFile = record.releaseFile?.status === "uploaded";
        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => onEdit(record)}
            >
              编辑
            </Button>

            {hasUploadedFile && (
              <Popconfirm
                title="确认删除安装包？"
                description="将从七牛云物理删除该版本安装包对象，保留发布记录。"
                onConfirm={() => onDeletePackage(record)}
                okText="确定删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="link"
                  danger
                  size="small"
                  icon={<DeleteOutlined />}
                  loading={deletingPackageHistoryId === record.id}
                >
                  删包
                </Button>
              </Popconfirm>
            )}

            {isCurrent ? (
              <Tooltip title="当前发布版本不可删除，请先发布替代版本">
                <Button
                  type="link"
                  disabled
                  size="small"
                  icon={<DeleteOutlined />}
                >
                  删除版本
                </Button>
              </Tooltip>
            ) : (
              <Button
                type="link"
                danger
                size="small"
                icon={<DeleteOutlined />}
                loading={deletingHistoryId === record.id}
                onClick={() => onDeleteHistory(record)}
              >
                删除版本
              </Button>
            )}
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
            <span className="text-lg font-bold text-slate-800">
              版本发布与更新历史
            </span>
            <span className="ml-2 text-xs font-normal text-slate-500">
              共 {displayHistory.length} 个历史版本
            </span>
          </div>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onPublishNew}
          >
            发布新版本
          </Button>
        }
      >
        <Table<UpdateHistoryItem>
          rowKey="id"
          columns={columns}
          dataSource={displayHistory}
          size="middle"
          scroll={{ x: 1200 }}
          sticky={{ offsetHeader: 0 }}
          bordered
          pagination={{
            pageSize: 15,
            showTotal: (total) => `共 ${total} 个版本`,
            showQuickJumper: true,
          }}
        />
      </Card>
    </div>
  );
}
