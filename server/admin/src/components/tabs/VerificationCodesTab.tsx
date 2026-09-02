import { useCallback, useEffect, useRef, useState } from "react";
import {
  Avatar,
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
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CopyOutlined,
  DeleteOutlined,
  MailOutlined,
  MobileOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { deleteVerificationCode, fetchVerificationCodes } from "../../api/client";
import type {
  VerificationCodeFilter,
  VerificationCodePurpose,
  VerificationCodeRecord,
  VerificationCodeStatus,
} from "../../types/config";
import { formatTimestamp } from "../../utils/date";

const { Text } = Typography;

type Props = {
  themeColor: string;
};

const PURPOSE_OPTIONS: { label: string; value: string }[] = [
  { label: "全部验证类型", value: "all" },
  { label: "账号注册 (register)", value: "register" },
  { label: "快速登录 (login)", value: "login" },
  { label: "重置密码 (reset_password)", value: "reset_password" },
  { label: "换绑邮箱 (profile_email)", value: "profile_email" },
  { label: "绑定手机 (profile_phone)", value: "profile_phone" },
];

const CHANNEL_OPTIONS: { label: string; value: string }[] = [
  { label: "全部通道", value: "all" },
  { label: "邮箱 (email)", value: "email" },
  { label: "手机号 (phone)", value: "phone" },
];

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: "全部状态", value: "all" },
  { label: "已验证 (verified)", value: "verified" },
  { label: "有效中 (sent)", value: "sent" },
  { label: "已过期 (expired)", value: "expired" },
  { label: "发送失败 (failed)", value: "failed" },
];

const PURPOSE_TAG_MAP: Record<VerificationCodePurpose, { label: string; color: string }> = {
  register: { label: "注册", color: "cyan" },
  login: { label: "登录", color: "purple" },
  reset_password: { label: "重置密码", color: "red" },
  profile_email: { label: "换绑邮箱", color: "orange" },
  profile_phone: { label: "换绑手机", color: "geekblue" },
};

const PAGE_SIZE_DEFAULT = 20;

export default function VerificationCodesTab({ themeColor: _ }: Props) {
  const [items, setItems] = useState<VerificationCodeRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(PAGE_SIZE_DEFAULT);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 筛选表单临时状态
  const [channel, setChannel] = useState("all");
  const [purpose, setPurpose] = useState("all");
  const [status, setStatus] = useState("all");
  const [keyword, setKeyword] = useState("");

  // 实际生效的筛选条件
  const [activeFilter, setActiveFilter] = useState<VerificationCodeFilter>({
    channel: "all",
    purpose: "all",
    status: "all",
    keyword: "",
  });

  const requestIdRef = useRef(0);

  const loadData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const data = await fetchVerificationCodes({
        ...activeFilter,
        offset,
        limit,
      });
      if (requestId !== requestIdRef.current) return;
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      message.error(err instanceof Error ? err.message : "获取验证码记录失败");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [activeFilter, offset, limit]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSearch = () => {
    setOffset(0);
    setActiveFilter({
      channel,
      purpose,
      status,
      keyword: keyword.trim(),
    });
  };

  const handleReset = () => {
    setChannel("all");
    setPurpose("all");
    setStatus("all");
    setKeyword("");
    setOffset(0);
    setActiveFilter({
      channel: "all",
      purpose: "all",
      status: "all",
      keyword: "",
    });
  };

  const handleDelete = async (record: VerificationCodeRecord) => {
    setDeletingId(record.id);
    try {
      await deleteVerificationCode(record.id);
      message.success("记录已删除");
      void loadData();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  };

  const copyText = (text: string, tip = "已复制到剪贴板") => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => message.success(tip),
      () => message.error("复制失败"),
    );
  };

  const renderStatusTag = (st: VerificationCodeStatus, errorMsg?: string) => {
    if (st === "verified") return <Tag color="success">已验证</Tag>;
    if (st === "sent") return <Tag color="processing">有效中</Tag>;
    if (st === "expired") return <Tag color="default">已过期</Tag>;
    if (st === "failed") {
      return (
        <Tooltip title={errorMsg || "发送失败"}>
          <Tag color="error" className="cursor-help">
            发送失败
          </Tag>
        </Tooltip>
      );
    }
    return <Tag>{st}</Tag>;
  };

  const columns: ColumnsType<VerificationCodeRecord> = [
    {
      title: "目标联系人",
      key: "target",
      width: 220,
      render: (_, record) => {
        const isEmail = record.channel === "email";
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            {isEmail ? (
              <MailOutlined className="text-blue-500 shrink-0" />
            ) : (
              <MobileOutlined className="text-emerald-500 shrink-0" />
            )}
            <Text strong className="truncate max-w-[150px]" title={record.target}>
              {record.target}
            </Text>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined className="text-xs text-slate-400 hover:text-slate-600" />}
              onClick={() => copyText(record.target, "联系人已复制")}
              className="!px-1 !h-6 shrink-0"
            />
          </div>
        );
      },
    },
    {
      title: "验证类型",
      key: "purpose",
      width: 130,
      render: (_, record) => {
        const purposeConfig = PURPOSE_TAG_MAP[record.purpose] || { label: record.purpose, color: "default" };
        return <Tag color={purposeConfig.color}>{purposeConfig.label}</Tag>;
      },
    },
    {
      title: "验证码",
      dataIndex: "code",
      key: "code",
      width: 120,
      render: (code: string) => (
        <div className="flex items-center gap-1">
          <Text code className="!font-mono !font-bold text-sm tracking-wider text-blue-600">
            {code}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined className="text-xs text-slate-400 hover:text-slate-600" />}
            onClick={() => copyText(code, "验证码已复制")}
            className="!px-1 !h-6"
          />
        </div>
      ),
    },
    {
      title: "状态",
      key: "status",
      width: 110,
      render: (_, record) => renderStatusTag(record.status, record.errorMessage),
    },
    {
      title: "触发用户",
      key: "user",
      width: 180,
      render: (_, record) => {
        if (!record.user) {
          return <Text type="secondary" className="text-xs">游客 / 未登录</Text>;
        }
        return (
          <Tooltip title={`用户 ID: ${record.user.id} | 邮箱: ${record.user.email}`}>
            <Space size={8} align="center" className="cursor-pointer min-w-0">
              <Avatar
                size={24}
                src={record.user.avatarUrl}
                icon={!record.user.avatarUrl ? <UserOutlined /> : undefined}
                className="shrink-0 bg-blue-100 text-blue-600 border border-blue-200"
              >
                {!record.user.avatarUrl ? record.user.username.slice(0, 1).toUpperCase() : undefined}
              </Avatar>
              <Text strong className="truncate max-w-[110px] text-xs text-slate-700">
                {record.user.username}
              </Text>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: "触发设备",
      key: "deviceId",
      width: 160,
      render: (_, record) => {
        if (!record.deviceId) return <Text type="secondary" className="text-xs">-</Text>;
        return (
          <div className="flex items-center gap-1">
            <Tooltip title={`完整设备 ID: ${record.deviceId}`}>
              <Text code className="!font-mono text-xs truncate max-w-[110px]">
                {record.deviceId}
              </Text>
            </Tooltip>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined className="text-xs text-slate-400 hover:text-slate-600" />}
              onClick={() => copyText(record.deviceId, "设备 ID 已复制")}
              className="!px-1 !h-6"
            />
          </div>
        );
      },
    },
    {
      title: "客户端 IP",
      dataIndex: "clientIp",
      key: "clientIp",
      width: 140,
      render: (ip: string) =>
        ip ? <Text className="text-xs font-mono text-slate-600">{ip}</Text> : <Text type="secondary" className="text-xs">-</Text>,
    },
    {
      title: "发送 / 验证时间",
      key: "time",
      width: 180,
      render: (_, record) => (
        <div className="flex flex-col gap-0.5 text-xs">
          <Text className="text-slate-700" title="发送时间">
            {formatTimestamp(record.createdAt)}
          </Text>
          {record.verifiedAt ? (
            <Text type="success" className="text-[11px]" title="验证时间">
              已验: {formatTimestamp(record.verifiedAt)}
            </Text>
          ) : (
            <Text type="secondary" className="text-[11px]" title="有效截止时间">
              截止: {formatTimestamp(record.expiresAt)}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      fixed: "right",
      render: (_, record) => (
        <Popconfirm
          title="确定删除此条验证码记录？"
          description="删除后无法恢复"
          okText="确定删除"
          cancelText="取消"
          okButtonProps={{ danger: true, loading: deletingId === record.id }}
          onConfirm={() => handleDelete(record)}
        >
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={deletingId === record.id}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card className="shadow-sm border-slate-200/80 rounded-xl">
      {/* 顶部筛选栏 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select
          value={channel}
          onChange={setChannel}
          options={CHANNEL_OPTIONS}
          className="w-36"
        />
        <Select
          value={purpose}
          onChange={setPurpose}
          options={PURPOSE_OPTIONS}
          className="w-48"
        />
        <Select
          value={status}
          onChange={setStatus}
          options={STATUS_OPTIONS}
          className="w-36"
        />
        <Input
          placeholder="搜索邮箱 / 手机 / 设备 / 用户 / IP"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={handleSearch}
          allowClear
          className="w-64"
          prefix={<SearchOutlined className="text-slate-400" />}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
          查询
        </Button>
        <Button onClick={handleReset}>重置</Button>
        <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
          刷新
        </Button>
      </div>

      {/* 数据表格 */}
      <Table<VerificationCodeRecord>
        rowKey="id"
        columns={columns}
        dataSource={items}
        loading={loading}
        scroll={{ x: 1100 }}
        pagination={{
          current: Math.floor(offset / limit) + 1,
          pageSize: limit,
          total,
          showSizeChanger: true,
          pageSizeOptions: ["10", "20", "50", "100"],
          showTotal: (totalCount) => `共 ${totalCount} 条记录`,
          onChange: (page, pageSize) => {
            setOffset((page - 1) * pageSize);
            setLimit(pageSize);
          },
        }}
        size="middle"
      />
    </Card>
  );
}
