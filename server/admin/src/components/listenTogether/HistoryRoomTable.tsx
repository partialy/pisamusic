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
  UserOutlined,
} from "@ant-design/icons";
import type { AdminRoomHistoryListItem } from "../../api/listenTogetherAdmin";
import { adminCardClasses } from "../../constants/theme";
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
          <div className="font-semibold text-sm text-slate-800">{r.roomName}</div>
          <div className="flex items-center gap-1.5 mt-1">
            <Tag color="blue" className="!mr-0">房号</Tag>
            <Text copyable={{ text: r.roomId }} className="font-mono text-xs">
              {r.roomId}
            </Text>
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            <Text copyable={{ text: r.recordId }} className="text-[11px] text-slate-400">
              ID: {r.recordId.slice(0, 8)}...
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "房主",
      key: "host",
      width: 155,
      render: (_, r) => {
        const host = r.finalHost || r.initialHost;
        const changed = r.finalHost && r.initialHost && r.finalHost.userId !== r.initialHost.userId;
        return (
          <div className="flex items-center gap-2">
            <Avatar
              src={host.avatarUrl}
              icon={<UserOutlined />}
              size={36}
              className="shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span
                  className="font-medium text-xs truncate max-w-[68px]"
                  title={host.nickname || host.username || "匿名"}
                >
                  {host.nickname || host.username || "匿名"}
                </span>
                <Text
                  copyable={{
                    text: host.userId,
                    tooltips: ["复制房主ID", "已复制"],
                  }}
                />
              </div>
              {changed && (
                <Tag color="cyan" className="!mr-0 mt-0.5 text-[10px]">
                  曾转让
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
      minWidth: 220,
      render: (_, r) => {
        if (!r.lastSong) {
          return <Text type="secondary">无曲目记录</Text>;
        }
        return (
          <div className="flex items-center gap-2.5">
            {r.lastSong.cover ? (
              <Image
                src={r.lastSong.cover.replace("{size}", "120")}
                width={40}
                height={40}
                className="rounded object-cover shrink-0"
                fallback="/static/account-avatars/default.jpg"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center shrink-0">
                <SoundOutlined className="text-slate-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Text strong className="text-xs truncate max-w-[130px]">
                  {r.lastSong.name}
                </Text>
                <Tag color="geekblue" className="!mr-0 text-[10px]">
                  {r.lastSong.source.toUpperCase()}
                </Tag>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{r.lastSong.singer}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
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
        <div className="text-xs">
          <div>
            最高峰值: <b>{r.peakPeople}</b> 人
          </div>
          <div className="mt-0.5">
            累计入房: <b>{r.totalJoinCount}</b> 人次
          </div>
          <div className="mt-0.5">
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
              <div className="text-[11px] text-slate-400 mt-0.5">
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
        <div className="text-xs">
          <div>
            <Text type="secondary">持续: </Text>
            <Tag color="blue">{formatDurationHuman(r.durationMs)}</Tag>
          </div>
          <div className="mt-1">
            <Text type="secondary">结束: </Text>
            {r.endedAt ? formatTimestampFull(r.endedAt) : "-"}
          </div>
        </div>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 72,
      fixed: "right",
      align: "center",
      render: (_, r) => (
        <Tooltip title="查看历史房间详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onViewDetail(r)}
          />
        </Tooltip>
      ),
    },
  ];

  return (
    <Card bordered={false} className={adminCardClasses}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Space wrap>
          <Input
            placeholder="搜索房号 / 房间名 / 房主"
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            onPressEnter={handleSearch}
            prefix={<SearchOutlined className="text-slate-400" />}
            className="w-56"
            allowClear
          />
          <Select
            placeholder="结束原因"
            value={localEndReason || undefined}
            onChange={setLocalEndReason}
            className="w-40"
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
            className="w-80"
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
        size="middle"
        bordered
        scroll={{ x: 1100 }}
        loading={loading}
        pagination={{
          current: Math.floor(offset / limit) + 1,
          pageSize: limit,
          total,
          showTotal: (t) => `共 ${t} 条历史记录`,
          onChange: (page) => onPageChange((page - 1) * limit),
          showSizeChanger: false,
        }}
      />
    </Card>
  );
}
