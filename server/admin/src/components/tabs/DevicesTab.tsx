import { useEffect, useState } from "react";
import {
  Button,
  Card,
  Input,
  Popconfirm,
  Segmented,
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
  LaptopOutlined,
  LockOutlined,
  MobileOutlined,
  ReloadOutlined,
  SearchOutlined,
  UnlockOutlined,
} from "@ant-design/icons";
import type { DesktopDeviceInfo, DeviceFilter, DeviceInfo } from "../../types/config";
import { formatTimestamp } from "../../utils/date";
import DeviceDetailModal from "../modals/DeviceDetailModal";
import DeviceLockModal from "../modals/DeviceLockModal";

const { Text } = Typography;

type Props = {
  deviceMode: "android" | "desktop";
  devices: Array<DeviceInfo | DesktopDeviceInfo>;
  totalDevices: number;
  deviceOffset: number;
  deviceLimit: number;
  deviceFilter: DeviceFilter;
  deviceLoading: boolean;
  themeColor: string;
  selectedDevice: DeviceInfo | DesktopDeviceInfo | null;
  onModeChange: (mode: "android" | "desktop") => void;
  onFilterChange: (filter: DeviceFilter) => void;
  onPageChange: (offset: number) => void;
  onRefreshDevices: () => void;
  onSelectDevice: (device: DeviceInfo | DesktopDeviceInfo | null) => void;
  onLockDevice: (id: string, locked: boolean, lockEndTime?: number | null) => void;
  onDeleteDevice: (id: string) => void;
};

function isDesktopDevice(
  device: DeviceInfo | DesktopDeviceInfo
): device is DesktopDeviceInfo {
  return "hostname" in device;
}

export default function DevicesTab({
  deviceMode,
  devices,
  totalDevices,
  deviceOffset,
  deviceLimit,
  deviceFilter,
  deviceLoading,
  selectedDevice,
  onModeChange,
  onFilterChange,
  onPageChange,
  onRefreshDevices,
  onSelectDevice,
  onLockDevice,
  onDeleteDevice,
}: Props) {
  const [localSearch, setLocalSearch] = useState(deviceFilter.search ?? "");
  const [localLockedFilter, setLocalLockedFilter] = useState<string>(
    deviceFilter.locked === true
      ? "locked"
      : deviceFilter.locked === false
      ? "unlocked"
      : "all"
  );
  const [localBrand, setLocalBrand] = useState(
    deviceMode === "desktop"
      ? deviceFilter.platform ?? ""
      : deviceFilter.brand ?? ""
  );
  const [lockingDevice, setLockingDevice] = useState<DeviceInfo | DesktopDeviceInfo | null>(null);

  useEffect(() => {
    setLocalSearch(deviceFilter.search ?? "");
    setLocalBrand(
      deviceMode === "desktop"
        ? deviceFilter.platform ?? ""
        : deviceFilter.brand ?? ""
    );
    setLocalLockedFilter(
      deviceFilter.locked === true
        ? "locked"
        : deviceFilter.locked === false
        ? "unlocked"
        : "all"
    );
  }, [deviceFilter, deviceMode]);

  const handleApplyFilter = () => {
    const filter: DeviceFilter = {};
    if (localSearch.trim()) filter.search = localSearch.trim();
    if (localBrand.trim()) {
      if (deviceMode === "desktop") filter.platform = localBrand.trim();
      else filter.brand = localBrand.trim();
    }
    if (localLockedFilter === "locked") filter.locked = true;
    if (localLockedFilter === "unlocked") filter.locked = false;
    onFilterChange(filter);
  };

  const handleResetFilter = () => {
    setLocalSearch("");
    setLocalBrand("");
    setLocalLockedFilter("all");
    onFilterChange({});
  };

  const columns: ColumnsType<DeviceInfo | DesktopDeviceInfo> = [
    {
      title: "设备",
      key: "device",
      width: 260,
      render: (_, record) => {
        const desktop = isDesktopDevice(record);
        const title = desktop
          ? record.deviceName || record.hostname || "未知设备"
          : `${record.brand} ${record.model}`;
        const subtitle = desktop ? record.hostname : record.deviceName;
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Text strong ellipsis className="max-w-[180px] text-slate-800" title={title}>
                {title}
              </Text>
            </div>
            {subtitle && (
              <Text type="secondary" className="block text-xs truncate max-w-[200px]">
                {subtitle}
              </Text>
            )}
            <Tooltip title={record.id}>
              <Text type="secondary" className="block text-[11px] font-mono truncate max-w-[180px] text-slate-400">
                {record.id}
              </Text>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: "系统 / 架构",
      key: "system",
      width: 165,
      render: (_, record) => {
        const desktop = isDesktopDevice(record);
        if (desktop) {
          return (
            <div>
              <Space size={4} wrap>
                <Tag color="blue">{record.platform}</Tag>
                <Tag color="geekblue">{record.arch}</Tag>
              </Space>
              <div className="mt-1 text-xs text-slate-600 truncate" title={`${record.osName} ${record.osVersion}`}>
                {record.osName} {record.osVersion}
              </div>
            </div>
          );
        }
        return (
          <div>
            <Tag color="green">Android {record.osVersion}</Tag>
            <span className="ml-1 text-xs text-slate-500 font-mono">SDK {record.sdkVersion}</span>
          </div>
        );
      },
    },
    {
      title: "客户端版本",
      dataIndex: "appVersion",
      key: "appVersion",
      width: 120,
      align: "center",
      render: (ver: string) => (
        <Tag color="cyan" className="font-mono">
          v{ver}
        </Tag>
      ),
    },
    {
      title: "封禁状态",
      key: "lockStatus",
      width: 85,
      align: "center",
      render: (_, record) => {
        if (!record.locked) {
          return <Tag color="success">正常</Tag>;
        }
        if (record.lockEndTime === null) {
          return <Tag color="error">永久封禁</Tag>;
        }
        if (record.lockEndTime <= Date.now()) {
          return <Tag color="default">封禁已过期</Tag>;
        }
        return (
          <Tooltip title={`封禁至 ${formatTimestamp(record.lockEndTime)}`}>
            <Tag color="warning">临时封禁</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "最近活跃时间",
      dataIndex: "lastActiveAt",
      key: "lastActiveAt",
      width: 170,
      render: (ts: number) => (
        <Text type="secondary" className="text-xs">
          {formatTimestamp(ts)}
        </Text>
      ),
    },
    {
      title: "首次上报时间",
      dataIndex: "firstSeenAt",
      key: "firstSeenAt",
      width: 170,
      render: (ts: number) => (
        <Text type="secondary" className="text-xs">
          {formatTimestamp(ts)}
        </Text>
      ),
    },
    {
      title: "最近 IP",
      dataIndex: "lastSeenIp",
      key: "lastSeenIp",
      width: 140,
      render: (ip: string | null) => (
        <Text className="font-mono text-xs text-slate-600">
          {ip || "-"}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onSelectDevice(record)}
          >
            详情
          </Button>

          {record.locked ? (
            <Popconfirm
              title="确认解除封禁？"
              description="解封后该设备将恢复正常访问权限。"
              onConfirm={() => onLockDevice(record.id, false, null)}
              okText="确认解封"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                icon={<UnlockOutlined />}
                className="!text-emerald-600"
              >
                解封
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="link"
              danger
              size="small"
              icon={<LockOutlined />}
              onClick={() => setLockingDevice(record)}
            >
              封禁
            </Button>
          )}

          <Popconfirm
            title="确认删除该设备记录？"
            description="删除后该设备所有记录将被永久移除，无法恢复。"
            onConfirm={() => onDeleteDevice(record.id)}
            okText="确定删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              size="small"
              icon={<DeleteOutlined />}
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
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-slate-800">设备管理</span>
            <Segmented
              options={[
                {
                  label: "Android 设备",
                  value: "android",
                  icon: <MobileOutlined />,
                },
                {
                  label: "PC 桌面端",
                  value: "desktop",
                  icon: <LaptopOutlined />,
                },
              ]}
              value={deviceMode}
              onChange={(val) => onModeChange(val as "android" | "desktop")}
            />
            <span className="text-xs font-normal text-slate-500">
              共 {totalDevices} 台设备
            </span>
          </div>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefreshDevices}
            loading={deviceLoading}
          >
            刷新列表
          </Button>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Input
            placeholder={
              deviceMode === "desktop"
                ? "搜索设备名、主机名、系统、ID"
                : "搜索品牌、型号、设备名、ID"
            }
            prefix={<SearchOutlined className="text-slate-400" />}
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onPressEnter={handleApplyFilter}
            allowClear
            className="w-full sm:w-72"
          />

          <Select
            value={localLockedFilter}
            onChange={(val) => setLocalLockedFilter(val)}
            className="w-32"
            options={[
              { label: "全部状态", value: "all" },
              { label: "正常", value: "unlocked" },
              { label: "已封禁", value: "locked" },
            ]}
          />

          <Input
            placeholder={
              deviceMode === "desktop"
                ? "平台 (win32 / darwin / linux)"
                : "品牌 (Xiaomi / Huawei / ...)"
            }
            value={localBrand}
            onChange={(e) => setLocalBrand(e.target.value)}
            onPressEnter={handleApplyFilter}
            allowClear
            className="w-full sm:w-56"
          />

          <Button type="primary" onClick={handleApplyFilter}>
            查询
          </Button>
          <Button
            onClick={handleResetFilter}
            disabled={
              !localSearch &&
              !localBrand &&
              localLockedFilter === "all" &&
              !deviceFilter.search &&
              !deviceFilter.brand &&
              !deviceFilter.platform &&
              deviceFilter.locked === undefined
            }
          >
            重置
          </Button>
        </div>

        <Table<DeviceInfo | DesktopDeviceInfo>
          rowKey="id"
          columns={columns}
          dataSource={devices}
          loading={deviceLoading}
          size="middle"
          scroll={{ x: 1450 }}
          sticky={{ offsetHeader: 0 }}
          bordered
          pagination={{
            current: Math.floor(deviceOffset / deviceLimit) + 1,
            pageSize: deviceLimit,
            total: totalDevices,
            showTotal: (total) => `共 ${total} 台设备`,
            showQuickJumper: true,
            onChange: (page) => onPageChange((page - 1) * deviceLimit),
          }}
        />
      </Card>

      <DeviceDetailModal
        device={selectedDevice}
        onClose={() => onSelectDevice(null)}
      />

      <DeviceLockModal
        device={lockingDevice}
        onClose={() => setLockingDevice(null)}
        onLock={onLockDevice}
      />
    </div>
  );
}
