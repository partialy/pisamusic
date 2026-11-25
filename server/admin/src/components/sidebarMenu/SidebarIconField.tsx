import { useRef, useState } from "react";
import { AutoComplete, Button, Form, Input, Progress, Radio, Space, type FormInstance } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { uploadSidebarMenuIcon } from "../../api/sidebarMenu";
import { SIDEBAR_PRESET_ICON_OPTIONS, type SidebarBuiltinIconType } from "../../types/sidebarMenu";

type Props = {
  form: FormInstance;
  allowDefault: boolean;
  allowNone: boolean;
  imageMode: "upload" | "url";
  onImageModeChange: (mode: "upload" | "url") => void;
  uploadedPreviewUrl: string;
  onUploadedPreviewUrlChange: (url: string) => void;
  uploading: boolean;
  onUploadingChange: (loading: boolean) => void;
  onMessageSuccess: (msg: string) => void;
  onMessageError: (msg: string) => void;
};

async function validateImageFile(file: File): Promise<void> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("请选择 JPG、PNG 或 WebP 图片");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("图标文件不能超过 2 MiB");
  }
}

export default function SidebarIconField({
  form,
  allowDefault,
  allowNone,
  imageMode,
  onImageModeChange,
  uploadedPreviewUrl,
  onUploadedPreviewUrlChange,
  uploading,
  onUploadingChange,
  onMessageSuccess,
  onMessageError,
}: Props) {
  const iconType = Form.useWatch("iconType", form) as SidebarBuiltinIconType | undefined;
  const iconValue = Form.useWatch("iconValue", form) as string | undefined;
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    onUploadingChange(true);
    setProgress(0);
    try {
      await validateImageFile(file);
      const result = await uploadSidebarMenuIcon(file, (pct) => setProgress(pct));
      form.setFieldsValue({
        iconType: "image",
        iconFileId: result.fileId,
        iconValue: "",
      });
      onUploadedPreviewUrlChange(result.url);
      onMessageSuccess("图标已上传");
    } catch (e) {
      onMessageError(e instanceof Error ? e.message : "图标上传失败");
    } finally {
      onUploadingChange(false);
    }
  };

  return (
    <>
      <Form.Item label="图标类型" name="iconType">
        <Radio.Group
          optionType="button"
          onChange={(e) => {
            const next = e.target.value as SidebarBuiltinIconType;
            if (next === "preset" && !form.getFieldValue("iconValue")) {
              form.setFieldValue("iconValue", "link");
            }
          }}
        >
          {allowDefault && <Radio.Button value="default">默认内置</Radio.Button>}
          {allowNone && <Radio.Button value="none">无图标</Radio.Button>}
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
            onChange={(e) => onImageModeChange(e.target.value as "upload" | "url")}
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
          label="预置图标键名（客户端未匹配键名时将安全回退）"
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
    </>
  );
}
