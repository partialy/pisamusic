import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Input,
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
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { AdminUserFilter, AdminUserListItem } from "../../types/config";
import { formatTimestamp } from "../../utils/date";

const { Text } = Typography;

type Props = {
  users: AdminUserListItem[];
  total: number;
  offset: number;
  limit: number;
  filter: AdminUserFilter;
  loading: boolean;
  deletingId: string | null;
  themeColor: string;
  onFilterChange: (filter: AdminUserFilter) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onView: (user: AdminUserListItem) => void;
  onEdit: (user: AdminUserListItem) => void;
  onDelete: (user: AdminUserListItem) => void;
};

export default function UserManagementTab({
  users,
  total,
  offset,
  limit,
  filter,
  loading,
  deletingId,
  onFilterChange,
  onPageChange,
  onRefresh,
  onView,
  onEdit,
  onDelete,
}: Props) {
  const [keyword, setKeyword] = useState(filter.keyword ?? "");

  useEffect(() => {
    setKeyword(filter.keyword ?? "");
  }, [filter.keyword]);

  const handleSearch = () => {
    onFilterChange({ keyword: keyword.trim() || undefined });
  };

  const handleReset = () => {
    setKeyword("");
    onFilterChange({});
  };

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: "用户",
      key: "user",
      width: 260,
      render: (_, record) => {
        const avatarSrc = record.avatarUrl || record.avatar;
        const isVip = Boolean(record.vip || (record.vipEnabled && record.vipExpiresAt && record.vipExpiresAt > Date.now()));
        return (
          <Space size={12} align="center" className="min-w-0">
            <Avatar
              size={40}
              src={avatarSrc}
              icon={!avatarSrc ? <UserOutlined /> : undefined}
              className="shrink-0 border border-slate-200 shadow-sm"
            >
              {!avatarSrc ? record.username.slice(0, 1).toUpperCase() : undefined}
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Text strong ellipsis className="max-w-[140px] text-slate-800" title={record.username}>
                  {record.username}
                </Text>
                {isVip && (
                  <Tag color="gold" className="!mr-0 text-[10px] font-extrabold italic">
                    VIP
                  </Tag>
                )}
              </div>
              <Tooltip title={record.id}>
                <Text type="secondary" className="block text-xs font-mono truncate max-w-[160px]">
                  {record.id}
                </Text>
              </Tooltip>
            </div>
          </Space>
        );
      },
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      width: 220,
      render: (email: string) => (
        <Text copyable={{ text: email }} className="text-slate-700 font-mono text-sm">
          {email || "-"}
        </Text>
      ),
    },
    {
      title: "同步版本",
      dataIndex: "syncVersion",
      key: "syncVersion",
      width: 100,
      align: "center",
      render: (version: number) => (
        <Tag color="blue" className="font-mono">
          v{version}
        </Tag>
      ),
    },
    {
      title: "数据统计",
      key: "stats",
      width: 320,
      render: (_, record) => (
        <Space size={[4, 4]} wrap>
          <Tag color="cyan">歌曲 {record.stats.favoriteSongs}</Tag>
          <Tag color="geekblue">收藏歌单 {record.stats.favoritePlaylists}</Tag>
          <Tag color="purple">自建歌单 {record.stats.userPlaylists}</Tag>
          <Tag color="orange">听歌 {record.stats.listeningTracks ?? 0}</Tag>
        </Space>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (ts: number) => (
        <Text type="secondary" className="text-xs">
          {formatTimestamp(ts)}
        </Text>
      ),
    },
    {
      title: "最后登录",
      dataIndex: "lastLoginAt",
      key: "lastLoginAt",
      width: 120,
      render: (ts: number | null) => (
        <Text type="secondary" className="text-xs">
          {ts ? formatTimestamp(ts) : "-"}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onView(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除该用户？"
            description={`确定删除 "${record.username}" 吗？该账号的收藏与歌单数据将被级联删除。`}
            onConfirm={() => onDelete(record)}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              loading={deletingId === record.id}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Card
        bordered={false}
        className="shadow-sm rounded-2xl"
        title={
          <div>
            <span className="text-lg font-bold text-slate-800">用户管理</span>
            <span className="ml-2 text-xs font-normal text-slate-500">
              共 {total} 位注册用户
            </span>
          </div>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder="搜索用户 ID、邮箱或用户名"
            prefix={<SearchOutlined className="text-slate-400" />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
            className="w-full sm:w-80"
          />
          <Button type="primary" onClick={handleSearch}>
            查询
          </Button>
          <Button onClick={handleReset} disabled={!keyword && !filter.keyword}>
            重置
          </Button>
        </div>

        <Table<AdminUserListItem>
          rowKey="id"
          columns={columns}
          dataSource={users}
          loading={loading}
          size="middle"
          scroll={{ x: 1530 }}
          sticky={{ offsetHeader: 0 }}
          bordered
          pagination={{
            current: Math.floor(offset / limit) + 1,
            pageSize: limit,
            total,
            showTotal: (t) => `共 ${t} 条记录`,
            showQuickJumper: true,
            onChange: (page) => onPageChange((page - 1) * limit),
          }}
        />
      </Card>
    </div>
  );
}
