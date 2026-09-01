import {
  Button,
  Card,
  Input,
  InputNumber,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  ApiOutlined,
  CompassOutlined,
  DesktopOutlined,
  KeyOutlined,
  SaveOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import type { AppConfigJson, GatewaySignConfig } from "../../types/config";
import { formatDateTimeLocal, parseDateTimeLocal } from "../../utils/date";
import { EmailProviderEditor } from "./EmailProviderEditor";
import EndpointDomainReplaceForm from "./EndpointDomainReplaceForm";

const { Text } = Typography;

type Props = {
  config: AppConfigJson;
  themeColor: string;
  systemDirty: boolean;
  systemSaving: boolean;
  endpointsDirty: boolean;
  endpointsSaving: boolean;
  gatewaySignDirty: boolean;
  gatewaySignSaving: boolean;
  discoverDirty: boolean;
  discoverSaving: boolean;
  updateEndpoint: (field: string, value: string) => void;
  replaceEndpoints: (endpoints: Record<string, string>) => void;
  updateGatewaySign: (field: keyof GatewaySignConfig, value: string) => void;
  updateSection: <K extends keyof AppConfigJson, F extends keyof AppConfigJson[K]>(
    section: K,
    field: F,
    value: AppConfigJson[K][F],
  ) => void;
  onSaveSystem: () => void;
  onSaveEndpoints: () => void;
  onSaveGatewaySign: () => void;
  onSaveDiscover: () => void;
};

export default function SystemTab({
  config,
  themeColor: _,
  systemDirty,
  systemSaving,
  endpointsDirty,
  endpointsSaving,
  gatewaySignDirty,
  gatewaySignSaving,
  discoverDirty,
  discoverSaving,
  updateEndpoint,
  replaceEndpoints,
  updateGatewaySign,
  updateSection,
  onSaveSystem,
  onSaveEndpoints,
  onSaveGatewaySign,
  onSaveDiscover,
}: Props) {
  const desktopUpdater = config.bootstrap.updater?.desktop ?? {
    enabled: true,
    feedBaseUrl: "https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64",
    checkOnStartup: true,
    startupDelayMs: 15000,
  };

  const updateDesktopUpdater = (patch: Partial<typeof desktopUpdater>) => {
    updateSection("bootstrap", "updater", {
      ...(config.bootstrap.updater ?? {}),
      desktop: {
        ...desktopUpdater,
        ...patch,
      },
    });
  };

  const updateEmail = (patch: Partial<AppConfigJson["email"]>) => {
    const next = {
      ...config.email,
      ...patch,
    };
    updateSection("email", "serviceUrl", next.serviceUrl);
    updateSection("email", "provider", next.provider);
    updateSection("email", "providers", next.providers);
  };

  return (
    <div className="grid grid-cols-1 gap-4 animate-fade-in-up xl:grid-cols-2 xl:items-start">
      {/* 左侧列：系统状态与核心服务 */}
      <div className="space-y-4">
        <Card
          bordered={false}
          className="shadow-sm rounded-2xl"
          title={
            <div className="flex items-center gap-2">
              <SettingOutlined className="text-blue-500 text-lg" />
              <span className="text-lg font-bold text-slate-800">系统状态与核心服务</span>
            </div>
          }
          extra={
            <Space>
              {systemDirty ? (
                <Tag color="warning" className="!mr-0">未保存修改</Tag>
              ) : (
                <Tag color="success" className="!mr-0">已同步</Tag>
              )}
              <Button
                type="primary"
                icon={<SaveOutlined />}
                disabled={!systemDirty}
                loading={systemSaving}
                onClick={onSaveSystem}
              >
                保存系统配置
              </Button>
            </Space>
          }
        >
          <div className="space-y-5">
            {/* App Availability */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
              <div className="min-w-0">
                <Text strong className="text-sm text-slate-800 block">
                  应用服务开关 (App Available)
                </Text>
                <span className="text-xs text-slate-500 block mt-0.5">
                  关闭后，移动端与 PC 桌面端启动将显示维护提示并阻止进入。
                </span>
              </div>
              <Switch
                checked={config.availability.appAvailable}
                onChange={(val) => updateSection("availability", "appAvailable", val)}
              />
            </div>

            {!config.availability.appAvailable && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  不可用原因提示文字
                </label>
                <Input
                  value={config.availability.unavailableReason}
                  onChange={(e) => updateSection("availability", "unavailableReason", e.target.value)}
                  placeholder="例如: 系统例行维护中，请稍后再试..."
                />
              </div>
            )}

            {/* Email Service URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                邮件验证码服务网关地址
              </label>
              <Input
                value={config.email.serviceUrl}
                onChange={(e) => updateEmail({ serviceUrl: e.target.value })}
                placeholder="https://gateway.partialy.cn/auth-service/api/send/email"
                className="font-mono text-xs"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                用于用户注册、验证码登录与资料邮箱换绑验证。
              </span>
            </div>

            {/* Email Provider Editor */}
            <EmailProviderEditor
              email={config.email}
              onChange={(email) => updateEmail(email)}
            />

            {/* Bootstrap Version & Updated Time */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  启动配置版本号 (Version)
                </label>
                <Input
                  value={config.bootstrap.version}
                  onChange={(e) => updateSection("bootstrap", "version", e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  配置更新时间
                </label>
                <input
                  type="datetime-local"
                  value={formatDateTimeLocal(config.bootstrap.updatedAt)}
                  onChange={(e) => updateSection("bootstrap", "updatedAt", parseDateTimeLocal(e.target.value))}
                  className="h-8 w-full rounded-md border border-slate-200 bg-white px-3 font-mono text-xs text-slate-800 cursor-pointer"
                />
              </div>
            </div>

            {/* PC Auto Updater */}
            <Card
              size="small"
              title={
                <div className="flex items-center justify-between w-full">
                  <Space>
                    <DesktopOutlined className="text-purple-500" />
                    <span className="text-xs font-bold text-slate-700">PC 桌面端自动更新下发</span>
                  </Space>
                  <Switch
                    size="small"
                    checked={desktopUpdater.enabled}
                    onChange={(val) => updateDesktopUpdater({ enabled: val })}
                  />
                </div>
              }
              className="rounded-xl border border-slate-200 bg-slate-50/50"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    自动更新 Feed 地址
                  </label>
                  <Input
                    size="small"
                    value={desktopUpdater.feedBaseUrl}
                    onChange={(e) => updateDesktopUpdater({ feedBaseUrl: e.target.value })}
                    className="font-mono text-xs"
                    placeholder="https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-center">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                    <span className="text-xs text-slate-700 font-medium">启动时自动检查</span>
                    <Switch
                      size="small"
                      checked={desktopUpdater.checkOnStartup}
                      onChange={(val) => updateDesktopUpdater({ checkOnStartup: val })}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-700 font-medium">启动延迟检查 (毫秒)</span>
                    </div>
                    <InputNumber
                      size="small"
                      min={0}
                      value={desktopUpdater.startupDelayMs}
                      onChange={(val) => updateDesktopUpdater({ startupDelayMs: Number(val) || 0 })}
                      className="w-full font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </Card>
      </div>

      {/* 右侧列：发现页、网关签名、API 端点 */}
      <div className="space-y-4">
        {/* 发现页 */}
        <Card
          bordered={false}
          className="shadow-sm rounded-2xl"
          title={
            <div className="flex items-center gap-2">
              <CompassOutlined className="text-cyan-500 text-lg" />
              <span className="text-lg font-bold text-slate-800">发现页配置</span>
            </div>
          }
          extra={
            <Space>
              {discoverDirty ? (
                <Tag color="warning" className="!mr-0">未保存修改</Tag>
              ) : (
                <Tag color="success" className="!mr-0">已同步</Tag>
              )}
              <Button
                type="primary"
                icon={<SaveOutlined />}
                disabled={!discoverDirty}
                loading={discoverSaving}
                onClick={onSaveDiscover}
              >
                保存发现页
              </Button>
            </Space>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                发现页加载地址
              </label>
              <div className="flex gap-2">
                <Input
                  value={config.discover.url}
                  onChange={(e) => updateSection("discover", "url", e.target.value)}
                  placeholder="USE_LOCAL_FILE 或 https://pisamusic.partialy.cn"
                  className="font-mono text-xs flex-1"
                />
                <Button
                  onClick={() => updateSection("discover", "url", "USE_LOCAL_FILE")}
                >
                  使用本地模板
                </Button>
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                填 <code className="text-slate-600 font-mono">USE_LOCAL_FILE</code> 加载内置本地模板；否则填写完整 http/https 地址。
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                发现页更新时间
              </label>
              <input
                type="datetime-local"
                value={formatDateTimeLocal(config.discover.updatedAt)}
                onChange={(e) => updateSection("discover", "updatedAt", parseDateTimeLocal(e.target.value))}
                className="h-8 w-full rounded-md border border-slate-200 bg-white px-3 font-mono text-xs text-slate-800 cursor-pointer"
              />
            </div>
          </div>
        </Card>

        {/* 网关签名 */}
        <Card
          bordered={false}
          className="shadow-sm rounded-2xl"
          title={
            <div className="flex items-center gap-2">
              <KeyOutlined className="text-slate-700 text-lg" />
              <span className="text-lg font-bold text-slate-800">网关签名配置 (Gateway Sign)</span>
            </div>
          }
          extra={
            <Space>
              {gatewaySignDirty ? (
                <Tag color="warning" className="!mr-0">未保存修改</Tag>
              ) : (
                <Tag color="success" className="!mr-0">已同步</Tag>
              )}
              <Button
                type="primary"
                icon={<SaveOutlined />}
                disabled={!gatewaySignDirty}
                loading={gatewaySignSaving}
                onClick={onSaveGatewaySign}
              >
                保存签名配置
              </Button>
            </Space>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                签名密钥 (Secret)
              </label>
              <Input
                value={config.bootstrap.gatewaySign?.secret ?? ""}
                onChange={(e) => updateGatewaySign("secret", e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                签名算法标识 (as)
              </label>
              <Input
                value={config.bootstrap.gatewaySign?.as ?? ""}
                onChange={(e) => updateGatewaySign("as", e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
        </Card>

        {/* API 网关与服务端点 */}
        <Card
          bordered={false}
          className="shadow-sm rounded-2xl"
          title={
            <div className="flex items-center gap-2">
              <ApiOutlined className="text-emerald-600 text-lg" />
              <span className="text-lg font-bold text-slate-800">API 网关与服务端点</span>
            </div>
          }
          extra={
            <Space>
              {endpointsDirty ? (
                <Tag color="warning" className="!mr-0">未保存修改</Tag>
              ) : (
                <Tag color="success" className="!mr-0">已同步</Tag>
              )}
              <Button
                type="primary"
                icon={<SaveOutlined />}
                disabled={!endpointsDirty}
                loading={endpointsSaving}
                onClick={onSaveEndpoints}
              >
                保存端点配置
              </Button>
            </Space>
          }
        >
          <div className="space-y-4">
            <EndpointDomainReplaceForm
              endpoints={config.bootstrap.endpoints}
              themeColor=""
              onReplace={replaceEndpoints}
            />

            <div className="space-y-3">
              {Object.entries(config.bootstrap.endpoints).map(([key, value]) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {key}
                  </label>
                  <Input
                    value={value}
                    onChange={(e) => updateEndpoint(key, e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
