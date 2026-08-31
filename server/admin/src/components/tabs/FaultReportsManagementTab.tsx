import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Input,
  Select,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { fetchAdminFaultReports } from "../../api/client";
import type {
  AdminFaultReportFilter,
  AdminFaultReportListItem,
  FaultReportScene,
  FaultReportStatus,
} from "../../types/config";
import {
  FAULT_REPORT_SCENE_LABELS,
  FAULT_REPORT_STATUS_LABELS,
  formatFaultReportTime,
} from "../../utils/faultReports";

const { Text } = Typography;

const LIMIT = 20;

type Props = {
  themeColor: string;
  onView: (id: string) => void;
  refreshKey?: number;
};

function formatEnvironment(item: AdminFaultReportListItem) {
  if (item.platform === "desktop") {
    return `${item.brand || "PC"} ${item.osVersion} · ${item.model} ${item.arch}`.trim();
  }
  return `Android ${item.osVersion} · ${item.brand} ${item.model}`.trim();
}

export default function FaultReportsManagementTab({
  themeColor: _,
  onView,
  refreshKey,
}: Props) {
  const [items, setItems] = useState<AdminFaultReportListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<AdminFaultReportFilter>({});
  const [localStatus, setLocalStatus] = useState<string>("");
  const [localScene, setLocalScene] = useState<string>("");
  const [localKeyword, setLocalKeyword] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (currentOffset = offset, currentFilter = filter) => {
    setLoading(true);
    try {
      const result = await fetchAdminFaultReports({
        ...currentFilter,
        offset: currentOffset,
        limit: LIMIT,
      });
      setItems(result.items);
      setTotal(result.total);
      setOffset(result.offset);
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : "故障上报读取失败");
    } finally {
      setLoading(false);
    }
  }, [filter, offset]);

  useEffect(() => {
    void load(offset, filter);
  }, [load, refreshKey]);

  const handleApplyFilter = () => {
    const nextFilter: AdminFaultReportFilter = {
      status: (localStatus || undefined) as FaultReportStatus | undefined,
      scene: (localScene || undefined) as FaultReportScene | undefined,
      keyword: localKeyword.trim() || undefined,
    };
    setFilter(nextFilter);
    setOffset(0);
    void load(0, nextFilter);
  };

  const handleReset = () => {
    setLocalStatus("");
    setLocalScene("");
    setLocalKeyword("");
    setFilter({});
    setOffset(0);
    void load(0, {});
  };

  const columns: ColumnsType<AdminFaultReportListItem> = [
    {
      title: "场景 / 报告 ID",
      key: "scene",
      width: 220,
      render: (_, record) => {
        const isDesktop = record.scene === "desktop_network";
        return (
          <div className="min-w-0">
            <Tag color={isDesktop ? "blue" : "cyan"}>
              {FAULT_REPORT_SCENE_LABELS[record.scene] || record.scene}
            </Tag>
            <Tooltip title={record.id}>
              <Text copyable={{ text: record.id }} className="block text-[11px] font-mono text-slate-400 truncate max-w-[200px] mt-1">
                {record.id}
              </Text>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: "上报用户",
      dataIndex: "userId",
      key: "userId",
      width: 140,
      render: (userId: string | null) =>
        userId ? (
          <Text copyable={{ text: userId }} className="font-mono text-xs text-slate-700">
            {userId}
          </Text>
        ) : (
          <span className="text-xs text-slate-400">匿名用户</span>
        ),
    },
    {
      title: "App / 系统环境",
      key: "appEnv",
      width: 240,
      render: (_, record) => (
        <div className="min-w-0">
          <Text strong className="font-mono text-xs text-slate-800">
            {record.appVersion}
            {record.appVersionCode > 0 ? ` (${record.appVersionCode})` : ""}
          </Text>
          <span className="block text-xs text-slate-500 truncate" title={formatEnvironment(record)}>
            {formatEnvironment(record)}
          </span>
        </div>
      ),
    },
    {
      title: "日志条数",
      dataIndex: "logCount",
      key: "logCount",
      width: 100,
      align: "center",
      render: (count: number) => (
        <Tag color="geekblue" className="font-bold">
          {count} 条
        </Tag>
      ),
    },
    {
      title: "提交时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 170,
      render: (ts: number) => (
        <Text type="secondary" className="text-xs">
          {formatFaultReportTime(ts)}
        </Text>
      ),
    },
    {
      title: "处理状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      align: "center",
      render: (status: FaultReportStatus) => (
        <Tag color={status === "processed" ? "success" : "warning"}>
          {FAULT_REPORT_STATUS_LABELS[status] || status}
        </Tag>
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
          onClick={() => onView(record.id)}
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
          <div>
            <span className="text-lg font-bold text-slate-800">故障上报管理</span>
            <span className="ml-2 text-xs font-normal text-slate-500">
              共 {total} 条故障报告
            </span>
          </div>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void load()}
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
            value={localScene}
            onChange={(val) => setLocalScene(val)}
            className="w-36"
            options={[
              { label: "全部场景", value: "" },
              { label: "获取播放地址", value: "play_url" },
              { label: "PC 网络请求", value: "desktop_network" },
            ]}
          />

          <Input
            placeholder="报告 ID、用户 ID、版本、接口路径或错误信息"
            prefix={<SearchOutlined className="text-slate-400" />}
            value={localKeyword}
            onChange={(e) => setLocalKeyword(e.target.value)}
            onPressEnter={handleApplyFilter}
            allowClear
            className="w-full sm:w-80"
          />

          <Button type="primary" onClick={handleApplyFilter}>
            查询
          </Button>
          <Button onClick={handleReset}>
            重置
          </Button>
        </div>

        <Table<AdminFaultReportListItem>
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          size="middle"
          scroll={{ x: 1100 }}
          sticky={{ offsetHeader: 0 }}
          bordered
          pagination={{
            current: Math.floor(offset / LIMIT) + 1,
            pageSize: LIMIT,
            total,
            showTotal: (t) => `共 ${t} 条报告`,
            showQuickJumper: true,
            onChange: (page) => {
              const newOffset = (page - 1) * LIMIT;
              setOffset(newOffset);
              void load(newOffset, filter);
            },
          }}
        />
      </Card>
    </div>
  );
}
