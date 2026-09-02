import {
  Avatar,
  Button,
  Descriptions,
  Modal,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { UserOutlined } from "@ant-design/icons";
import type {
  AdminUserDetail,
  AdminDirectMessagePage,
  AdminUserDetailTab,
  AdminUserLibraryItem,
  AdminUserLibraryPage,
} from "../../types/config";
import { formatTimestamp } from "../../utils/date";
import UserDirectMessagesPanel from "../user/UserDirectMessagesPanel";

const { Text } = Typography;

type Props = {
  user: AdminUserDetail;
  activeKind: AdminUserDetailTab;
  libraryPage: AdminUserLibraryPage;
  libraryLoading: boolean;
  messagesPage: AdminDirectMessagePage;
  messagesLoading: boolean;
  themeColor: string;
  onKindChange: (kind: AdminUserDetailTab) => void;
  onPageChange: (offset: number) => void;
  onClose: () => void;
};

function sourceText(source: string): string {
  if (source === "kg") return "酷狗";
  if (source === "wy") return "网易";
  if (source === "kw") return "酷我";
  if (source === "cloud") return "云盘";
  if (source === "local") return "本地";
  return source || "-";
}

function formatDuration(ms?: number | null): string {
  if (!ms || ms <= 0) return "0 秒";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours} 小时 ${minutes} 分`;
  }
  if (minutes > 0) {
    return `${minutes} 分 ${seconds} 秒`;
  }
  return `${seconds} 秒`;
}

export default function UserDetailModal({
  user,
  activeKind,
  libraryPage,
  libraryLoading,
  messagesPage,
  messagesLoading,
  onKindChange,
  onPageChange,
  onClose,
}: Props) {
  const isVip = Boolean(
    user.vip ||
      (user.vipEnabled && user.vipExpiresAt && user.vipExpiresAt > Date.now())
  );

  const libraryColumns: ColumnsType<AdminUserLibraryItem> = activeKind === "listeningHistory"
    ? [
        {
          title: "歌曲名称",
          dataIndex: "name",
          key: "name",
          ellipsis: true,
          render: (name: string) => (
            <Text strong className="text-slate-800">
              {name || "-"}
            </Text>
          ),
        },
        {
          title: "歌手 / 专辑",
          dataIndex: "subtitle",
          key: "subtitle",
          ellipsis: true,
          render: (sub: string) => <span className="text-slate-600 text-xs">{sub || "-"}</span>,
        },
        {
          title: "来源",
          dataIndex: "source",
          key: "source",
          width: 80,
          align: "center",
          render: (source: string) => <Tag color="blue">{sourceText(source)}</Tag>,
        },
        {
          title: "累计收听",
          key: "listened",
          width: 130,
          render: (_, item) => (
            <Text className="text-xs text-slate-700 font-mono">
              {formatDuration(item.listenedMs)}
            </Text>
          ),
        },
        {
          title: "播放次数",
          key: "playCounts",
          width: 170,
          render: (_, item) => (
            <Space size={4}>
              <Tag color="cyan">播放 {item.playCount ?? 0}</Tag>
              <Tag color="green">完播 {item.completedCount ?? 0}</Tag>
            </Space>
          ),
        },
        {
          title: "最近收听",
          dataIndex: "lastListenedAt",
          key: "lastListenedAt",
          width: 160,
          render: (ts: number | undefined) => (
            <Text type="secondary" className="text-xs">
              {ts ? formatTimestamp(ts) : "-"}
            </Text>
          ),
        },
      ]
    : [
        {
          title: "名称",
          dataIndex: "name",
          key: "name",
          ellipsis: true,
          render: (name: string) => (
            <Text strong className="text-slate-800">
              {name || "-"}
            </Text>
          ),
        },
        {
          title: "来源",
          dataIndex: "source",
          key: "source",
          width: 90,
          align: "center",
          render: (source: string) => <Tag color="blue">{sourceText(source)}</Tag>,
        },
        {
          title: "ID / 键值",
          key: "idKey",
          width: 180,
          ellipsis: true,
          render: (_, item) => (
            <Text copyable={{ text: item.itemId || item.itemKey }} className="font-mono text-xs text-slate-600">
              {item.itemId || item.itemKey}
            </Text>
          ),
        },
        {
          title: activeKind === "favoriteSongs" ? "歌手 / 专辑" : "描述 / 标签",
          dataIndex: "subtitle",
          key: "subtitle",
          ellipsis: true,
          render: (sub: string) => <span className="text-slate-600 text-xs">{sub || "-"}</span>,
        },
        {
          title: "更新时间",
          dataIndex: "serverUpdatedAt",
          key: "serverUpdatedAt",
          width: 170,
          render: (ts: number) => (
            <Text type="secondary" className="text-xs">
              {formatTimestamp(ts)}
            </Text>
          ),
        },
      ];

  const tabItems = [
    {
      key: "favoriteSongs",
      label: `收藏歌曲 (${user.stats.favoriteSongs})`,
    },
    {
      key: "favoritePlaylists",
      label: `收藏歌单 (${user.stats.favoritePlaylists})`,
    },
    {
      key: "userPlaylists",
      label: `自建歌单 (${user.stats.userPlaylists})`,
    },
    {
      key: "listeningHistory",
      label: `听歌历史 (${user.stats.listeningTracks ?? 0})`,
    },
    {
      key: "messages",
      label: "留言记录",
    },
  ];

  return (
    <Modal
      open
      centered
      title={
        <Space align="center" size={12}>
          <Avatar
            size={36}
            src={user.avatarUrl || user.avatar}
            icon={<UserOutlined />}
            className="border border-slate-200 shadow-sm"
          />
          <div>
            <span className="text-base font-bold text-slate-800">{user.username}</span>
            <span className="ml-2 text-xs font-mono text-slate-400">({user.id})</span>
          </div>
        </Space>
      }
      width={960}
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
          column={{ xxl: 4, xl: 4, lg: 2, md: 2, sm: 1, xs: 1 }}
          className="bg-slate-50/50 rounded-xl overflow-hidden"
        >
          <Descriptions.Item label="邮箱">{user.email || "-"}</Descriptions.Item>
          <Descriptions.Item label="同步版本">
            <Tag color="cyan">v{user.syncVersion}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="VIP 状态">
            {isVip ? (
              <Tag color="gold">
                VIP (至 {formatTimestamp(user.vipExpiresAt)})
              </Tag>
            ) : (
              <Tag color="default">未开通</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="注册时间">
            {formatTimestamp(user.createdAt)}
          </Descriptions.Item>
          <Descriptions.Item label="最后登录">
            {user.lastLoginAt ? formatTimestamp(user.lastLoginAt) : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="资料更新">
            {formatTimestamp(user.updatedAt)}
          </Descriptions.Item>
          <Descriptions.Item label="累计听歌">
            <span className="font-mono text-slate-700">
              {formatDuration(user.stats.listeningTotalMs)}
            </span>
            <span className="text-slate-400 text-xs ml-1">
              ({user.stats.listeningTracks ?? 0} 首)
            </span>
          </Descriptions.Item>
        </Descriptions>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4">
          <Tabs
            activeKey={activeKind}
            onChange={(key) => onKindChange(key as AdminUserDetailTab)}
            items={tabItems}
          />
          {activeKind === "messages" ? (
            <UserDirectMessagesPanel
              page={messagesPage}
              loading={messagesLoading}
              onPageChange={onPageChange}
            />
          ) : (
            <Table<AdminUserLibraryItem>
              rowKey="itemKey"
              columns={libraryColumns}
              dataSource={libraryPage.items}
              loading={libraryLoading}
              size="small"
              bordered
              pagination={{
                current: Math.floor(libraryPage.offset / libraryPage.limit) + 1,
                pageSize: libraryPage.limit,
                total: libraryPage.total,
                showTotal: (total) => `共 ${total} 项`,
                showQuickJumper: true,
                onChange: (page) => onPageChange((page - 1) * libraryPage.limit),
              }}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
