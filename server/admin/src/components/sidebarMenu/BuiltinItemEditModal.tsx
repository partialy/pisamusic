import { useEffect, useState } from "react";
import { Form, Input, Modal, Switch, message } from "antd";
import SidebarIconField from "./SidebarIconField";
import {
  SIDEBAR_BUILTIN_META,
  type SidebarBuiltinIconType,
  type SidebarBuiltinItem,
} from "../../types/sidebarMenu";

type FormValues = {
  enabled: boolean;
  name: string;
  iconType: SidebarBuiltinIconType;
  iconFileId: string | null;
  iconValue: string;
};

type Props = {
  open: boolean;
  item: SidebarBuiltinItem | null;
  onCancel: () => void;
  onSubmit: (item: SidebarBuiltinItem) => void;
};

export default function BuiltinItemEditModal({ open, item, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const meta = SIDEBAR_BUILTIN_META.find((m) => m.key === item?.key);

  useEffect(() => {
    if (!open || !item) return;
    const hasUploadedFile = Boolean(item.iconType === "image" && item.iconFileId);
    setImageMode(item.iconType === "image" && !hasUploadedFile ? "url" : "upload");
    setUploadedPreviewUrl(item.iconUrl || "");

    form.setFieldsValue({
      enabled: item.enabled,
      name: item.name,
      iconType: item.iconType,
      iconFileId: item.iconFileId,
      iconValue: item.iconValue,
    });
  }, [open, item, form]);

  const handleOk = async () => {
    if (!item) return;
    const values = await form.validateFields();
    const nextIconFileId =
      values.iconType === "image" && imageMode === "upload" ? values.iconFileId || null : null;
    const nextIconValue =
      values.iconType === "default" || values.iconType === "none"
        ? ""
        : values.iconType === "image" && imageMode === "upload"
          ? ""
          : (values.iconValue ?? "").trim();
    const nextIconUrl =
      values.iconType === "image"
        ? imageMode === "upload"
          ? uploadedPreviewUrl
          : nextIconValue
        : "";

    onSubmit({
      key: item.key,
      enabled: values.enabled,
      name: (values.name ?? "").trim(),
      iconType: values.iconType,
      iconFileId: nextIconFileId,
      iconValue: nextIconValue,
      iconUrl: nextIconUrl,
    });
  };

  return (
    <Modal
      open={open}
      title={`配置内置入口：${meta?.defaultName ?? ""}`}
      onCancel={onCancel}
      onOk={() => void handleOk()}
      okText="确定"
      cancelText="取消"
      okButtonProps={{ disabled: uploading }}
      width={600}
      destroyOnClose
    >
      {contextHolder}
      <Form form={form} layout="vertical" className="mt-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Form.Item
            label="显示名称（留空则使用默认名称）"
            name="name"
            className="sm:col-span-2"
            rules={[{ max: 30, message: "最多 30 字" }]}
          >
            <Input
              maxLength={30}
              showCount
              placeholder={`默认：${meta?.defaultName ?? ""}`}
              allowClear
            />
          </Form.Item>
          <Form.Item label="侧栏显示" name="enabled" valuePropName="checked">
            <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
          </Form.Item>
        </div>

        <SidebarIconField
          form={form}
          allowDefault
          allowNone
          imageMode={imageMode}
          onImageModeChange={setImageMode}
          uploadedPreviewUrl={uploadedPreviewUrl}
          onUploadedPreviewUrlChange={setUploadedPreviewUrl}
          uploading={uploading}
          onUploadingChange={setUploading}
          onMessageSuccess={(msg) => void messageApi.success(msg)}
          onMessageError={(msg) => void messageApi.error(msg)}
        />
      </Form>
    </Modal>
  );
}
