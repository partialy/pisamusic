import { Popconfirm, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { AdminDirectMessageItem, AdminDirectMessagePage } from "../../types/config";
import { formatTimestamp } from "../../utils/date";

const { Text } = Typography;

type Props = {
  page: AdminDirectMessagePage;
  loading: boolean;
  onPageChange: (offset: number) => void;
  onDelete: (id: string) => void;
};

export default function UserDirectMessagesPanel({ page, loading, onPageChange, onDelete }: Props) {
  const columns: ColumnsType<AdminDirectMessageItem> = [
    {
      title: "正文",
      dataIndex: "content",
      key: "content",
      ellipsis: true,
      render: (content: string) => <Text className="text-slate-800 whitespace-pre-wrap">{content}</Text>,
    },
    {
      title: "发送人",
      dataIndex: "createdByAdmin",
      key: "createdByAdmin",
      width: 130,
      ellipsis: true,
      render: (value: string) => <Text className="font-mono text-xs text-slate-600">{value || "-"}</Text>,
    },
    {
      title: "发送时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 165,
      render: (timestamp: number) => <Text type="secondary" className="text-xs">{formatTimestamp(timestamp)}</Text>,
    },
    {
      title: "状态",
      dataIndex: "read",
      key: "read",
      width: 90,
      align: "center",
      render: (read: boolean) => read ? <Tag color="green">已读</Tag> : <Tag color="orange">未读</Tag>,
    },
    {
      title: "已读时间",
      dataIndex: "readAt",
      key: "readAt",
      width: 165,
      render: (timestamp: number | null) => <Text type="secondary" className="text-xs">{timestamp ? formatTimestamp(timestamp) : "-"}</Text>,
    },
    {
      title: "操作",
      key: "actions",
      width: 90,
      align: "center",
      render: (_value, record) => (
        <Popconfirm
          title="确认删除这条留言吗？"
          description="删除后该留言将不再被客户端拉取。"
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => onDelete(record.id)}
        >
          <a className="text-red-500">删除</a>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Table<AdminDirectMessageItem>
      rowKey="id"
      columns={columns}
      dataSource={page.items}
      loading={loading}
      size="small"
      bordered
      scroll={{ x: 880 }}
      pagination={{
        current: Math.floor(page.offset / page.limit) + 1,
        pageSize: page.limit,
        total: page.total,
        showTotal: (total) => `共 ${total} 条留言`,
        showQuickJumper: true,
        onChange: (nextPage) => onPageChange((nextPage - 1) * page.limit),
      }}
    />
  );
}
