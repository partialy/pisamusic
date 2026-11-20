import { Button, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import type {
  AdminUserSyncLogFilter,
  AdminUserSyncLogItem,
  AdminUserSyncLogsPage,
} from "../../types/config";
import { formatTimestamp } from "../../utils/date";

const { Text } = Typography;

type Props = {
  page: AdminUserSyncLogsPage;
  loading: boolean;
  filter: AdminUserSyncLogFilter;
  onFilterChange: (next: AdminUserSyncLogFilter) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
};

function itemTypeTag(itemType: string) {
  switch (itemType) {
    case "favorite_song":
      return <Tag color="cyan">收藏歌曲</Tag>;
    case "favorite_playlist":
      return <Tag color="geekblue">收藏歌单</Tag>;
    case "user_playlist":
      return <Tag color="purple">自建歌单</Tag>;
    case "playlist_track":
      return <Tag color="blue">歌单曲目</Tag>;
    default:
      return <Tag>{itemType || "-"}</Tag>;
  }
}

export default function UserSyncLogsPanel({
  page,
  loading,
  filter,
  onFilterChange,
  onPageChange,
  onRefresh,
}: Props) {
  const columns: ColumnsType<AdminUserSyncLogItem> = [
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
      width: 82,
      render: (version: number) => <Tag color="cyan">v{version}</Tag>,
    },
    {
      title: "动作",
      dataIndex: "action",
      key: "action",
      width: 82,
      align: "center",
      render: (action: string) =>
        action === "delete" ? <Tag color="red">删除</Tag> : <Tag color="green">写入</Tag>,
    },
    {
      title: "类型",
      dataIndex: "itemType",
      key: "itemType",
      width: 98,
      render: (itemType: string) => itemTypeTag(itemType),
    },
    {
      title: "摘要 / 键值",
      key: "itemKey",
      ellipsis: true,
      render: (_, item) => (
        <div className="min-w-0">
          <div className="text-slate-800 text-xs font-medium truncate">{item.summary || "-"}</div>
          <Text copyable={{ text: item.itemKey }} className="font-mono text-[11px] text-slate-500">
            {item.itemKey}
          </Text>
        </div>
      ),
    },
    {
      title: "设备 / 操作ID",
      key: "deviceOp",
      width: 190,
      ellipsis: true,
      render: (_, item) => (
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-slate-700 truncate">{item.deviceId || "-"}</div>
          <Text copyable={{ text: item.opId }} className="font-mono text-[11px] text-slate-400">
            {item.opId}
          </Text>
        </div>
      ),
    },
    {
      title: "客户端时间 / 落库时间",
      key: "time",
      width: 175,
      render: (_, item) => (
        <div>
          <div className="text-[11px] text-slate-500 font-mono truncate">
            {item.clientUpdatedAt || "-"}
          </div>
          <Text type="secondary" className="text-[11px]">
            {formatTimestamp(item.serverUpdatedAt)}
          </Text>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Space wrap size={8}>
          <Select
            size="small"
            value={filter.itemType || "all"}
            style={{ width: 120 }}
            onChange={(value) => onFilterChange({ ...filter, itemType: value })}
            options={[
              { value: "all", label: "全部类型" },
              { value: "favorite_song", label: "收藏歌曲" },
              { value: "favorite_playlist", label: "收藏歌单" },
              { value: "user_playlist", label: "自建歌单" },
              { value: "playlist_track", label: "歌单曲目" },
            ]}
          />
          <Select
            size="small"
            value={filter.action || "all"}
            style={{ width: 100 }}
            onChange={(value) => onFilterChange({ ...filter, action: value })}
            options={[
              { value: "all", label: "全部动作" },
              { value: "upsert", label: "写入" },
              { value: "delete", label: "删除" },
            ]}
          />
          <Input
            size="small"
            allowClear
            placeholder="设备 ID"
            style={{ width: 140 }}
            value={filter.deviceId || ""}
            onChange={(e) => onFilterChange({ ...filter, deviceId: e.target.value })}
          />
          <Input
            size="small"
            allowClear
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="搜索 itemKey / opId"
            style={{ width: 200 }}
            value={filter.keyword || ""}
            onChange={(e) => onFilterChange({ ...filter, keyword: e.target.value })}
          />
        </Space>
        <Space size={8}>
          <Tag color="cyan">当前 v{page.syncVersion}</Tag>
          <Tag color="default">日志下限 v{page.syncLogFloor}</Tag>
          <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      <Table<AdminUserSyncLogItem>
        rowKey="version"
        columns={columns}
        dataSource={page.items}
        loading={loading}
        size="small"
        bordered
        expandable={{
          expandedRowRender: (record) => (
            <pre className="m-0 max-h-48 overflow-auto rounded bg-slate-50 p-2 text-[11px] font-mono text-slate-700 whitespace-pre-wrap break-all">
              {record.payloadJson}
            </pre>
          ),
        }}
        pagination={{
          current: Math.floor(page.offset / page.limit) + 1,
          pageSize: page.limit,
          total: page.total,
          showTotal: (total) => `共 ${total} 条变更日志`,
          showQuickJumper: true,
          onChange: (nextPage) => onPageChange((nextPage - 1) * page.limit),
        }}
      />
    </div>
  );
}
