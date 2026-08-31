import { useEffect } from "react";
import {
  Avatar,
  DatePicker,
  Form,
  Input,
  Modal,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import { UserOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { AdminUserListItem, AdminUserUpdatePayload } from "../../types/config";

const { Text } = Typography;

type Props = {
  user: AdminUserListItem;
  themeColor: string;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: AdminUserUpdatePayload) => void;
};

type FormValues = {
  username: string;
  email: string;
  vipEnabled: boolean;
  vipExpiresAt?: dayjs.Dayjs | null;
};

export default function UserEditModal({ user, saving, onClose, onSave }: Props) {
  const [form] = Form.useForm<FormValues>();
  const vipEnabled = Form.useWatch("vipEnabled", form);

  useEffect(() => {
    form.setFieldsValue({
      username: user.username,
      email: user.email,
      vipEnabled: user.vipEnabled,
      vipExpiresAt: user.vipExpiresAt ? dayjs(user.vipExpiresAt) : undefined,
    });
  }, [user, form]);

  const handleFinish = (values: FormValues) => {
    let vipExpiresAt: number | null = null;
    if (values.vipEnabled) {
      if (!values.vipExpiresAt || values.vipExpiresAt.valueOf() <= Date.now()) {
        form.setFields([
          {
            name: "vipExpiresAt",
            errors: ["启用 VIP 时，请选择晚于当前时间的到期时间"],
          },
        ]);
        return;
      }
      vipExpiresAt = values.vipExpiresAt.valueOf();
    }

    onSave({
      username: values.username.trim(),
      email: values.email.trim(),
      vipEnabled: Boolean(values.vipEnabled),
      vipExpiresAt,
    });
  };

  return (
    <Modal
      open
      centered
      title={
        <Space align="center" size={12}>
          <Avatar
            size={36}
            src={user.avatarUrl || user.avatar}
            icon={<UserOutlined />}
            className="border border-slate-200 shadow-sm"
          />
          <div>
            <span className="text-base font-bold text-slate-800">编辑用户资料</span>
            <span className="ml-2 text-xs font-mono text-slate-400">({user.id})</span>
          </div>
        </Space>
      }
      width={640}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="保存修改"
      cancelText="取消"
      destroyOnClose
    >
      <div className="max-h-[calc(85vh-140px)] overflow-y-auto pr-1">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          className="pt-3"
        >
        <Form.Item
          label="用户名"
          name="username"
          rules={[
            { required: true, message: "请输入用户名" },
            { max: 32, message: "用户名长度不能超过 32 位" },
          ]}
        >
          <Input placeholder="请输入用户名" allowClear />
        </Form.Item>

        <Form.Item
          label="邮箱地址"
          name="email"
          rules={[
            { required: true, message: "请输入邮箱地址" },
            { type: "email", message: "请输入有效的邮箱格式" },
          ]}
        >
          <Input placeholder="请输入邮箱" allowClear />
        </Form.Item>

        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <Text strong className="text-sm text-slate-800">
                PisaMusic VIP 特权
              </Text>
              <Text type="secondary" className="block text-xs">
                开启后将在到期时间前享有系统账号 VIP 权益
              </Text>
            </div>
            <Form.Item name="vipEnabled" valuePropName="checked" className="!mb-0">
              <Switch />
            </Form.Item>
          </div>

          {vipEnabled && (
            <div className="mt-4 border-t border-slate-200/60 pt-4">
              <Form.Item
                label="VIP 到期时间"
                name="vipExpiresAt"
                rules={[{ required: true, message: "请选择 VIP 到期时间" }]}
                className="!mb-0"
              >
                <DatePicker
                  showTime
                  format="YYYY-MM-DD HH:mm:ss"
                  placeholder="请选择到期时间"
                  className="w-full"
                  disabledDate={(current) =>
                    current && current.valueOf() < dayjs().startOf("day").valueOf()
                  }
                />
              </Form.Item>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 flex items-center justify-between">
          <Text type="secondary" className="text-xs">
            头像类型
          </Text>
          <Tag color={user.avatarKey === "default" ? "default" : "blue"}>
            {user.avatarKey === "default" ? "默认头像" : "自定义上传头像"}
          </Tag>
        </div>
      </Form>
      </div>
    </Modal>
  );
}
