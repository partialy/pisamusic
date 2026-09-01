import {
  Button,
  Card,
  Popconfirm,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  DeleteOutlined,
  EditOutlined,
  NotificationOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { Announcement } from "../../types/config";

const { Text } = Typography;

type Props = {
  announcements: Announcement[];
  themeColor: string;
  onAdd: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
};

export default function AnnouncementsTab({
  announcements,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const columns: ColumnsType<Announcement & { index: number }> = [
    {
      title: "序号",
      dataIndex: "index",
      key: "index",
      width: 70,
      align: "center",
      render: (index: number) => (
        <Tag color="indigo" className="!mr-0 font-bold">
          #{index + 1}
        </Tag>
      ),
    },
    {
      title: "公告 ID",
      dataIndex: "id",
      key: "id",
      width: 180,
      render: (id: string) => (
        <Text copyable={{ text: id }} strong className="font-mono text-xs text-slate-800">
          {id}
        </Text>
      ),
    },
    {
      title: "发布人",
      dataIndex: "publisher",
      key: "publisher",
      width: 130,
      render: (publisher: string) => (
        <Text strong className="text-xs text-slate-700">
          {publisher || "-"}
        </Text>
      ),
    },
    {
      title: "展示时间",
      dataIndex: "time",
      key: "time",
      width: 160,
      render: (time: string) => (
        <span className="font-mono text-xs text-slate-500">
          {time || "-"}
        </span>
      ),
    },
    {
      title: "按钮文案",
      dataIndex: "confirmText",
      key: "confirmText",
      width: 120,
      render: (text: string) => (
        <Tag color="default">{text || "知道了"}</Tag>
      ),
    },
    {
      title: "展示策略与动作",
      key: "policies",
      width: 220,
      render: (_, record) => (
        <div className="flex flex-wrap gap-1">
          {record.showEveryTime ? (
            <Tag color="processing">每次展示</Tag>
          ) : (
            <Tag color="default">仅展示一次</Tag>
          )}
          {record.showGotoButton && (
            <Tag color="success">含前往链接</Tag>
          )}
        </div>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record.index)}
          >
            编辑
          </Button>

          <Popconfirm
            title="确认删除该条公告？"
            description="删除后客户端将不再弹窗展示此公告。"
            onConfirm={() => onDelete(record.index)}
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const dataSource = announcements.map((item, index) => ({
    ...item,
    index,
  }));

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Card
        bordered={false}
        className="shadow-sm rounded-2xl"
        title={
          <div className="flex items-center gap-2">
            <NotificationOutlined className="text-indigo-500 text-lg" />
            <span className="text-lg font-bold text-slate-800">系统公告管理</span>
            <span className="text-xs font-normal text-slate-500">
              共 {announcements.length} 条公告
            </span>
          </div>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={onAdd}
          >
            发布新公告
          </Button>
        }
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={dataSource}
          size="middle"
          scroll={{ x: 1000 }}
          bordered
          pagination={false}
        />
      </Card>
    </div>
  );
}
