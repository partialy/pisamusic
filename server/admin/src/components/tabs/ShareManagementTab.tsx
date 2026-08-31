import { useEffect, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  Image,
  Input,
  message,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CopyOutlined,
  ExportOutlined,
  PictureOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
} from "@ant-design/icons";
import type {
  AdminShareFilter,
  AdminShareListItem,
  ShareType,
} from "../../types/config";
import { formatTimestamp } from "../../utils/date";
import { buildMusicShareWebLink } from "../../utils/shareLink";

const { Text } = Typography;

type Props = {
  items: AdminShareListItem[];
  total: number;
  offset: number;
  limit: number;
  filter: AdminShareFilter;
  loading: boolean;
  invalidatingId: string | null;
  themeColor: string;
  onFilterChange: (filter: AdminShareFilter) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onInvalidate: (item: AdminShareListItem) => void;
};

const SHARE_TYPE_LABELS: Record<ShareType, string> = {
  song: "歌曲",
  playlist: "歌单",
};

export default function ShareManagementTab({
  items,
  total,
  offset,
  limit,
  filter,
  loading,
  invalidatingId,
  onFilterChange,
  onPageChange,
  onRefresh,
  onInvalidate,
}: Props) {
  const [localType, setLocalType] = useState<string>(filter.type ?? "");
  const [localValid, setLocalValid] = useState<string>(filter.valid ?? "all");
  const [localSharer, setLocalSharer] = useState<string>(filter.sharer ?? "");

  useEffect(() => {
    setLocalType(filter.type ?? "");
    setLocalValid(filter.valid ?? "all");
    setLocalSharer(filter.sharer ?? "");
  }, [filter]);

  const handleApplyFilter = () => {
    onFilterChange({
      type: (localType || undefined) as ShareType | undefined,
      valid: localValid as AdminShareFilter["valid"],
      sharer: localSharer.trim() || undefined,
    });
  };

  const handleReset = () => {
    setLocalType("");
    setLocalValid("all");
    setLocalSharer("");
    onFilterChange({ valid: "all" });
  };

  const copyShareLink = async (item: AdminShareListItem) => {
    try {
      await navigator.clipboard.writeText(buildMusicShareWebLink(item.uuid));
      void message.success("分享链接已复制到剪贴板！");
    } catch {
      window.alert("复制分享链接失败，请检查浏览器剪贴板权限。");
    }
  };

  const columns: ColumnsType<AdminShareListItem> = [
    {
      title: "封面",
      key: "cover",
      width: 76,
      align: "center",
      render: (_, record) => {
        if (!record.coverUrl) {
          return (
            <Avatar shape="square" size={44} icon={<PictureOutlined />} className="bg-slate-100 text-slate-400 rounded-lg" />
          );
        }
        return (
          <Image
            src={record.coverUrl}
            width={44}
            height={44}
            className="rounded-lg object-cover border border-slate-200 shadow-2xs"
            alt={record.title}
          />
        );
      },
    },
    {
      title: "分享内容",
      key: "content",
      width: 280,
      render: (_, record) => (
        <div className="min-w-0">
          <Text strong ellipsis className="text-slate-800 block text-xs" title={record.title}>
            {record.title || "未命名分享"}
          </Text>
          <Text type="secondary" ellipsis className="block text-[11px] text-slate-500" title={record.description}>
            {record.description || `${record.source}:${record.sourceId}`}
          </Text>
          <Tooltip title={record.uuid}>
            <Text copyable={{ text: record.uuid }} className="block text-[10px] font-mono text-slate-400 truncate max-w-[240px]">
              {record.uuid}
            </Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 90,
      align: "center",
      render: (type: ShareType) => (
        <Tag color={type === "playlist" ? "purple" : "cyan"}>
          {SHARE_TYPE_LABELS[type] || type}
        </Tag>
      ),
    },
    {
      title: "分享人",
      key: "sharer",
      width: 140,
      render: (_, record) => (
        <div className="min-w-0">
          <Text strong className="text-xs text-slate-700 block truncate">
            {record.sharer?.username || "-"}
          </Text>
          <Text copyable={{ text: record.sharer?.id }} className="text-[10px] font-mono text-slate-400 block truncate">
            {record.sharer?.id}
          </Text>
        </div>
      ),
    },
    {
      title: "访问次数",
      dataIndex: "accessCount",
      key: "accessCount",
      width: 100,
      align: "center",
      render: (count: number) => (
        <span className="font-mono text-xs font-bold text-slate-700">
          {count}
        </span>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (ts: number) => (
        <Text type="secondary" className="text-xs">
          {formatTimestamp(ts)}
        </Text>
      ),
    },
    {
      title: "状态",
      key: "status",
      width: 110,
      render: (_, record) => (
        <div>
          <Tag color={record.valid ? "success" : "default"}>
            {record.valid ? "有效" : "已失效"}
          </Tag>
          {!record.valid && record.invalidatedAt && (
            <span className="block text-[10px] text-slate-400 mt-0.5">
              {formatTimestamp(record.invalidatedAt)}
            </span>
          )}
        </div>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 220,
      render: (_, record) => (
        <Space size={4}>
          <Button
            type="link"
            size="small"
            icon={<ExportOutlined />}
            href={buildMusicShareWebLink(record.uuid)}
            target="_blank"
          >
            公开页
          </Button>

          <Button
            type="link"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => void copyShareLink(record)}
          >
            复制
          </Button>

          <Popconfirm
            title="确认将该分享标记为失效？"
            description="标记失效后，公开访问链接将无法继续查看或播放该分享内容。"
            onConfirm={() => onInvalidate(record)}
            disabled={!record.valid || invalidatingId === record.uuid}
            okText="确认失效"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<StopOutlined />}
              disabled={!record.valid || invalidatingId === record.uuid}
              loading={invalidatingId === record.uuid}
            >
              {record.valid ? "失效" : "已失效"}
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
            <span className="text-lg font-bold text-slate-800">分享记录管理</span>
            <span className="ml-2 text-xs font-normal text-slate-500">
              共 {total} 条分享记录
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
          <Select
            value={localType}
            onChange={(val) => setLocalType(val)}
            className="w-32"
            options={[
              { label: "全部类型", value: "" },
              { label: "歌曲", value: "song" },
              { label: "歌单", value: "playlist" },
            ]}
          />

          <Select
            value={localValid}
            onChange={(val) => setLocalValid(val)}
            className="w-32"
            options={[
              { label: "全部状态", value: "all" },
              { label: "有效", value: "true" },
              { label: "已失效", value: "false" },
            ]}
          />

          <Input
            placeholder="搜索分享人 ID、用户名或邮箱"
            prefix={<SearchOutlined className="text-slate-400" />}
            value={localSharer}
            onChange={(e) => setLocalSharer(e.target.value)}
            onPressEnter={handleApplyFilter}
            allowClear
            className="w-full sm:w-72"
          />

          <Button type="primary" onClick={handleApplyFilter}>
            查询
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
        </div>

        <Table<AdminShareListItem>
          rowKey="uuid"
          columns={columns}
          dataSource={items}
          loading={loading}
          size="middle"
          scroll={{ x: 1200 }}
          sticky={{ offsetHeader: 0 }}
          bordered
          pagination={{
            current: Math.floor(offset / limit) + 1,
            pageSize: limit,
            total,
            showTotal: (t) => `共 ${t} 条分享`,
            showQuickJumper: true,
            onChange: (page) => onPageChange((page - 1) * limit),
          }}
        />
      </Card>
    </div>
  );
}
