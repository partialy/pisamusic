import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Segmented,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { EyeOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  fetchAdminWebsiteDownloadDetail,
  fetchAdminWebsiteDownloadRecords,
  fetchAdminWebsiteVisitDetail,
  fetchAdminWebsiteVisitRecords,
} from "../../api/client";
import type {
  AdminWebsiteDownloadDetail,
  AdminWebsiteDownloadListItem,
  AdminWebsiteVisitDetail,
  AdminWebsiteVisitListItem,
  WebsiteRecordType,
} from "../../types/config";
import { formatTimestamp } from "../../utils/date";
import WebsiteRecordDetailModal from "../modals/WebsiteRecordDetailModal";

const { Text } = Typography;

type Props = {
  themeColor: string;
};

type RecordOffsets = Record<WebsiteRecordType, number>;

const PAGE_LIMIT = 20;

export default function WebsiteRecordsTab({ themeColor: _ }: Props) {
  const [recordType, setRecordType] = useState<WebsiteRecordType>("visit");
  const [offsets, setOffsets] = useState<RecordOffsets>({ visit: 0, download: 0 });
  const [visitItems, setVisitItems] = useState<AdminWebsiteVisitListItem[]>([]);
  const [downloadItems, setDownloadItems] = useState<AdminWebsiteDownloadListItem[]>([]);
  const [totals, setTotals] = useState<RecordOffsets>({ visit: 0, download: 0 });
  const [loading, setLoading] = useState(false);
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
  const [visitDetail, setVisitDetail] = useState<AdminWebsiteVisitDetail | null>(null);
  const [downloadDetail, setDownloadDetail] = useState<AdminWebsiteDownloadDetail | null>(null);
  const requestIdRef = useRef(0);

  const offset = offsets[recordType];
  const total = totals[recordType];

  const loadRecords = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      if (recordType === "visit") {
        const data = await fetchAdminWebsiteVisitRecords(offsets.visit, PAGE_LIMIT);
        if (requestId !== requestIdRef.current) return;
        setVisitItems(data.items);
        setTotals((current) => ({ ...current, visit: data.total }));
      } else {
        const data = await fetchAdminWebsiteDownloadRecords(offsets.download, PAGE_LIMIT);
        if (requestId !== requestIdRef.current) return;
        setDownloadItems(data.items);
        setTotals((current) => ({ ...current, download: data.total }));
      }
    } catch (reason) {
      if (requestId !== requestIdRef.current) return;
      window.alert(reason instanceof Error ? reason.message : "官网记录加载失败");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [offsets.download, offsets.visit, recordType]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handlePageChange = (page: number) => {
    const nextOffset = (page - 1) * PAGE_LIMIT;
    setOffsets((current) => ({ ...current, [recordType]: nextOffset }));
  };

  const openDetail = async (id: string) => {
    setDetailLoadingId(id);
    try {
      if (recordType === "visit") {
        setVisitDetail(await fetchAdminWebsiteVisitDetail(id));
      } else {
        setDownloadDetail(await fetchAdminWebsiteDownloadDetail(id));
      }
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : "记录详情加载失败");
    } finally {
      setDetailLoadingId(null);
    }
  };

  const visitColumns: ColumnsType<AdminWebsiteVisitListItem> = [
    {
      title: "访问日期",
      dataIndex: "visitDay",
      key: "visitDay",
      width: 120,
      render: (day: string) => <Text strong className="text-slate-800">{day}</Text>,
    },
    {
      title: "访问路径",
      dataIndex: "path",
      key: "path",
      ellipsis: true,
      render: (path: string) => (
        <Tooltip title={path}>
          <Text className="font-mono text-xs text-slate-700">{path || "/"}</Text>
        </Tooltip>
      ),
    },
    {
      title: "来源页面 (Referrer)",
      dataIndex: "referrer",
      key: "referrer",
      ellipsis: true,
      render: (ref: string) => (
        <Tooltip title={ref}>
          <span className="text-slate-500 text-xs truncate">{ref || "-"}</span>
        </Tooltip>
      ),
    },
    {
      title: "IP 地址",
      dataIndex: "ipAddress",
      key: "ipAddress",
      width: 150,
      render: (ip: string) => (
        <Text copyable={{ text: ip }} className="font-mono text-xs text-slate-600">
          {ip || "-"}
        </Text>
      ),
    },
    {
      title: "语言 / 分辨率",
      key: "langRes",
      width: 180,
      render: (_, record) => (
        <span className="text-xs text-slate-500">
          {record.language || "-"} · {record.screenWidth}×{record.screenHeight}
        </span>
      ),
    },
    {
      title: "访问时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (ts: number) => (
        <Text type="secondary" className="text-xs">
          {formatTimestamp(ts)}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 90,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          loading={detailLoadingId === record.id}
          onClick={() => void openDetail(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  const downloadColumns: ColumnsType<AdminWebsiteDownloadListItem> = [
    {
      title: "下载日期",
      dataIndex: "downloadDay",
      key: "downloadDay",
      width: 120,
      render: (day: string) => <Text strong className="text-slate-800">{day}</Text>,
    },
    {
      title: "平台",
      dataIndex: "platform",
      key: "platform",
      width: 100,
      align: "center",
      render: (platform: string) => (
        <Tag color={platform === "desktop" ? "blue" : "green"}>
          {platform === "desktop" ? "PC" : "Android"}
        </Tag>
      ),
    },
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
      width: 120,
      render: (ver: string) => (
        <Text strong className="font-mono text-xs text-slate-800">
          {ver || "-"}
        </Text>
      ),
    },
    {
      title: "文件记录 ID",
      dataIndex: "fileRecordId",
      key: "fileRecordId",
      ellipsis: true,
      render: (id: string | null) => (
        <Tooltip title={id}>
          <Text copyable={id ? { text: id } : undefined} className="font-mono text-xs text-slate-500">
            {id || "-"}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: "IP 地址",
      dataIndex: "ipAddress",
      key: "ipAddress",
      width: 150,
      render: (ip: string) => (
        <Text copyable={{ text: ip }} className="font-mono text-xs text-slate-600">
          {ip || "-"}
        </Text>
      ),
    },
    {
      title: "下载时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (ts: number) => (
        <Text type="secondary" className="text-xs">
          {formatTimestamp(ts)}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 90,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          loading={detailLoadingId === record.id}
          onClick={() => void openDetail(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up">
      <Card
        bordered={false}
        className="shadow-sm rounded-2xl"
        title={
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-slate-800">官网记录</span>
            <Segmented
              options={[
                { label: "访问记录", value: "visit" },
                { label: "下载记录", value: "download" },
              ]}
              value={recordType}
              onChange={(val) => setRecordType(val as WebsiteRecordType)}
            />
            <span className="text-xs font-normal text-slate-500">
              共 {total} 条{recordType === "visit" ? "访问" : "下载"}记录
            </span>
          </div>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void loadRecords()}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        {recordType === "visit" ? (
          <Table<AdminWebsiteVisitListItem>
            rowKey="id"
            columns={visitColumns}
            dataSource={visitItems}
            loading={loading}
            size="middle"
            scroll={{ x: 1200 }}
            sticky={{ offsetHeader: 0 }}
            bordered
            pagination={{
              current: Math.floor(offset / PAGE_LIMIT) + 1,
              pageSize: PAGE_LIMIT,
              total,
              showTotal: (t) => `共 ${t} 条访问记录`,
              showQuickJumper: true,
              onChange: handlePageChange,
            }}
          />
        ) : (
          <Table<AdminWebsiteDownloadListItem>
            rowKey="id"
            columns={downloadColumns}
            dataSource={downloadItems}
            loading={loading}
            size="middle"
            scroll={{ x: 1100 }}
            sticky={{ offsetHeader: 0 }}
            bordered
            pagination={{
              current: Math.floor(offset / PAGE_LIMIT) + 1,
              pageSize: PAGE_LIMIT,
              total,
              showTotal: (t) => `共 ${t} 条下载记录`,
              showQuickJumper: true,
              onChange: handlePageChange,
            }}
          />
        )}
      </Card>

      {visitDetail && (
        <WebsiteRecordDetailModal
          recordType="visit"
          record={visitDetail}
          onClose={() => setVisitDetail(null)}
        />
      )}

      {downloadDetail && (
        <WebsiteRecordDetailModal
          recordType="download"
          record={downloadDetail}
          onClose={() => setDownloadDetail(null)}
        />
      )}
    </div>
  );
}
