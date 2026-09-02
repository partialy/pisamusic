import { useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Image,
  Input,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ClearOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  SoundOutlined,
  StopOutlined,
  SyncOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { AdminOnlineRoomListItem } from "../../api/listenTogetherAdmin";
import { formatSeconds, formatTimestamp } from "../../utils/date";

const { Text } = Typography;

type Props = {
  items: AdminOnlineRoomListItem[];
  total: number;
  offset: number;
  limit: number;
  keyword: string;
  loading: boolean;
  autoRefresh: boolean;
  onKeywordChange: (keyword: string) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onAutoRefreshChange: (enabled: boolean) => void;
  onViewDetail: (room: AdminOnlineRoomListItem) => void;
  onDissolve: (room: AdminOnlineRoomListItem) => void;
};

const PLAYBACK_STATUS_MAP: Record<string, { label: string; color: string }> = {
  playing: { label: "播放中", color: "green" },
  paused: { label: "暂停", color: "orange" },
  ended: { label: "已放完", color: "default" },
};

export default function OnlineRoomTable({
  items,
  total,
  offset,
  limit,
  keyword,
  loading,
  autoRefresh,
  onKeywordChange,
  onPageChange,
  onRefresh,
  onAutoRefreshChange,
  onViewDetail,
  onDissolve,
}: Props) {
  const [localKeyword, setLocalKeyword] = useState(keyword);

  const handleSearch = () => {
    onKeywordChange(localKeyword.trim());
  };

  const handleReset = () => {
    setLocalKeyword("");
    onKeywordChange("");
  };

  const columns: ColumnsType<AdminOnlineRoomListItem> = [
    {
      title: "房间信息",
      key: "roomInfo",
      width: 200,
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.roomName}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Tag color="blue">房号</Tag>
            <Text copyable={{ text: r.roomId }} style={{ fontFamily: "monospace" }}>
              {r.roomId}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "房主",
      key: "host",
      width: 145,
      render: (_, r) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar
            src={r.host.avatarUrl}
            icon={<UserOutlined />}
            size={36}
            style={{ flexShrink: 0 }}
          />
          <div style={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                fontWeight: 500,
                fontSize: 13,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: 68,
              }}
              title={r.host.nickname || r.host.username || "匿名"}
            >
              {r.host.nickname || r.host.username || "匿名"}
            </span>
            <Text
              copyable={{
                text: r.host.userId,
                tooltips: ["复制房主ID", "已复制"],
              }}
            />
          </div>
        </div>
      ),
    },
    {
      title: "当前播放曲目",
      key: "song",
      minWidth: 230,
      render: (_, r) => {
        if (!r.song) {
          return <Text type="secondary">无曲目点播</Text>;
        }
        const statusConfig = PLAYBACK_STATUS_MAP[r.playbackStatus] ?? { label: r.playbackStatus, color: "default" };
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {r.song.cover ? (
              <Image
                src={r.song.cover.replace("{size}", "120")}
                width={42}
                height={42}
                style={{ borderRadius: 4, objectFit: "cover", flexShrink: 0 }}
                fallback="/static/account-avatars/default.jpg"
              />
            ) : (
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 4,
                  background: "#eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <SoundOutlined style={{ color: "#999" }} />
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Text strong style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>
                  {r.song.name}
                </Text>
                <Tag color="geekblue" style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
                  {r.song.source.toUpperCase()}
                </Tag>
              </div>
              <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
                {r.song.singer}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <Tag color={statusConfig.color} style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
                  {statusConfig.label}
                </Tag>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {formatSeconds(r.position)} / {formatSeconds(r.song.duration)}
                </Text>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "人数状态",
      key: "people",
      width: 210,
      render: (_, r) => (
        <div>
          <div>
            <Badge status="processing" color="green" />
            <Text strong style={{ color: "#52c41a" }}>
              {r.onlinePeople}
            </Text>
            <Text type="secondary"> 在线 / 入房 </Text>
            <Text strong>{r.currentPeople}</Text>
            <Text type="secondary"> / 上限 {r.maxPeople}</Text>
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
            峰值: {r.peakPeople}人 | 访客: {r.uniquePeople}人
          </div>
        </div>
      ),
    },
    {
      title: "点歌权限",
      dataIndex: "memberOperation",
      key: "memberOperation",
      width: 95,
      render: (memberOp: boolean) =>
        memberOp ? (
          <Tag color="cyan">全员可控</Tag>
        ) : (
          <Tag color="purple">仅房主</Tag>
        ),
    },
    {
      title: "创建/活跃时间",
      key: "time",
      width: 190,
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          <div>
            <Text type="secondary">创建: </Text>
            {formatTimestamp(r.createdAt)}
          </div>
          <div style={{ marginTop: 2 }}>
            <Text type="secondary">活跃: </Text>
            {formatTimestamp(r.updatedAt)}
          </div>
        </div>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 160,
      render: (_, r) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewDetail(r)}
          >
            详情
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<StopOutlined />}
            onClick={() => onDissolve(r)}
          >
            安全解散
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Space wrap>
          <Input
            placeholder="搜索房号 / 房间名 / 房主"
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined style={{ color: "#999" }} />}
            style={{ width: 260 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            查询
          </Button>
          <Button icon={<ClearOutlined />} onClick={handleReset}>
            重置
          </Button>
          <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
            刷新
          </Button>
        </Space>

        <Space>
          <Tooltip title="开启后每 5 秒自动拉取最新在线房间与播放状态">
            <span style={{ fontSize: 13, color: "#666" }}>
              <SyncOutlined spin={autoRefresh} style={{ marginRight: 6 }} />
              自动刷新 (5s)
            </span>
          </Tooltip>
          <Switch checked={autoRefresh} onChange={onAutoRefreshChange} />
        </Space>
      </div>

      <Table
        dataSource={items}
        columns={columns}
        rowKey="recordId"
        loading={loading}
        pagination={{
          current: Math.floor(offset / limit) + 1,
          pageSize: limit,
          total,
          showTotal: (t) => `共 ${t} 个在线房间`,
          onChange: (page) => onPageChange((page - 1) * limit),
          showSizeChanger: false,
        }}
        bordered
      />
    </Card>
  );
}
