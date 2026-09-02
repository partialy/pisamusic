import { Form, Input, Modal } from "antd";
import { useEffect, useState } from "react";
import type { DirectMessageTargetKind } from "../../types/config";

export type DirectMessageComposeTarget = {
  kind: DirectMessageTargetKind;
  id: string;
  label: string;
};

type Props = {
  target: DirectMessageComposeTarget;
  sending: boolean;
  onCancel: () => void;
  onSubmit: (content: string) => Promise<void>;
};

export default function DirectMessageComposeModal({
  target,
  sending,
  onCancel,
  onSubmit,
}: Props) {
  const [content, setContent] = useState("");

  useEffect(() => {
    setContent("");
  }, [target.id, target.kind]);

  const handleSubmit = async () => {
    const normalized = content.trim();
    if (!normalized) return;
    try {
      await onSubmit(normalized);
    } catch {
      // 提交失败时保留输入内容，错误提示由调用方统一展示。
    }
  };

  return (
    <Modal
      open
      centered
      title={`给“${target.label}”留言`}
      okText="发送"
      cancelText="取消"
      okButtonProps={{ disabled: !content.trim() }}
      confirmLoading={sending}
      maskClosable={!sending}
      keyboard={!sending}
      onCancel={onCancel}
      onOk={() => void handleSubmit()}
      destroyOnClose
    >
      <Form layout="vertical" className="pt-3">
        <Form.Item label="留言内容" required>
          <Input.TextArea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="请输入需要发送给该用户或设备的内容"
            maxLength={2000}
            showCount
            rows={8}
            autoFocus
            disabled={sending}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
