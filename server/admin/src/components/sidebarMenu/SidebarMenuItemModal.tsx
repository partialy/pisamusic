import { useEffect, useRef, useState } from "react";
import {
  AutoComplete,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Progress,
  Radio,
  Space,
  Switch,
  Typography,
  message,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { uploadSidebarMenuIcon } from "../../api/sidebarMenu";
import {
  SIDEBAR_PRESET_ICON_OPTIONS,
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

async function validateImageFile(file: File): Promise<void> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("请选择 JPG、PNG 或 WebP 图片");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("图标文件不能超过 2 MiB");
  }
}

export default function SidebarMenuItemModal({
  open,
  section,
  initialItem,
  onCancel,
  onSubmit,
}: Props) {
  const [form] = Form.useForm<ItemFormValues>();
  const iconType = Form.useWatch("iconType", form);
  const iconValue = Form.useWatch("iconValue", form);
  const badgeType = Form.useWatch("badgeType", form);
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      url: initialItem?.url ?? "https://",
    });
  }, [open, section, initialItem, form]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      await validateImageFile(file);
      const result = await uploadSidebarMenuIcon(file, (pct) => setProgress(pct));
      form.setFieldsValue({
        iconType: "image",
        iconFileId: result.fileId,
        iconValue: "",
      });
      setUploadedPreviewUrl(result.url);
      void messageApi.success("图标已上传");
    } catch (e) {
      void messageApi.error(e instanceof Error ? e.message : "图标上传失败");
    } finally {
      setUploading(false);
    }
  };

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
      url: values.url.trim(),
    });
  };

  return (
    <Modal
      open={open}
      title={`${initialItem ? "编辑" : "新增"}${section === "list" ? "横栏入口" : "九宫格入口"}`}
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

        <Form.Item label="图标类型" name="iconType">
          <Radio.Group
            optionType="button"
            onChange={(e) => {
              const next = e.target.value as SidebarIconType;
              if (next === "preset" && !form.getFieldValue("iconValue")) {
                form.setFieldValue("iconValue", "link");
              }
            }}
          >
            {section === "list" && <Radio.Button value="none">无图标</Radio.Button>}
            <Radio.Button value="image">图片</Radio.Button>
            <Radio.Button value="svg">SVG 源码</Radio.Button>
            <Radio.Button value="preset">预置图标</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item name="iconFileId" hidden>
          <Input />
        </Form.Item>

        {iconType === "image" && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3">
            <Radio.Group
              size="small"
              value={imageMode}
              onChange={(e) => setImageMode(e.target.value as "upload" | "url")}
            >
              <Radio value="upload">上传图标到七牛</Radio>
              <Radio value="url">填写 HTTPS 图片链接</Radio>
            </Radio.Group>

            {imageMode === "upload" ? (
              <div className="space-y-2">
                <Space wrap>
                  {uploadedPreviewUrl && (
                    <img
                      src={uploadedPreviewUrl}
                      alt="图标预览"
                      className="h-10 w-10 rounded-lg border border-slate-200 object-cover bg-white"
                    />
                  )}
                  <Button
                    icon={<UploadOutlined />}
                    loading={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    选择图片（JPG/PNG/WebP，≤2MiB）
                  </Button>
                </Space>
                <Form.Item
                  name="iconFileId"
                  className="!mb-0"
                  rules={[
                    {
                      validator: () =>
                        form.getFieldValue("iconFileId")
                          ? Promise.resolve()
                          : Promise.reject(new Error("请先上传图片图标")),
                    },
                  ]}
                >
                  <span />
                </Form.Item>
                {uploading && <Progress percent={progress} size="small" />}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void handleUpload(file);
                  }}
                />
              </div>
            ) : (
              <Form.Item
                label="图片 HTTPS 地址"
                name="iconValue"
                className="!mb-0"
                rules={[
                  { required: true, whitespace: true, message: "请输入 HTTPS 图片链接" },
                  {
                    validator: (_, val: string) => {
                      try {
                        const u = new URL((val ?? "").trim());
                        if (u.protocol === "https:") return Promise.resolve();
                      } catch {
                        // ignore
                      }
                      return Promise.reject(new Error("仅支持合法 HTTPS 图片链接"));
                    },
                  },
                ]}
              >
                <Input placeholder="https://..." />
              </Form.Item>
            )}
          </div>
        )}

        {iconType === "svg" && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2">
            <Form.Item
              label="SVG 源码（支持 currentColor 自动适配深浅色）"
              name="iconValue"
              className="!mb-0"
              rules={[
                { required: true, whitespace: true, message: "请输入 <svg>...</svg> 源码" },
                {
                  validator: (_, val: string) => {
                    const t = (val ?? "").trim();
                    if (!/^<svg\b[\s\S]*<\/svg>$/i.test(t)) {
                      return Promise.reject(new Error("必须包含完整的 <svg>...</svg>"));
                    }
                    if (/<script\b|\bon[a-z]+\s*=|javascript:/i.test(t)) {
                      return Promise.reject(new Error("SVG 不允许包含脚本或事件属性"));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input.TextArea rows={4} placeholder='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor">...</svg>' />
            </Form.Item>
            {typeof iconValue === "string" && /^<svg\b[\s\S]*<\/svg>$/i.test(iconValue.trim()) && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>实时预览：</span>
                <span
                  className="inline-flex h-6 w-6 items-center justify-center text-slate-800 [&>svg]:h-5 [&>svg]:w-5"
                  // 管理后台仅预览管理员自己输入的已清洗 SVG
                  dangerouslySetInnerHTML={{
                    __html: iconValue.replace(/<script[\s\S]*?<\/script>/gi, ""),
                  }}
                />
              </div>
            )}
          </div>
        )}

        {iconType === "preset" && (
          <Form.Item
            label="预置图标键名（暂置框架，客户端未匹配键名时将安全回退）"
            name="iconValue"
            rules={[
              { required: true, whitespace: true, message: "请选择或输入预置图标键名" },
              {
                pattern: /^[A-Za-z0-9_-]{1,64}$/,
                message: "仅支持字母、数字、下划线和短横线",
              },
            ]}
          >
            <AutoComplete
              options={SIDEBAR_PRESET_ICON_OPTIONS.map((o) => ({
                value: o.key,
                label: o.label,
              }))}
              placeholder="选择或输入预置图标 key，如 link / feedback"
            />
          </Form.Item>
        )}

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
            <Radio value="web">打开网页（带顶栏，标题来自网页 / JS 桥）</Radio>
            <Radio value="fullscreen_web">打开全屏网页（整页 WebView，无顶栏及返回键）</Radio>
          </Radio.Group>
        </Form.Item>

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

        {badgeType === "dot_once" && (
          <Typography.Text type="secondary" className="text-xs">
            提示：一次性红点默认会在客户端点击该项后消除；修改名称或链接不会重置红点，仅在勾选“重新触发”或列表点击“重置红点”时递增版本。
          </Typography.Text>
        )}
      </Form>
    </Modal>
  );
}
