import { useEffect, useState } from "react";
import { Checkbox, Form, Input, Modal, Radio, Select, Switch, Typography, message } from "antd";
import SidebarIconField from "./SidebarIconField";
import {
  SIDEBAR_APP_ACTION_OPTIONS,
  getSidebarAppActionLabel,
  type SidebarBadgeType,
  type SidebarIconType,
  type SidebarMenuItem,
  type SidebarOpenType,
  type SidebarSectionKind,
} from "../../types/sidebarMenu";

type ItemFormValues = {
  name: string;
  enabled: boolean;
  iconType: SidebarIconType;
  iconFileId: string | null;
  iconValue: string;
  badgeType: SidebarBadgeType;
  subtitleText: string;
  retriggerDotOnce: boolean;
  openType: SidebarOpenType;
  url: string;
  actionKey: string;
};

type Props = {
  open: boolean;
  section: SidebarSectionKind;
  initialItem: SidebarMenuItem | null;
  onCancel: () => void;
  onSubmit: (item: SidebarMenuItem) => void;
};

function createItemId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  }
  return `menu_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function SidebarMenuItemModal({
  open,
  section,
  initialItem,
  onCancel,
  onSubmit,
}: Props) {
  const [form] = Form.useForm<ItemFormValues>();
  const badgeType = Form.useWatch("badgeType", form);
  const openType = Form.useWatch("openType", form);
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!open) return;
    const defaultIconType: SidebarIconType =
      initialItem?.iconType ?? (section === "grid" ? "preset" : "none");
    const safeIconType: SidebarIconType =
      section === "grid" && defaultIconType === "none" ? "preset" : defaultIconType;
    const safeBadgeType: SidebarBadgeType =
      section === "grid" && initialItem?.badgeType === "text"
        ? "none"
        : initialItem?.badgeType ?? "none";

    const hasUploadedFile = Boolean(initialItem?.iconType === "image" && initialItem.iconFileId);
    setImageMode(initialItem?.iconType === "image" && !hasUploadedFile ? "url" : "upload");
    setUploadedPreviewUrl(initialItem?.iconUrl || "");

    form.setFieldsValue({
      name: initialItem?.name ?? "",
      enabled: initialItem?.enabled ?? true,
      iconType: safeIconType,
      iconFileId: initialItem?.iconFileId ?? null,
      iconValue: initialItem?.iconValue ?? (safeIconType === "preset" ? "link" : ""),
      badgeType: safeBadgeType,
      subtitleText: initialItem?.subtitleText ?? "",
      retriggerDotOnce: false,
      openType: initialItem?.openType ?? "web",
      url: initialItem?.url || "https://",
      actionKey: initialItem?.actionKey || SIDEBAR_APP_ACTION_OPTIONS[0]!.key,
    });
  }, [open, section, initialItem, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const prevVersion = initialItem?.badgeVersion ?? 1;
    let nextBadgeVersion = prevVersion;
    if (values.badgeType === "dot_once") {
      if (initialItem && initialItem.badgeType !== "dot_once") {
        nextBadgeVersion = prevVersion + 1;
      } else if (values.retriggerDotOnce) {
        nextBadgeVersion = prevVersion + 1;
      }
    }

    const nextIconFileId =
      values.iconType === "image" && imageMode === "upload" ? values.iconFileId || null : null;
    const nextIconValue =
      values.iconType === "none"
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

    const isAppAction = values.openType === "app_action";

    onSubmit({
      id: initialItem?.id ?? createItemId(),
      enabled: values.enabled,
      sortOrder: initialItem?.sortOrder ?? 0,
      name: values.name.trim(),
      iconType: values.iconType,
      iconFileId: nextIconFileId,
      iconValue: nextIconValue,
      iconUrl: nextIconUrl,
      badgeType: values.badgeType,
      subtitleText: values.badgeType === "text" ? values.subtitleText.trim() : "",
      badgeVersion: nextBadgeVersion,
      openType: values.openType,
      url: isAppAction ? "" : values.url.trim(),
      actionKey: isAppAction ? values.actionKey : "",
    });
  };

  return (
    <Modal
      open={open}
      title={`${initialItem ? "编辑" : "新增"}${section === "list" ? "横栏入口" : "四宫格入口"}`}
      onCancel={onCancel}
      onOk={() => void handleOk()}
      okText="确定"
      cancelText="取消"
      okButtonProps={{ disabled: uploading }}
      width={620}
      destroyOnClose
    >
      {contextHolder}
      <Form form={form} layout="vertical" className="mt-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Form.Item
            label="名称"
            name="name"
            className="sm:col-span-2"
            rules={[
              { required: true, whitespace: true, message: "请输入入口名称" },
              { max: 30, message: "最多 30 字" },
            ]}
          >
            <Input maxLength={30} showCount placeholder="例如：活动中心" />
          </Form.Item>
          <Form.Item label="启用状态" name="enabled" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="停用" />
          </Form.Item>
        </div>

        <SidebarIconField
          form={form}
          allowDefault={false}
          allowNone={section === "list"}
          imageMode={imageMode}
          onImageModeChange={setImageMode}
          uploadedPreviewUrl={uploadedPreviewUrl}
          onUploadedPreviewUrlChange={setUploadedPreviewUrl}
          uploading={uploading}
          onUploadingChange={setUploading}
          onMessageSuccess={(msg) => void messageApi.success(msg)}
          onMessageError={(msg) => void messageApi.error(msg)}
        />

        <Form.Item label={section === "list" ? "副标题 / 红点" : "角标红点"} name="badgeType">
          <Radio.Group>
            <Radio value="none">无</Radio>
            {section === "list" && <Radio value="text">文字副标题</Radio>}
            <Radio value="dot_once">一次性红点（点击后消失）</Radio>
            <Radio value="dot_always">常驻红点</Radio>
          </Radio.Group>
        </Form.Item>

        {section === "list" && badgeType === "text" && (
          <Form.Item
            label="副标题文字"
            name="subtitleText"
            rules={[
              { required: true, whitespace: true, message: "请输入副标题文字" },
              { max: 20, message: "最多 20 字" },
            ]}
          >
            <Input maxLength={20} showCount placeholder="例如：限时活动" />
          </Form.Item>
        )}

        {badgeType === "dot_once" && initialItem && initialItem.badgeType === "dot_once" && (
          <Form.Item name="retriggerDotOnce" valuePropName="checked">
            <Checkbox>
              保存后重新触发客户端红点（当前版本 v{initialItem.badgeVersion}）
            </Checkbox>
          </Form.Item>
        )}

        <Form.Item label="打开方式" name="openType">
          <Radio.Group>
            <Radio value="web">打开网页</Radio>
            <Radio value="fullscreen_web">打开全屏网页</Radio>
            <Radio value="app_action">打开 App 页面 / 功能</Radio>
          </Radio.Group>
        </Form.Item>

        {openType === "app_action" ? (
          <Form.Item
            label="App 页面 / 功能"
            name="actionKey"
            rules={[{ required: true, message: "请选择目标页面或功能" }]}
          >
            <Select
              options={SIDEBAR_APP_ACTION_OPTIONS.map((item) => ({
                value: item.key,
                label: `${item.label}（${item.key}）`,
              }))}
              onChange={(key: string) => {
                if (!form.getFieldValue("name")?.trim()) {
                  form.setFieldValue("name", getSidebarAppActionLabel(key).replace(/（.*$/, ""));
                }
              }}
            />
          </Form.Item>
        ) : (
          <Form.Item
            label="目标链接"
            name="url"
            rules={[
              { required: true, whitespace: true, message: "请输入目标链接" },
              { max: 1000, message: "最多 1000 字符" },
              {
                validator: (_, val: string) => {
                  try {
                    const u = new URL((val ?? "").trim());
                    if ((u.protocol === "http:" || u.protocol === "https:") && !u.username && !u.password) {
                      return Promise.resolve();
                    }
                  } catch {
                    // ignore
                  }
                  return Promise.reject(new Error("请输入合法的 http:// 或 https:// 链接"));
                },
              },
            ]}
          >
            <Input placeholder="https://example.com" />
          </Form.Item>
        )}

        {badgeType === "dot_once" && (
          <Typography.Text type="secondary" className="text-xs">
            提示：一次性红点默认会在客户端点击该项后消除；修改名称或目标不会重置红点，仅在勾选“重新触发”或列表点击“重置红点”时递增版本。
          </Typography.Text>
        )}
      </Form>
    </Modal>
  );
}
