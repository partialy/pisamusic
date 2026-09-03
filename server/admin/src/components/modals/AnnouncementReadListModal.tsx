import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type {
  Announcement,
  AnnouncementReadDevice,
  AnnouncementReadItem,
  AnnouncementReadPage,
  AnnouncementReadUser,
} from "../../types/config";
import { fetchAnnouncementReads } from "../../api/client";

const { Text } = Typography;
const PAGE_SIZE = 20;

type Props = {
  announcement: Announcement;
  open: boolean;
  onClose: () => void;
};

function formatDateTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "-";
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function renderUser(user: AnnouncementReadUser | null) {
  if (!user) return <Tag>未登录访客</Tag>;
  const primary = user.username || user.email || user.id || "未知用户";
  return (
    <Space direction="vertical" size={0}>
      <Text strong className="text-xs text-slate-700">{primary}</Text>
      {user.username && user.email && <Text type="secondary" className="text-[11px]">{user.email}</Text>}
      {user.phone && <Text type="secondary" className="text-[11px]">{user.phone}</Text>}
    </Space>
  );
}

function renderDevice(device: AnnouncementReadDevice) {
  const model = [device.brand, device.model].filter(Boolean).join(" ");
  const title = device.deviceName || model || device.hostname || device.id;
  const system = [device.osName, device.osVersion].filter(Boolean).join(" ");
  return (
    <Space direction="vertical" size={0}>
      <Space size={4}>
        <Tag color={device.platform === "android" ? "green" : "blue"}>
          {device.platform === "android" ? "Android" : "桌面端"}
        </Tag>
        <Text strong className="text-xs text-slate-700">{title}</Text>
      </Space>
      {model && <Text type="secondary" className="text-[11px]">{model}</Text>}
      {device.hostname && <Text type="secondary" className="text-[11px]">主机：{device.hostname}</Text>}
      {system && <Text type="secondary" className="text-[11px]">系统：{system}</Text>}
      <Text type="secondary" className="text-[11px]">
        应用：{device.appVersion || "-"}{device.arch ? ` · ${device.arch}` : ""}
      </Text>
    </Space>
  );
}

export default function AnnouncementReadListModal({ announcement, open, onClose }: Props) {
  const [page, setPage] = useState<AnnouncementReadPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(async (nextOffset: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAnnouncementReads(announcement.id, nextOffset, PAGE_SIZE);
      setPage(result);
      setOffset(result.offset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "读取公告已读列表失败");
    } finally {
      setLoading(false);
    }
  }, [announcement.id]);

  useEffect(() => {
    if (!open) return;
    setPage(null);
    void loadPage(0);
  }, [open, loadPage]);

  const columns: ColumnsType<AnnouncementReadItem> = [
    {
      title: "已读时间",
      dataIndex: "readAt",
      key: "readAt",
      width: 180,
      render: (value: number) => <span className="font-mono text-xs text-slate-600">{formatDateTime(value)}</span>,
    },
    {
      title: "用户信息",
      key: "user",
      width: 190,
      render: (_, record) => renderUser(record.user),
    },
    {
      title: "设备信息",
      key: "device",
      render: (_, record) => renderDevice(record.device),
    },
  ];

  const currentPage = page ? Math.floor(offset / page.limit) + 1 : 1;

  return (
    <Modal
      open={open}
      centered
      width={900}
      title={<span className="font-bold text-slate-800">公告已读列表：{announcement.id}</span>}
      footer={null}
      onCancel={onClose}
      destroyOnClose
    >
      <div className="space-y-3 pt-2">
        {error && <Alert type="error" showIcon message={error} />}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={page?.items ?? []}
          loading={loading}
          size="small"
          bordered
          scroll={{ x: 650 }}
          pagination={page ? {
            current: currentPage,
            pageSize: page.limit,
            total: page.total,
            showSizeChanger: false,
            onChange: (nextPage) => {
              void loadPage((nextPage - 1) * page.limit);
            },
          } : false}
        />
      </div>
    </Modal>
  );
}
