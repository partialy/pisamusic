import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Input, Modal, Space, Table, Tabs, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { DesktopOutlined, MobileOutlined, ReloadOutlined, SearchOutlined, UserOutlined } from "@ant-design/icons";
import { MODAL_WIDTH } from "../../constants/theme";
import { ModalTitle } from "../ui/ModalTitle";
import { fetchAdminUsers, fetchDesktopDevices, fetchDevices } from "../../api/client";
import type { AdminUserListItem, DesktopDeviceInfo, DeviceInfo } from "../../types/config";
import type { QuotaTargetRef } from "../../types/songDownloads";

type Props = {
  open: boolean;
  initialTargets?: QuotaTargetRef[];
  onClose: () => void;
  onConfirm: (targets: QuotaTargetRef[]) => void;
};

type PickerTabKey = "user" | "android" | "desktop";

function compositeKey(ref: Pick<QuotaTargetRef, "subjectType" | "subjectKey">): string {
  return `${ref.subjectType}:${ref.subjectKey}`;
}

export default function QuotaTargetPickerModal({ open, initialTargets, onClose, onConfirm }: Props) {
  const [activeTab, setActiveTab] = useState<PickerTabKey>("user");
  const [selectedMap, setSelectedMap] = useState<Map<string, QuotaTargetRef>>(new Map());

  // 账号列表状态
  const [userKeyword, setUserKeyword] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Android 设备状态
  const [androidKeyword, setAndroidKeyword] = useState("");
  const [androidPage, setAndroidPage] = useState(1);
  const [androidDevices, setAndroidDevices] = useState<DeviceInfo[]>([]);
  const [androidTotal, setAndroidTotal] = useState(0);
  const [loadingAndroid, setLoadingAndroid] = useState(false);

  // PC 设备状态
  const [desktopKeyword, setDesktopKeyword] = useState("");
  const [desktopPage, setDesktopPage] = useState(1);
  const [desktopDevices, setDesktopDevices] = useState<DesktopDeviceInfo[]>([]);
  const [desktopTotal, setDesktopTotal] = useState(0);
  const [loadingDesktop, setLoadingDesktop] = useState(false);

  useEffect(() => {
    if (!open) return;
    const next = new Map<string, QuotaTargetRef>();
    for (const item of initialTargets ?? []) {
      next.set(compositeKey(item), item);
    }
    setSelectedMap(next);
  }, [open, initialTargets]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetchAdminUsers({
        keyword: userKeyword.trim() || undefined,
        offset: (userPage - 1) * 8,
        limit: 8,
      });
      setUsers(res.list);
      setUserTotal(res.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载账号列表失败");
    } finally {
      setLoadingUsers(false);
    }
  }, [userKeyword, userPage]);

  const loadAndroidDevices = useCallback(async () => {
    setLoadingAndroid(true);
    try {
      const res = await fetchDevices({
        search: androidKeyword.trim() || undefined,
        offset: (androidPage - 1) * 8,
        limit: 8,
      });
      setAndroidDevices(res.list);
      setAndroidTotal(res.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载 Android 设备失败");
    } finally {
      setLoadingAndroid(false);
    }
  }, [androidKeyword, androidPage]);

  const loadDesktopDevices = useCallback(async () => {
    setLoadingDesktop(true);
    try {
      const res = await fetchDesktopDevices({
        search: desktopKeyword.trim() || undefined,
        offset: (desktopPage - 1) * 8,
        limit: 8,
      });
      setDesktopDevices(res.list);
      setDesktopTotal(res.total);
    } catch (err) {
      message.error(err instanceof Error ? err.message : "加载 PC 设备失败");
    } finally {
      setLoadingDesktop(false);
    }
  }, [desktopKeyword, desktopPage]);

  useEffect(() => {
    if (!open) return;
    if (activeTab === "user") void loadUsers();
    else if (activeTab === "android") void loadAndroidDevices();
    else void loadDesktopDevices();
  }, [open, activeTab, loadUsers, loadAndroidDevices, loadDesktopDevices]);

  const toggleItem = (ref: QuotaTargetRef, checked: boolean) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      const id = compositeKey(ref);
      if (checked) next.set(id, ref);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllVisible = (refs: QuotaTargetRef[], checked: boolean) => {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      for (const ref of refs) {
        const id = compositeKey(ref);
        if (checked) next.set(id, ref);
        else next.delete(id);
      }
      return next;
    });
  };

  const selectedList = useMemo(() => [...selectedMap.values()], [selectedMap]);

  const userColumns: ColumnsType<AdminUserListItem> = [
    {
      title: "账号",
      render: (_v, u) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-800">{u.username}</span>
            {u.vip && <Tag color="gold" className="!mr-0">VIP</Tag>}
          </div>
          <div className="text-xs text-slate-500">{u.email}</div>
        </div>
      ),
    },
    {
      title: "用户 ID",
      dataIndex: "id",
      width: 240,
      render: (id: string) => <span className="font-mono text-xs text-slate-400">{id}</span>,
    },
  ];

  const androidColumns: ColumnsType<DeviceInfo> = [
    {
      title: "设备名称 / 型号",
      render: (_v, d) => (
        <div>
          <div className="font-medium text-slate-800">{d.deviceName || "未知设备"}</div>
          <div className="text-xs text-slate-500">
            {d.brand} · {d.model} · Android {d.osVersion}
          </div>
        </div>
      ),
    },
    {
      title: "设备 ID",
      dataIndex: "id",
      width: 260,
      render: (id: string) => <span className="font-mono text-xs text-slate-400">{id}</span>,
    },
  ];

  const desktopColumns: ColumnsType<DesktopDeviceInfo> = [
    {
      title: "设备名称 / 系统",
      render: (_v, d) => (
        <div>
          <div className="font-medium text-slate-800">{d.deviceName || d.hostname || "未知 PC"}</div>
          <div className="text-xs text-slate-500">
            {d.hostname} · {d.osName} {d.osVersion} ({d.arch})
          </div>
        </div>
      ),
    },
    {
      title: "设备 ID",
      dataIndex: "id",
      width: 260,
      render: (id: string) => <span className="font-mono text-xs text-slate-400">{id}</span>,
    },
  ];

  const userToRef = (u: AdminUserListItem): QuotaTargetRef => ({
    subjectType: "user",
    subjectKey: u.id,
    displayName: u.username || u.email || u.id,
    secondaryLabel: u.email,
  });

  const androidToRef = (d: DeviceInfo): QuotaTargetRef => ({
    subjectType: "device",
    subjectKey: `android:${d.id}`,
    displayName: d.deviceName || d.model || d.id,
    secondaryLabel: `${d.brand} ${d.model}`,
  });

  const desktopToRef = (d: DesktopDeviceInfo): QuotaTargetRef => ({
    subjectType: "device",
    subjectKey: `desktop:${d.id}`,
    displayName: d.deviceName || d.hostname || d.id,
    secondaryLabel: `${d.osName} ${d.platform}`,
  });

  return (
    <Modal
      open={open}
      centered
      destroyOnClose
      title={
        <ModalTitle
          icon={<UserOutlined className="text-blue-500" />}
          title="选择需要配置下载配额的用户 / 设备"
        />
      }
      width={MODAL_WIDTH.lg}
      onCancel={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-500">
            已选择 <span className="font-semibold text-slate-800">{selectedList.length}</span> 个主体
            {selectedList.length > 0 && (
              <Button type="link" size="small" onClick={() => setSelectedMap(new Map())}>
                清空已选
              </Button>
            )}
          </div>
          <Space>
            <Button onClick={onClose}>取消</Button>
            <Button
              type="primary"
              disabled={selectedList.length === 0}
              onClick={() => onConfirm(selectedList)}
            >
              下一步：配置配额 ({selectedList.length})
            </Button>
          </Space>
        </div>
      }
    >
      <div className="space-y-3">
        {selectedList.length > 0 && (
          <div className="max-h-24 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2">
            <Space size={[6, 6]} wrap>
              {selectedList.map((item) => {
                const key = compositeKey(item);
                return (
                  <Tag
                    key={key}
                    closable
                    color={item.subjectType === "user" ? "blue" : "purple"}
                    onClose={() => toggleItem(item, false)}
                    className="!mr-0"
                  >
                    {item.subjectType === "user" ? "账号" : "设备"} · {item.displayName}
                  </Tag>
                );
              })}
            </Space>
          </div>
        )}

        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as PickerTabKey)}
          items={[
            {
              key: "user",
              label: (
                <span>
                  <UserOutlined /> 账号
                </span>
              ),
              children: (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      allowClear
                      placeholder="按用户名 / 邮箱 / 用户 ID 搜索"
                      prefix={<SearchOutlined />}
                      value={userKeyword}
                      onChange={(e) => {
                        setUserPage(1);
                        setUserKeyword(e.target.value);
                      }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => void loadUsers()} loading={loadingUsers} />
                  </div>
                  <Table
                    size="small"
                    bordered
                    rowKey={(u) => `user:${u.id}`}
                    loading={loadingUsers}
                    columns={userColumns}
                    dataSource={users}
                    rowSelection={{
                      selectedRowKeys: users
                        .map((u) => `user:${u.id}`)
                        .filter((k) => selectedMap.has(k)),
                      onSelect: (record, selected) => toggleItem(userToRef(record), selected),
                      onSelectAll: (selected) => toggleAllVisible(users.map(userToRef), selected),
                    }}
                    pagination={{
                      current: userPage,
                      pageSize: 8,
                      total: userTotal,
                      size: "small",
                      onChange: setUserPage,
                      showTotal: (t) => `共 ${t} 位用户`,
                    }}
                  />
                </div>
              ),
            },
            {
              key: "android",
              label: (
                <span>
                  <MobileOutlined /> Android 设备
                </span>
              ),
              children: (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      allowClear
                      placeholder="按设备名 / 品牌 / 型号 / 设备 ID 搜索"
                      prefix={<SearchOutlined />}
                      value={androidKeyword}
                      onChange={(e) => {
                        setAndroidPage(1);
                        setAndroidKeyword(e.target.value);
                      }}
                    />
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => void loadAndroidDevices()}
                      loading={loadingAndroid}
                    />
                  </div>
                  <Table
                    size="small"
                    bordered
                    rowKey={(d) => `device:android:${d.id}`}
                    loading={loadingAndroid}
                    columns={androidColumns}
                    dataSource={androidDevices}
                    rowSelection={{
                      selectedRowKeys: androidDevices
                        .map((d) => `device:android:${d.id}`)
                        .filter((k) => selectedMap.has(k)),
                      onSelect: (record, selected) => toggleItem(androidToRef(record), selected),
                      onSelectAll: (selected) => toggleAllVisible(androidDevices.map(androidToRef), selected),
                    }}
                    pagination={{
                      current: androidPage,
                      pageSize: 8,
                      total: androidTotal,
                      size: "small",
                      onChange: setAndroidPage,
                      showTotal: (t) => `共 ${t} 台设备`,
                    }}
                  />
                </div>
              ),
            },
            {
              key: "desktop",
              label: (
                <span>
                  <DesktopOutlined /> PC 设备
                </span>
              ),
              children: (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Input
                      allowClear
                      placeholder="按设备名 / 主机名 / 系统 / 设备 ID 搜索"
                      prefix={<SearchOutlined />}
                      value={desktopKeyword}
                      onChange={(e) => {
                        setDesktopPage(1);
                        setDesktopKeyword(e.target.value);
                      }}
                    />
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={() => void loadDesktopDevices()}
                      loading={loadingDesktop}
                    />
                  </div>
                  <Table
                    size="small"
                    bordered
                    rowKey={(d) => `device:desktop:${d.id}`}
                    loading={loadingDesktop}
                    columns={desktopColumns}
                    dataSource={desktopDevices}
                    rowSelection={{
                      selectedRowKeys: desktopDevices
                        .map((d) => `device:desktop:${d.id}`)
                        .filter((k) => selectedMap.has(k)),
                      onSelect: (record, selected) => toggleItem(desktopToRef(record), selected),
                      onSelectAll: (selected) => toggleAllVisible(desktopDevices.map(desktopToRef), selected),
                    }}
                    pagination={{
                      current: desktopPage,
                      pageSize: 8,
                      total: desktopTotal,
                      size: "small",
                      onChange: setDesktopPage,
                      showTotal: (t) => `共 ${t} 台设备`,
                    }}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>
    </Modal>
  );
}
