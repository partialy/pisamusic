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
import { adminCardClasses } from "../../constants/theme";
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
          <div className="font-semibold text-sm text-slate-800">{r.roomName}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <Tag color="blue" className="!mr-0">房号</Tag>
            <Text copyable={{ text: r.roomId }} className="font-mono text-xs">
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
        <div className="flex items-center gap-2">
          <Avatar
            src={r.host.avatarUrl}
            icon={<UserOutlined />}
            size={36}
            className="shrink-0"
          />
          <div className="min-w-0 flex-1 flex items-center gap-1">
            <span
              className="font-medium text-xs truncate max-w-[68px]"
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
          <div className="flex items-center gap-2.5">
            {r.song.cover ? (
              <Image
                src={r.song.cover.replace("{size}", "120")}
                width={42}
                height={42}
                className="rounded object-cover shrink-0"
                fallback="/static/account-avatars/default.jpg"
              />
            ) : (
              <div className="w-[42px] h-[42px] rounded bg-slate-100 flex items-center justify-center shrink-0">
                <SoundOutlined className="text-slate-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Text strong className="text-xs truncate max-w-[140px]">
                  {r.song.name}
                </Text>
                <Tag color="geekblue" className="!mr-0 text-[10px]">
                  {r.song.source.toUpperCase()}
                </Tag>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {r.song.singer}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Tag color={statusConfig.color} className="!mr-0 text-[10px]">
                  {statusConfig.label}
                </Tag>
                <Text type="secondary" className="text-[11px]">
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
            <Text strong className="!text-emerald-600">
              {r.onlinePeople}
            </Text>
            <Text type="secondary"> 在线 / 入房 </Text>
            <Text strong>{r.currentPeople}</Text>
            <Text type="secondary"> / 上限 {r.maxPeople}</Text>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
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
        <div className="text-xs">
          <div>
            <Text type="secondary">创建: </Text>
            {formatTimestamp(r.createdAt)}
          </div>
          <div className="mt-0.5">
            <Text type="secondary">活跃: </Text>
            {formatTimestamp(r.updatedAt)}
          </div>
        </div>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 90,
      fixed: "right",
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="查看房间详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onViewDetail(r)}
            />
          </Tooltip>
          <Tooltip title="安全解散房间">
            <Button
              type="link"
              danger
              size="small"
              icon={<StopOutlined />}
              onClick={() => onDissolve(r)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Card bordered={false} className={adminCardClasses}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Space wrap>
          <Input
            placeholder="搜索房号 / 房间名 / 房主"
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined className="text-slate-400" />}
            className="w-64"
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
            <span className="text-xs text-slate-500">
              <SyncOutlined spin={autoRefresh} className="mr-1.5" />
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
        size="middle"
        bordered
        scroll={{ x: 1100 }}
        loading={loading}
        pagination={{
          current: Math.floor(offset / limit) + 1,
          pageSize: limit,
          total,
          showTotal: (t) => `共 ${t} 个在线房间`,
          onChange: (page) => onPageChange((page - 1) * limit),
          showSizeChanger: false,
        }}
      />
    </Card>
  );
}
