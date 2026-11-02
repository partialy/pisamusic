import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Col, Form, Input, Progress, QRCode, Row, Space, Spin, Tag, Typography, message } from "antd";
import { ReloadOutlined, SaveOutlined, UploadOutlined, UndoOutlined } from "@ant-design/icons";
import { fetchAppShare, saveAppShare, uploadAppShareIcon, type AppShareConfig, type AppShareDraft } from "../api/appShare";
import { glassCardClasses } from "../constants/theme";
import { useAdminConfigWorkspace } from "../state/AdminConfigWorkspaceContext";

const DEFAULT_ICON = "/static/app-share/default.png";
const DEFAULTS: AppShareDraft = {
  appName: "Pisa Music", versionOverride: "", iconFileId: null,
  description: "发现更多好音乐", qrCodeText: "https://pisamusic.partialy.cn/app-share/",
  copyTemplate: "分享 Pisa Music，发现更多好音乐！\n{url}",
};

function copyText(draft: AppShareDraft): string {
  const template = draft.copyTemplate.trim();
  const url = draft.qrCodeText.trim();
  return template.includes("{url}") ? template.split("{url}").join(url) : [template, url].filter(Boolean).join("\n");
}

async function validateIcon(file: File): Promise<void> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("请选择 JPG、PNG 或 WebP 图片");
  if (file.size > 2 * 1024 * 1024) throw new Error("图标不能超过 2 MiB");
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => image.naturalWidth > 0 && image.naturalWidth === image.naturalHeight ? resolve() : reject(new Error("请选择正方形图标"));
      image.onerror = () => reject(new Error("无法读取图片，请重新选择"));
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

export default function AppSharePage() {
  const { appConfigServer, hydrated, loadError } = useAdminConfigWorkspace();
  const [form] = Form.useForm<AppShareDraft>();
  const watched = Form.useWatch([], { form, preserve: true }) as AppShareDraft | undefined;
  const draft = { ...DEFAULTS, ...watched };
  const [config, setConfig] = useState<AppShareConfig | null>(null);
  const [iconUrl, setIconUrl] = useState(DEFAULT_ICON);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reload, setReload] = useState(0);
  const mounted = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchAppShare(controller.signal).then((data) => {
      if (controller.signal.aborted) return;
      setConfig(data); form.setFieldsValue(data); setIconUrl(data.iconUrl || DEFAULT_ICON);
    }).catch((e: unknown) => {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "加载失败");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [form, reload]);

  const upload = async (file: File) => {
    setUploading(true); setProgress(0);
    try {
      await validateIcon(file);
      const uploaded = await uploadAppShareIcon(file, (value) => { if (mounted.current) setProgress(value); });
      if (!mounted.current) return;
      form.setFieldValue("iconFileId", uploaded.fileId); setIconUrl(uploaded.url);
      void messageApi.success("图标已上传，保存后才会对外生效");
    } catch (e) { if (mounted.current) void messageApi.error(e instanceof Error ? e.message : "上传失败"); }
    finally { if (mounted.current) setUploading(false); }
  };

  const save = async (values: AppShareDraft) => {
    setSaving(true);
    try {
      const data = await saveAppShare({
        appName: values.appName.trim(), versionOverride: values.versionOverride.trim(),
        iconFileId: values.iconFileId || null, description: values.description.trim(),
        qrCodeText: values.qrCodeText.trim(), copyTemplate: values.copyTemplate.trim(),
      });
      if (!mounted.current) return;
      setConfig(data); form.setFieldsValue(data); setIconUrl(data.iconUrl || DEFAULT_ICON);
      void messageApi.success("App 分享配置已发布");
    } catch (e) { if (mounted.current) void messageApi.error(e instanceof Error ? e.message : "保存失败"); }
    finally { if (mounted.current) setSaving(false); }
  };

  const busy = loading || saving || uploading;
  const androidVersion = appConfigServer.releases.android.latestVersion.trim();
  const automaticVersion = hydrated && !loadError && androidVersion && !/^v?0\.0\.0$/i.test(androidVersion) ? androidVersion : "";
  const override = draft.versionOverride.trim();
  const rawPreviewVersion = override || (config?.versionOverride ? automaticVersion : config?.version) || "";
  const previewVersion = /^v?0\.0\.0$/i.test(rawPreviewVersion) ? "" : rawPreviewVersion;
  return (
    <div className="space-y-4">
      {contextHolder}
      <Alert type="info" showIcon message="修改和上传只更新草稿，点击「保存并发布」后客户端才会获取新配置。恢复默认也需要保存。" />
      {error && <Alert type="error" showIcon message={error} action={<Button onClick={() => setReload((v) => v + 1)}>重试</Button>} />}
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>
            <Card title="分享配置" className={glassCardClasses} extra={<Button icon={<ReloadOutlined />} disabled={busy} onClick={() => setReload((v) => v + 1)}>重新拉取</Button>}>
              <Form form={form} layout="vertical" initialValues={DEFAULTS} onFinish={(values) => void save(values)} disabled={busy || !config}>
                <Form.Item name="iconFileId" hidden><Input /></Form.Item>
                <Form.Item label="应用名称" name="appName" rules={[{ required: true, whitespace: true, message: "请输入应用名称" }, { max: 60 }]}><Input maxLength={60} showCount /></Form.Item>
                <Form.Item label="版本覆盖" name="versionOverride" extra={`留空自动使用 Android 发布版本；当前生效：${config?.version || "客户端本机版本"}`} rules={[{ max: 40 }]}><Input maxLength={40} placeholder="自动模式（留空）" /></Form.Item>
                <Form.Item label="应用图标" extra="JPG / PNG / WebP，正方形，最大 2 MiB，建议 256 × 256。旧图保留，可在文件管理清理。">
                  <Space wrap>
                    <img src={iconUrl} alt="应用图标" className="h-16 w-16 rounded-xl object-cover" onError={(event) => { if (event.currentTarget.getAttribute("src") !== DEFAULT_ICON) event.currentTarget.src = DEFAULT_ICON; }} />
                    <Button icon={<UploadOutlined />} loading={uploading} onClick={() => inputRef.current?.click()}>上传图标</Button>
                    <Button onClick={() => { form.setFieldValue("iconFileId", null); setIconUrl(DEFAULT_ICON); }}>使用默认图标</Button>
                  </Space>
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} disabled={busy || !config} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
                  {uploading && <Progress percent={progress} size="small" />}
                </Form.Item>
                <Form.Item label="描述" name="description" rules={[{ max: 500 }]}><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
                <Form.Item label="二维码链接" name="qrCodeText" extra="仅支持本站 /app-share/；不要填写 code。客户端实际二维码由服务端按账号与设备生成专属短码，预览为通用链接。" rules={[{ required: true, message: "请输入完整链接" }, { max: 1000 }, { validator: (_, value: string) => { try { const url = new URL(value); if (url.protocol === "https:" && url.hostname === "pisamusic.partialy.cn" && !url.port && /^\/app-share\/?$/.test(url.pathname) && !url.hash && !url.searchParams.has("code") && !url.username && !url.password && new TextEncoder().encode(value).length <= 2000) return Promise.resolve(); } catch { /* 统一提示非法链接 */ } return Promise.reject(new Error("请输入本站 HTTPS /app-share/ 链接，不含 code、端口、账号密码或锚点")); } }]}><Input maxLength={1000} placeholder="https://" /></Form.Item>
                <Form.Item label="复制 / 系统分享文案" name="copyTemplate" extra="使用 {url} 插入二维码链接；未包含时会自动在文案末尾追加链接。" rules={[{ max: 1000 }]}><Input.TextArea rows={4} maxLength={1000} showCount /></Form.Item>
                <Space wrap>
                  <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>保存并发布</Button>
                  <Button icon={<UndoOutlined />} onClick={() => { form.setFieldsValue({ ...DEFAULTS }); setIconUrl(DEFAULT_ICON); }}>恢复默认草稿</Button>
                </Space>
              </Form>
            </Card>
          </Col>
          <Col xs={24} xl={10}>
            <Card title="实时预览" className={glassCardClasses} extra={<Tag>未保存草稿</Tag>}>
              <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-5">
                <img src={iconUrl} alt="分享图标预览" className="mx-auto h-20 w-20 rounded-2xl object-cover" onError={(event) => { if (event.currentTarget.getAttribute("src") !== DEFAULT_ICON) event.currentTarget.src = DEFAULT_ICON; }} />
                <div><Typography.Title level={4} className="!mb-1 break-words">{draft.appName || "应用名称"}</Typography.Title><Typography.Text type="secondary">{previewVersion || "客户端本机版本"}</Typography.Text></div>
                <div className="flex justify-center"><QRCode value={draft.qrCodeText || DEFAULTS.qrCodeText} size={208} color="#000" bgColor="#fff" bordered={false} /></div>
                <p className="whitespace-pre-wrap break-words text-slate-600">{draft.description}</p>
              </div>
              <Typography.Title level={5} className="!mt-6">复制与系统分享文案</Typography.Title>
              <div className="whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-4">{copyText(draft)}</div>
              <Typography.Paragraph type="secondary" className="!mt-4 !mb-0">版本模式：{draft.versionOverride.trim() ? "手动覆盖" : "自动（Android 发布版本，缺失时使用客户端版本）"}</Typography.Paragraph>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
