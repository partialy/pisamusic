import { useEffect, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  Card,
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
  CheckCircleOutlined,
  EyeOutlined,
  PictureOutlined,
  RedoOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type {
  AdminFeedbackFilter,
  AdminFeedbackListItem,
  FeedbackStatus,
  FeedbackType,
} from "../../types/config";
import { FEEDBACK_TYPE_LABELS, formatFeedbackTime } from "../../utils/feedback";

const { Text } = Typography;

type Props = {
  items: AdminFeedbackListItem[];
  total: number;
  offset: number;
  limit: number;
  filter: AdminFeedbackFilter;
  loading: boolean;
  updatingId: string | null;
  themeColor: string;
  onFilterChange: (filter: AdminFeedbackFilter) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onView: (item: AdminFeedbackListItem) => void;
  onStatusChange: (item: AdminFeedbackListItem, status: FeedbackStatus) => void;
};

export default function FeedbackManagementTab({
  items,
  total,
  offset,
  limit,
  filter,
  loading,
  updatingId,
  onFilterChange,
  onPageChange,
  onRefresh,
  onView,
  onStatusChange,
}: Props) {
  const [localStatus, setLocalStatus] = useState<string>(filter.status ?? "");
  const [localType, setLocalType] = useState<string>(filter.type ?? "");
  const [localKeyword, setLocalKeyword] = useState<string>(filter.keyword ?? "");

  useEffect(() => {
    setLocalStatus(filter.status ?? "");
    setLocalType(filter.type ?? "");
    setLocalKeyword(filter.keyword ?? "");
  }, [filter]);

  const handleApplyFilter = () => {
    onFilterChange({
      status: (localStatus || undefined) as FeedbackStatus | undefined,
      type: (localType || undefined) as FeedbackType | undefined,
      keyword: localKeyword.trim() || undefined,
    });
  };

  const handleReset = () => {
    setLocalStatus("");
    setLocalType("");
    setLocalKeyword("");
    onFilterChange({});
  };

  const columns: ColumnsType<AdminFeedbackListItem> = [
    {
      title: "附件图片",
      key: "images",
      width: 100,
      align: "center",
      render: (_, record) => {
        if (!record.firstImageUrl) {
          return (
            <Avatar shape="square" size={44} icon={<PictureOutlined />} className="bg-slate-100 text-slate-400" />
          );
        }
        return (
          <Badge count={record.imageCount > 1 ? record.imageCount : 0} size="small">
            <Image
              src={record.firstImageUrl}
              width={44}
              height={44}
              className="rounded-lg object-cover border border-slate-200"
            />
          </Badge>
        );
      },
    },
    {
      title: "反馈类型",
      dataIndex: "feedbackType",
      key: "feedbackType",
      width: 120,
      render: (type: FeedbackType) => (
        <Tag color="cyan">{FEEDBACK_TYPE_LABELS[type] || type}</Tag>
      ),
    },
    {
      title: "反馈内容描述",
      key: "description",
      ellipsis: true,
      render: (_, record) => (
        <div className="min-w-0">
          <Text strong ellipsis className="text-slate-800 cursor-pointer block" onClick={() => onView(record)} title={record.description}>
            {record.description}
          </Text>
          <Tooltip title={record.id}>
            <Text type="secondary" className="block text-[11px] font-mono text-slate-400">
              ID: {record.id}
            </Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "联系方式",
      dataIndex: "contact",
      key: "contact",
      width: 180,
      render: (contact: string | null) => (
        <Text copyable={contact ? { text: contact } : undefined} className="text-xs text-slate-600">
          {contact || "-"}
        </Text>
      ),
    },
    {
      title: "提交时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (createdAt: string) => (
        <Text type="secondary" className="text-xs">
          {formatFeedbackTime(createdAt)}
        </Text>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      align: "center",
      render: (status: FeedbackStatus) => (
        <Tag color={status === "processed" ? "success" : "warning"}>
          {status === "processed" ? "已处理" : "待处理"}
        </Tag>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 190,
      render: (_, record) => {
        const isProcessed = record.status === "processed";
        const nextStatus: FeedbackStatus = isProcessed ? "pending" : "processed";
        return (
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
              icon={isProcessed ? <RedoOutlined /> : <CheckCircleOutlined />}
              loading={updatingId === record.id}
              className={isProcessed ? "!text-amber-600" : "!text-emerald-600"}
              onClick={() => onStatusChange(record, nextStatus)}
            >
              {isProcessed ? "恢复待处理" : "标记已处理"}
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Card
        bordered={false}
        className="shadow-sm rounded-2xl"
        title={
          <div>
            <span className="text-lg font-bold text-slate-800">用户反馈管理</span>
            <span className="ml-2 text-xs font-normal text-slate-500">
              共 {total} 条反馈记录
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
            className="w-32"
            options={[
              { label: "全部状态", value: "" },
              { label: "待处理", value: "pending" },
              { label: "已处理", value: "processed" },
            ]}
          />

          <Select
            value={localType}
            onChange={(val) => setLocalType(val)}
            className="w-36"
            options={[
              { label: "全部类型", value: "" },
              ...Object.entries(FEEDBACK_TYPE_LABELS).map(([value, label]) => ({
                label,
                value,
              })),
            ]}
          />

          <Input
            placeholder="搜索反馈 ID、描述或联系方式"
            prefix={<SearchOutlined className="text-slate-400" />}
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
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

        <Table<AdminFeedbackListItem>
          rowKey="id"
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
            showTotal: (t) => `共 ${t} 条反馈`,
            showQuickJumper: true,
            onChange: (page) => onPageChange((page - 1) * limit),
          }}
        />
      </Card>
    </div>
  );
}
