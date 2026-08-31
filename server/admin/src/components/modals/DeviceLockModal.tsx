import { useEffect, useState } from "react";
import {
  Alert,
  DatePicker,
  Form,
  Modal,
  Radio,
  Space,
  Typography,
} from "antd";
import dayjs from "dayjs";
import type { DesktopDeviceInfo, DeviceInfo } from "../../types/config";

const { Text } = Typography;

type Props = {
  device: DeviceInfo | DesktopDeviceInfo | null;
  onClose: () => void;
  onLock: (id: string, locked: boolean, lockEndTime?: number | null) => void;
};

type FormValues = {
  type: "permanent" | "temporary";
  endTime?: dayjs.Dayjs;
};

export default function DeviceLockModal({ device, onClose, onLock }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [lockType, setLockType] = useState<"permanent" | "temporary">("permanent");

  useEffect(() => {
    if (device) {
      setLockType("permanent");
      form.setFieldsValue({
        type: "permanent",
        endTime: dayjs().add(7, "day"),
      });
    }
  }, [device, form]);

  if (!device) return null;

  const deviceName = "hostname" in device
    ? `${device.deviceName} (${device.hostname})`
    : `${device.brand} ${device.model} (${device.deviceName})`;

  const handleFinish = (values: FormValues) => {
    if (values.type === "temporary") {
      if (!values.endTime || values.endTime.valueOf() <= Date.now()) {
        form.setFields([
          {
            name: "endTime",
            errors: ["请选择晚于当前时间的临时封禁截止时间"],
          },
        ]);
        return;
      }
      onLock(device.id, true, values.endTime.valueOf());
    } else {
      onLock(device.id, true, null);
    }
    onClose();
  };

  return (
    <Modal
      open
      centered
      title="封禁设备确认"
      width={500}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="确认封禁"
      okButtonProps={{ danger: true }}
      cancelText="取消"
      destroyOnClose
    >
      <div className="space-y-4 pt-2">
        <Alert
          type="warning"
          showIcon
          message="封禁后该设备将无法正常访问或同步服务端数据"
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs">
          <div className="mb-1">
            <span className="font-semibold text-slate-700">目标设备：</span>
            <span className="text-slate-800">{deviceName}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-700">设备 ID：</span>
            <Text className="font-mono text-slate-500">{device.id}</Text>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{ type: "permanent", endTime: dayjs().add(7, "day") }}
        >
          <Form.Item label="封禁类型" name="type" required>
            <Radio.Group
              onChange={(e) => setLockType(e.target.value)}
              className="w-full"
            >
              <Space direction="vertical" className="w-full">
                <Radio value="permanent">
                  <span className="font-bold text-slate-800">永久封禁</span>
                  <span className="ml-2 text-xs text-slate-400">
                    （无截止时间，需管理员手动解封）
                  </span>
                </Radio>
                <Radio value="temporary">
                  <span className="font-bold text-slate-800">临时封禁</span>
                  <span className="ml-2 text-xs text-slate-400">
                    （到达截止时间后自动解除封禁）
                  </span>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {lockType === "temporary" && (
            <Form.Item
              label="截止时间"
              name="endTime"
              rules={[{ required: true, message: "请选择临时封禁截止时间" }]}
            >
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm:ss"
                placeholder="请选择截止时间"
                className="w-full"
                disabledDate={(current) =>
                  current && current.valueOf() < dayjs().startOf("day").valueOf()
                }
              />
            </Form.Item>
          )}
        </Form>
      </div>
    </Modal>
  );
}
