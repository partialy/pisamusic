import { useState } from "react";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
} from "antd";
import { LockOutlined } from "@ant-design/icons";
import { MODAL_WIDTH } from "../../constants/theme";
import { ModalTitle } from "../ui/ModalTitle";
import { changePassword } from "../../api/client";

type Props = {
  themeColor: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ChangePasswordModal({ onClose, onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (!currentPassword || !newPassword) {
      setError("请填写当前密码和新密码");
      return;
    }
    if (newPassword.length < 6) {
      setError("新密码至少需 6 位字符");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      centered
      title={<ModalTitle icon={<LockOutlined className="text-amber-500" />} title="修改管理员密码" />}
      width={MODAL_WIDTH.sm}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={saving}
          onClick={() => void handleSubmit()}
        >
          确认修改
        </Button>,
      ]}
      destroyOnClose
    >
      <Form layout="vertical" className="pt-2">
        {error && (
          <Alert type="error" showIcon message={error} className="mb-4" />
        )}

        <Form.Item label="当前密码" required>
          <Input.Password
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="请输入当前管理员密码"
          />
        </Form.Item>

        <Form.Item label="新密码（至少 6 位）" required>
          <Input.Password
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="请输入新密码"
          />
        </Form.Item>

        <Form.Item label="确认新密码" required className="!mb-0">
          <Input.Password
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="请再次输入新密码"
            onPressEnter={() => void handleSubmit()}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
