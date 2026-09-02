import { useCallback, useEffect, useState } from "react";
import type {
  DesktopDeviceInfo,
  DeviceFilter,
  DeviceInfo,
} from "../types/config";
import {
  deleteDesktopDevice,
  deleteDevice,
  fetchDesktopDeviceDetail,
  fetchDesktopDevices,
  fetchDeviceDetail,
  fetchDevices,
  lockDesktopDevice,
  lockDevice,
} from "../api/client";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import DevicesTab from "../components/tabs/DevicesTab";

export default function DevicesPage() {
  const { themeColor } = useAdminLayout();

  const [deviceMode, setDeviceMode] = useState<"android" | "desktop">("android");
  const [devices, setDevices] = useState<Array<DeviceInfo | DesktopDeviceInfo>>([]);
  const [deviceTotal, setDeviceTotal] = useState(0);
  const [deviceOffset, setDeviceOffset] = useState(0);
  const [deviceLimit] = useState(20);
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>({});
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | DesktopDeviceInfo | null>(null);

  const loadDevices = useCallback(async () => {
    setDeviceLoading(true);
    try {
      const fetcher = deviceMode === "desktop" ? fetchDesktopDevices : fetchDevices;
      const result = await fetcher({ ...deviceFilter, offset: deviceOffset, limit: deviceLimit });
      setDevices(result.devices);
      setDeviceTotal(result.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载设备列表失败";
      alert(msg);
    } finally {
      setDeviceLoading(false);
    }
  }, [deviceFilter, deviceOffset, deviceLimit, deviceMode]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const handleFilterChange = (filter: DeviceFilter) => {
    setDeviceFilter(filter);
    setDeviceOffset(0);
  };

  const handleDevicePageChange = (offset: number) => {
    setDeviceOffset(Math.max(0, offset));
  };

  const handleDeviceModeChange = (mode: "android" | "desktop") => {
    setDeviceMode(mode);
    setSelectedDevice(null);
    setDeviceFilter({});
    setDeviceOffset(0);
  };

  const handleSelectDevice = async (device: DeviceInfo | DesktopDeviceInfo | null) => {
    if (device) {
      try {
        const detail =
          deviceMode === "desktop"
            ? await fetchDesktopDeviceDetail(device.id)
            : await fetchDeviceDetail(device.id);
        setSelectedDevice(detail);
      } catch (e) {
        alert(e instanceof Error ? e.message : "加载设备详情失败");
      }
    } else {
      setSelectedDevice(null);
    }
  };

  const handleLockDevice = async (id: string, locked: boolean, lockEndTime?: number | null) => {
    try {
      const updated =
        deviceMode === "desktop"
          ? await lockDesktopDevice(id, locked, lockEndTime)
          : await lockDevice(id, locked, lockEndTime);
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
      if (selectedDevice?.id === id) {
        setSelectedDevice(updated);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleDeleteDevice = async (id: string) => {
    try {
      if (deviceMode === "desktop") await deleteDesktopDevice(id);
      else await deleteDevice(id);
      setSelectedDevice(null);
      await loadDevices();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  };

  return (
    <DevicesTab
      deviceMode={deviceMode}
      devices={devices}
      totalDevices={deviceTotal}
      deviceOffset={deviceOffset}
      deviceLimit={deviceLimit}
      deviceFilter={deviceFilter}
      deviceLoading={deviceLoading}
      themeColor={themeColor}
      selectedDevice={selectedDevice}
      onModeChange={handleDeviceModeChange}
      onFilterChange={handleFilterChange}
      onPageChange={handleDevicePageChange}
      onRefreshDevices={() => void loadDevices()}
      onSelectDevice={handleSelectDevice}
      onLockDevice={handleLockDevice}
      onDeleteDevice={handleDeleteDevice}
    />
  );
}
