import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Input,
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
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { FileRecordInfo } from "../../types/config";

const { Text } = Typography;

type FileFilters = {
  status: "uploaded" | "deleted" | "pending" | "all";
  usageType: "release-package" | "desktop-update" | "cloud-music" | "all";
  keyword: string;
};

type Props = {
  files: FileRecordInfo[];
  total: number;
  offset: number;
  limit: number;
  filters: FileFilters;
  loading: boolean;
  deletingId: string | null;
  themeColor: string;
  onFilterChange: (filters: FileFilters) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onView: (file: FileRecordInfo) => void;
  onDelete: (file: FileRecordInfo) => void;
};

export function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "-";
  const mb = size / 1024 / 1024;
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

export function formatDate(ts: number | null): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString();
}

export function usageText(file: FileRecordInfo): string {
  if (file.usageType === "desktop-update") return "PC 自动更新文件";
  if (file.usageType === "cloud-music") return "网盘音乐";
  return "发布安装包";
}

function assetTypeText(file: FileRecordInfo): string {
  if (file.assetType === "installer") return "安装包";
  if (file.assetType === "latest-yml") return "latest.yml";
  if (file.assetType === "blockmap") return "blockmap";
  if (file.assetType === "audio") return "音频";
  if (file.assetType === "cover-uploaded") return "手动封面";
  if (file.assetType === "cover-extracted") return "内嵌封面";
  if (file.assetType === "lyrics") return "歌词";
  return file.assetType || "-";
}

export function referencesText(file: FileRecordInfo): string {
  return file.referencedBy.length ? file.referencedBy.join("、") : "无引用";
}

function statusTag(file: FileRecordInfo) {
  if (file.status === "pending") {
    return <Tag color="warning">待上传</Tag>;
  }
  if (file.status === "uploaded") {
    return <Tag color="success">已上传</Tag>;
  }
  return <Tag color="default">已删除</Tag>;
}

export default function FileManagementTab({
  files,
  total,
  offset,
  limit,
  filters,
  loading,
  deletingId,
  onFilterChange,
  onPageChange,
  onRefresh,
  onView,
  onDelete,
}: Props) {
  const [localStatus, setLocalStatus] = useState(filters.status);
  const [localUsage, setLocalUsage] = useState(filters.usageType);
  const [localKeyword, setLocalKeyword] = useState(filters.keyword);

  useEffect(() => {
    setLocalStatus(filters.status);
    setLocalUsage(filters.usageType);
    setLocalKeyword(filters.keyword);
  }, [filters]);

  const handleApplyFilter = () => {
    onFilterChange({
      status: localStatus,
      usageType: localUsage,
      keyword: localKeyword.trim(),
    });
  };

  const handleReset = () => {
    setLocalStatus("uploaded");
    setLocalUsage("all");
    setLocalKeyword("");
    onFilterChange({ status: "uploaded", usageType: "all", keyword: "" });
  };

  const columns: ColumnsType<FileRecordInfo> = [
    {
      title: "文件名 / 对象 Key",
      key: "file",
      width: 280,
      render: (_, record) => (
        <div className="min-w-0">
          <Text strong ellipsis className="max-w-[240px] text-slate-800" title={record.fileName}>
            {record.fileName || "-"}
          </Text>
          <Tooltip title={record.objectKey}>
            <Text type="secondary" className="block text-xs font-mono truncate max-w-[240px]">
              {record.objectKey || "-"}
            </Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "用途",
      key: "usage",
      width: 140,
      render: (_, record) => {
        const text = usageText(record);
        const color =
          record.usageType === "desktop-update"
            ? "blue"
            : record.usageType === "cloud-music"
            ? "purple"
            : "cyan";
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: "平台 / 版本",
      key: "version",
      width: 140,
      render: (_, record) => {
        const values = [record.platform, record.version].filter(Boolean);
        return <span className="font-mono text-xs text-slate-600">{values.length ? values.join(" / ") : "-"}</span>;
      },
    },
    {
      title: "资源类型",
      key: "assetType",
      width: 110,
      render: (_, record) => (
        <Tag color="geekblue">{assetTypeText(record)}</Tag>
      ),
    },
    {
      title: "大小",
      dataIndex: "fileSize",
      key: "fileSize",
      width: 110,
      render: (size: number) => (
        <Text className="font-mono text-xs text-slate-700">
          {formatFileSize(size)}
        </Text>
      ),
    },
    {
      title: "状态",
      key: "status",
      width: 100,
      align: "center",
      render: (_, record) => statusTag(record),
    },
    {
      title: "关联引用",
      key: "references",
      ellipsis: true,
      render: (_, record) => (
        <Tooltip title={referencesText(record)}>
          <span className="text-xs text-slate-500 truncate">
            {referencesText(record)}
          </span>
        </Tooltip>
      ),
    },
    {
      title: "时间",
      key: "time",
      width: 180,
      render: (_, record) => (
        <div className="text-xs text-slate-500">
          <div>上传：{formatDate(record.createdAt)}</div>
          {record.deletedAt && (
            <div className="text-red-400">删除：{formatDate(record.deletedAt)}</div>
          )}
        </div>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onView(record)}
          >
            查看
          </Button>
          <Popconfirm
            title="确认删除该七牛文件？"
            description="删除后将调用七牛云物理删除对象，并清理发布引用。"
            onConfirm={() => onDelete(record)}
            disabled={record.status === "deleted" || deletingId === record.id}
            okText="确认删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={record.status === "deleted" || deletingId === record.id}
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
            <span className="text-lg font-bold text-slate-800">文件管理</span>
            <span className="ml-2 text-xs font-normal text-slate-500">
              共 {total} 条七牛云文件记录
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
            value={localStatus}
            onChange={(val) => setLocalStatus(val)}
            className="w-36"
            options={[
              { label: "仅已上传", value: "uploaded" },
              { label: "仅待上传", value: "pending" },
              { label: "仅已删除", value: "deleted" },
              { label: "全部状态", value: "all" },
            ]}
          />

          <Select
            value={localUsage}
            onChange={(val) => setLocalUsage(val)}
            className="w-36"
            options={[
              { label: "全部用途", value: "all" },
              { label: "发布安装包", value: "release-package" },
              { label: "PC 自动更新", value: "desktop-update" },
              { label: "网盘音乐", value: "cloud-music" },
            ]}
          />

          <Input
            placeholder="搜索文件名或七牛 Key"
            prefix={<SearchOutlined className="text-slate-400" />}
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            onPressEnter={handleApplyFilter}
            allowClear
            className="w-full sm:w-64"
          />

          <Button type="primary" onClick={handleApplyFilter}>
            查询
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
        </div>

        <Table<FileRecordInfo>
          rowKey="id"
          columns={columns}
          dataSource={files}
          loading={loading}
          size="middle"
          scroll={{ x: 1350 }}
          sticky={{ offsetHeader: 0 }}
          bordered
          pagination={{
            current: Math.floor(offset / limit) + 1,
            pageSize: limit,
            total,
            showTotal: (t) => `共 ${t} 条文件记录`,
            showQuickJumper: true,
            onChange: (page) => onPageChange((page - 1) * limit),
          }}
        />
      </Card>
    </div>
  );
}
