import {
  Avatar,
  Button,
  Descriptions,
  Modal,
  Space,
  Tag,
  Typography,
} from "antd";
import { LaptopOutlined, MobileOutlined } from "@ant-design/icons";
import type { AdminDirectMessagePage, DesktopDeviceInfo, DeviceInfo } from "../../types/config";
import { formatTimestamp } from "../../utils/date";
import UserDirectMessagesPanel from "../user/UserDirectMessagesPanel";

const { Text } = Typography;

type Props = {
  device: DeviceInfo | DesktopDeviceInfo | null;
  messagesPage: AdminDirectMessagePage;
  messagesLoading: boolean;
  onMessagesPageChange: (offset: number) => void;
  onDeleteMessage: (id: string) => void;
  onClose: () => void;
};

function isDesktopDevice(
  device: DeviceInfo | DesktopDeviceInfo
): device is DesktopDeviceInfo {
  return "hostname" in device;
}

function LockStatusTag({
  locked,
  lockEndTime,
}: {
  locked: boolean;
  lockEndTime: number | null;
}) {
  if (!locked) {
    return <Tag color="success">正常</Tag>;
  }
  if (lockEndTime === null) {
    return <Tag color="error">永久封禁</Tag>;
  }
  if (lockEndTime <= Date.now()) {
    return <Tag color="default">封禁已过期</Tag>;
  }
  return <Tag color="warning">临时封禁至 {formatTimestamp(lockEndTime)}</Tag>;
}

export default function DeviceDetailModal({
  device,
  messagesPage,
  messagesLoading,
  onMessagesPageChange,
  onDeleteMessage,
  onClose,
}: Props) {
  if (!device) return null;

  const desktop = isDesktopDevice(device);
  const title = desktop
    ? `${device.deviceName} / ${device.hostname}`
    : `${device.brand} ${device.model}`;
  const subtitle = desktop
    ? `${device.osName} ${device.osVersion} (${device.platform} ${device.arch})`
    : `${device.deviceName} (Android ${device.osVersion} / SDK ${device.sdkVersion})`;

  const extras = Object.entries(device.extraInfo || {});

  return (
    <Modal
      open
      centered
      title={
        <Space align="center" size={12}>
          <Avatar
            size={36}
            icon={desktop ? <LaptopOutlined /> : <MobileOutlined />}
            className="bg-sky-500 text-white shadow-sm"
          />
          <div>
            <span className="text-base font-bold text-slate-800">{title}</span>
            <span className="ml-2 text-xs font-mono text-slate-400">
              ({device.id})
            </span>
          </div>
        </Space>
      }
      width={900}
      onCancel={onClose}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>,
      ]}
      destroyOnClose
    >
      <div className="space-y-4 pt-2 max-h-[calc(85vh-120px)] overflow-y-auto pr-1">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-700">系统信息：</span>
            {subtitle}
          </div>
          <Space>
            <LockStatusTag
              locked={device.locked}
              lockEndTime={device.lockEndTime}
            />
            <Tag color="cyan">客户端 v{device.appVersion}</Tag>
          </Space>
        </div>

        <Descriptions
          bordered
          size="small"
          column={{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }}
          className="bg-slate-50/50 rounded-xl overflow-hidden"
        >
          <Descriptions.Item label="设备 ID">
            <Text copyable={{ text: device.id }} className="font-mono text-xs">
              {device.id}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="设备指纹 (Fingerprint)">
            <Text copyable={{ text: device.fingerprint }} className="font-mono text-xs">
              {device.fingerprint}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="设备名称">
            {device.deviceName || "-"}
          </Descriptions.Item>

          {desktop ? (
            <>
              <Descriptions.Item label="主机名 (Hostname)">
                {device.hostname || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="操作系统名称">
                {device.osName || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="系统版本">
                {device.osVersion || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="平台">
                <Tag color="blue">{device.platform}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="架构">
                <Tag color="geekblue">{device.arch}</Tag>
              </Descriptions.Item>
            </>
          ) : (
            <>
              <Descriptions.Item label="品牌">
                {device.brand || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="型号">
                {device.model || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Android 版本">
                {device.osVersion || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="SDK 版本">
                {device.sdkVersion || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="Version Code">
                {device.appVersionCode || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="国家/地区代码">
                {device.lastCountryCode || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="时区">
                {device.lastTimezone || "N/A"}
              </Descriptions.Item>
              <Descriptions.Item label="语言区域 (Locale)">
                {device.lastLocale || "N/A"}
              </Descriptions.Item>
            </>
          )}

          <Descriptions.Item label="首次上报时间">
            {formatTimestamp(device.firstSeenAt)}
          </Descriptions.Item>
          <Descriptions.Item label="最近活跃时间">
            {formatTimestamp(device.lastActiveAt)}
          </Descriptions.Item>
          <Descriptions.Item label="首次上报 IP">
            <Text className="font-mono text-xs">{device.firstSeenIp || "N/A"}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="最近上报 IP">
            <Text className="font-mono text-xs">{device.lastSeenIp || "N/A"}</Text>
          </Descriptions.Item>
        </Descriptions>

        {extras.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="mb-3 text-sm font-bold text-slate-800">
              扩展字段 (Extra Info)
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {extras.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-slate-600">{k}</span>
                  <Text copyable={{ text: String(v) }} className="font-mono text-slate-800">
                    {String(v)}
                  </Text>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="mb-3 text-sm font-bold text-slate-800">留言记录</h4>
          <UserDirectMessagesPanel
            page={messagesPage}
            loading={messagesLoading}
            onPageChange={onMessagesPageChange}
            onDelete={onDeleteMessage}
          />
        </div>
      </div>
    </Modal>
  );
}
