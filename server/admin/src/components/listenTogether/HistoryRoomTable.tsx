import { useState } from "react";
import {
  Avatar,
  Button,
  Card,
  DatePicker,
  Image,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ClearOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  SoundOutlined,
  UserOutlined,
} from "@ant-design/icons";
import type { AdminRoomHistoryListItem } from "../../api/listenTogetherAdmin";
import { formatDurationHuman, formatSeconds, formatTimestampFull } from "../../utils/date";

const { Text } = Typography;
const { RangePicker } = DatePicker;

type Props = {
  items: AdminRoomHistoryListItem[];
  total: number;
  offset: number;
  limit: number;
  keyword: string;
  endReason: string;
  startFrom?: number;
  startTo?: number;
  loading: boolean;
  onFilterChange: (filter: {
    keyword?: string;
    endReason?: string;
    startFrom?: number;
    startTo?: number;
  }) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onViewDetail: (room: AdminRoomHistoryListItem) => void;
};

const END_REASON_MAP: Record<string, { label: string; color: string }> = {
  empty: { label: "全员离开", color: "default" },
  host_left: { label: "房主离开", color: "orange" },
  admin_dissolved: { label: "管理员安全解散", color: "red" },
  server_restart: { label: "服务重启回收", color: "blue" },
  timeout: { label: "超时自动归档", color: "volcano" },
};

export default function HistoryRoomTable({
  items,
  total,
  offset,
  limit,
  keyword,
  endReason,
  startFrom: _startFrom,
  startTo: _startTo,
  loading,
  onFilterChange,
  onPageChange,
  onRefresh,
  onViewDetail,
}: Props) {
  const [localKeyword, setLocalKeyword] = useState(keyword);
  const [localEndReason, setLocalEndReason] = useState(endReason);
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  const handleSearch = () => {
    const sFrom = dateRange && dateRange[0] ? dateRange[0].valueOf() : undefined;
    const sTo = dateRange && dateRange[1] ? dateRange[1].valueOf() : undefined;
    onFilterChange({
      keyword: localKeyword.trim() || undefined,
      endReason: localEndReason || undefined,
      startFrom: sFrom,
      startTo: sTo,
    });
  };

  const handleReset = () => {
    setLocalKeyword("");
    setLocalEndReason("");
    setDateRange(null);
    onFilterChange({});
  };

  const columns: ColumnsType<AdminRoomHistoryListItem> = [
    {
      title: "房间记录",
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
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
            <Text copyable={{ text: r.recordId }} style={{ fontSize: 11, color: "#999" }}>
              ID: {r.recordId.slice(0, 8)}...
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "房主",
      key: "host",
      width: 170,
      render: (_, r) => {
        const host = r.finalHost || r.initialHost;
        const changed = r.finalHost && r.initialHost && r.finalHost.userId !== r.initialHost.userId;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar src={host.avatarUrl} icon={<UserOutlined />} size="default" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {host.nickname || host.username || "匿名"}
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID: {host.userId}
              </Text>
              {changed && (
                <Tag color="cyan" style={{ fontSize: 10, padding: "0 2px", marginTop: 2 }}>
                  曾转让房主
                </Tag>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "结束时曲目",
      key: "song",
      minWidth: 200,
      render: (_, r) => {
        if (!r.lastSong) {
          return <Text type="secondary">无曲目记录</Text>;
        }
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {r.lastSong.cover ? (
              <Image
                src={r.lastSong.cover}
                width={38}
                height={38}
                style={{ borderRadius: 4, objectFit: "cover" }}
                fallback="/static/account-avatars/default.jpg"
              />
            ) : (
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 4,
                  background: "#eee",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <SoundOutlined style={{ color: "#999" }} />
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Text strong style={{ fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 130 }}>
                  {r.lastSong.name}
                </Text>
                <Tag color="geekblue" style={{ fontSize: 10, padding: "0 2px" }}>
                  {r.lastSong.source.toUpperCase()}
                </Tag>
              </div>
              <div style={{ color: "#666", fontSize: 12 }}>{r.lastSong.singer}</div>
              <div style={{ color: "#999", fontSize: 11 }}>
                {formatSeconds(r.finalPosition)} / {formatSeconds(r.lastSong.duration)}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "统计指标",
      key: "stats",
      width: 170,
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          <div>
            最高峰值: <b>{r.peakPeople}</b> 人
          </div>
          <div style={{ marginTop: 2 }}>
            累计入房: <b>{r.totalJoinCount}</b> 人次
          </div>
          <div style={{ marginTop: 2 }}>
            独立访客: <b>{r.uniquePeople}</b> 人
          </div>
        </div>
      ),
    },
    {
      title: "结束原因",
      key: "endReason",
      width: 150,
      render: (_, r) => {
        if (!r.endReason) return <Tag>活跃中</Tag>;
        const conf = END_REASON_MAP[r.endReason] ?? { label: r.endReason, color: "default" };
        return (
          <div>
            <Tag color={conf.color}>{conf.label}</Tag>
            {r.endedByAdmin && (
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                操作人: {r.endedByAdmin}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "持续与结束时间",
      key: "time",
      width: 180,
      render: (_, r) => (
        <div style={{ fontSize: 12 }}>
          <div>
            <Text type="secondary">持续: </Text>
            <Tag color="blue">{formatDurationHuman(r.durationMs)}</Tag>
          </div>
          <div style={{ marginTop: 4 }}>
            <Text type="secondary">结束: </Text>
            {r.endedAt ? formatTimestampFull(r.endedAt) : "-"}
          </div>
        </div>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 90,
      render: (_, r) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => onViewDetail(r)}
        >
          详情
        </Button>
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
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="结束原因"
            value={localEndReason || undefined}
            onChange={setLocalEndReason}
            style={{ width: 160 }}
            allowClear
            options={[
              { label: "全部原因", value: "" },
              { label: "全员离开 (empty)", value: "empty" },
              { label: "房主离开 (host_left)", value: "host_left" },
              { label: "管理员安全解散 (admin_dissolved)", value: "admin_dissolved" },
              { label: "服务重启回收 (server_restart)", value: "server_restart" },
              { label: "超时结束 (timeout)", value: "timeout" },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [any, any])}
            showTime
            placeholder={["创建起始时间", "创建截止时间"]}
            style={{ width: 320 }}
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
          showTotal: (t) => `共 ${t} 条历史记录`,
          onChange: (page) => onPageChange((page - 1) * limit),
          showSizeChanger: false,
        }}
        bordered
      />
    </Card>
  );
}
