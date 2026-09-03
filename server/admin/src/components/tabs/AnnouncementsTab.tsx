import { useState } from "react";
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
  EyeOutlined,
  NotificationOutlined,
  PlusOutlined,
  ReadOutlined,
} from "@ant-design/icons";
import type { Announcement } from "../../types/config";
import AnnouncementPreviewModal from "../modals/AnnouncementPreviewModal";
import AnnouncementReadListModal from "../modals/AnnouncementReadListModal";

const { Text } = Typography;

function actionCount(announcement: Announcement): number {
  return announcement.content.blocks.filter((block) => block.type === "highlight" && block.action.type !== "none").length;
}

function contentSummary(announcement: Announcement): string {
  const text = announcement.content.blocks
    .filter((block) => block.type !== "image")
    .map((block) => block.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text || "（图片公告）";
}

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
  const [previewAnnouncement, setPreviewAnnouncement] = useState<Announcement | null>(null);
  const [readAnnouncement, setReadAnnouncement] = useState<Announcement | null>(null);

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
      title: "内容",
      key: "content",
      width: 260,
      render: (_, record) => (
        <div className="min-w-0">
          <Text ellipsis={{ tooltip: contentSummary(record) }} className="block max-w-[220px] text-xs text-slate-700">
            {contentSummary(record)}
          </Text>
          <div className="mt-1 flex flex-wrap gap-1">
            <Tag color="purple">{record.content.blocks.filter((block) => block.type === "image").length} 张图</Tag>
            <Tag color="orange">{actionCount(record)} 个动作</Tag>
          </div>
        </div>
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
      title: "状态",
      key: "enabled",
      width: 90,
      align: "center",
      render: (_, record) => (
        <Tag color={record.enabled !== false ? "success" : "default"}>
          {record.enabled !== false ? "已启用" : "已停用"}
        </Tag>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 270,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setPreviewAnnouncement(record)}
          >
            预览
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record.index)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<ReadOutlined />}
            onClick={() => setReadAnnouncement(record)}
          >
            已读列表
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
      {previewAnnouncement && (
        <AnnouncementPreviewModal
          announcement={previewAnnouncement}
          open
          onClose={() => setPreviewAnnouncement(null)}
        />
      )}
      {readAnnouncement && (
        <AnnouncementReadListModal
          announcement={readAnnouncement}
          open
          onClose={() => setReadAnnouncement(null)}
        />
      )}
    </div>
  );
}
