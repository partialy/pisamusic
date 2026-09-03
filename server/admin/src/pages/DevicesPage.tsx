import { useCallback, useEffect, useState } from "react";
import type {
  AdminDirectMessagePage,
  DesktopDeviceInfo,
  DeviceFilter,
  DeviceInfo,
} from "../types/config";
import {
  deleteDesktopDevice,
  deleteDevice,
  deleteDirectMessage,
  fetchDesktopDeviceDetail,
  fetchDesktopDevices,
  fetchDirectMessages,
  fetchDeviceDetail,
  fetchDevices,
  lockDesktopDevice,
  lockDevice,
} from "../api/client";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import DevicesTab from "../components/tabs/DevicesTab";
import DirectMessageComposeModal from "../components/modals/DirectMessageComposeModal";
import { useDirectMessageComposer } from "../hooks/useDirectMessageComposer";

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
  const [deviceMessagesPage, setDeviceMessagesPage] = useState<AdminDirectMessagePage>({
    items: [],
    total: 0,
    offset: 0,
    limit: 30,
  });
  const [deviceMessagesLoading, setDeviceMessagesLoading] = useState(false);
  const directMessageComposer = useDirectMessageComposer();

  const loadDeviceMessages = useCallback(
    async (device: DeviceInfo | DesktopDeviceInfo, offset: number) => {
      setDeviceMessagesLoading(true);
      try {
        const page = await fetchDirectMessages({
          targetKind: "hostname" in device ? "desktop_device" : "android_device",
          targetId: device.id,
          offset,
          limit: 30,
        });
        setDeviceMessagesPage(page);
      } catch (e) {
        alert(e instanceof Error ? e.message : "加载设备留言失败");
      } finally {
        setDeviceMessagesLoading(false);
      }
    },
    [],
  );

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
    setDeviceMessagesPage({ items: [], total: 0, offset: 0, limit: 30 });
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
        void loadDeviceMessages(detail, 0);
      } catch (e) {
        alert(e instanceof Error ? e.message : "加载设备详情失败");
      }
    } else {
      setSelectedDevice(null);
      setDeviceMessagesPage({ items: [], total: 0, offset: 0, limit: 30 });
    }
  };

  const handleDeviceMessagesPageChange = (offset: number) => {
    if (!selectedDevice) return;
    void loadDeviceMessages(selectedDevice, offset);
  };

  const handleDeleteDeviceMessage = async (id: string) => {
    if (!selectedDevice) return;
    try {
      await deleteDirectMessage(id);
      const currentOffset = deviceMessagesPage.offset;
      const currentPage = await fetchDirectMessages({
        targetKind: "hostname" in selectedDevice ? "desktop_device" : "android_device",
        targetId: selectedDevice.id,
        offset: currentOffset,
        limit: deviceMessagesPage.limit,
      });
      if (currentPage.items.length === 0 && currentOffset > 0) {
        await loadDeviceMessages(
          selectedDevice,
          Math.max(0, currentOffset - deviceMessagesPage.limit),
        );
      } else {
        setDeviceMessagesPage(currentPage);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除设备留言失败");
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
    <>
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
      onMessage={directMessageComposer.openComposer}
      messagesPage={deviceMessagesPage}
      messagesLoading={deviceMessagesLoading}
      onMessagesPageChange={handleDeviceMessagesPageChange}
      onDeleteMessage={(id) => void handleDeleteDeviceMessage(id)}
      />

      {directMessageComposer.target && (
        <DirectMessageComposeModal
          target={directMessageComposer.target}
          sending={directMessageComposer.sending}
          onCancel={directMessageComposer.closeComposer}
          onSubmit={directMessageComposer.submit}
        />
      )}
    </>
  );
}
