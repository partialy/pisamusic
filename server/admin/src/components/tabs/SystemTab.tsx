import type { AppConfigJson, GatewaySignConfig } from "../../types/config";
import { Switch } from "../ui/Switch";
import { formatDateTimeLocal, parseDateTimeLocal } from "../../utils/date";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";
import { EmailProviderEditor } from "./EmailProviderEditor";

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

type SaveButtonProps = {
  dirty: boolean;
  saving: boolean;
  label: string;
  savingLabel: string;
  onClick: () => void;
};

function SaveButton({ dirty, saving, label, savingLabel, onClick }: SaveButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!dirty || saving}
      className={`rounded-2xl px-5 py-2.5 text-sm font-bold transition-all ${
        dirty && !saving
          ? "bg-slate-900 text-white shadow-[0_8px_20px_rgba(15,23,42,0.22)] hover:-translate-y-0.5 hover:bg-slate-800"
          : "cursor-not-allowed border border-white/60 bg-white/50 text-slate-400"
      }`}
    >
      {saving ? savingLabel : label}
    </button>
  );
}

export default function SystemTab({
  config,
  themeColor,
  systemDirty,
  systemSaving,
  endpointsDirty,
  endpointsSaving,
  gatewaySignDirty,
  gatewaySignSaving,
  discoverDirty,
  discoverSaving,
  updateEndpoint,
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
    <div className="grid grid-cols-1 gap-6 animate-fade-in-up xl:grid-cols-[1fr_1fr] xl:items-start">
      {/* 左侧列：系统状态 */}
      <div className="space-y-6">
        <div className={glassCardClasses}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center mr-4 shadow-lg shadow-indigo-500/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              系统状态
            </h2>
            <SaveButton dirty={systemDirty} saving={systemSaving} label="保存系统" savingLabel="保存中..." onClick={onSaveSystem} />
          </div>
          <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5 bg-white/40 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-base">应用服务</p>
                <p className="text-xs text-slate-500 mt-1 font-medium">关闭后，客户端将收到维护提示。</p>
              </div>
              <Switch
                checked={config.availability.appAvailable}
                onChange={(val) => updateSection("availability", "appAvailable", val)}
                themeColor={themeColor}
              />
            </div>

            <div className={`transition-all duration-500 ${config.availability.appAvailable ? "opacity-40 pointer-events-none" : "opacity-100"}`}>
              <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">不可用原因</label>
              <input
                type="text"
                value={config.availability.unavailableReason}
                onChange={(e) => updateSection("availability", "unavailableReason", e.target.value)}
                className={glassInputClasses}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">邮件服务地址</label>
              <input
                type="text"
                value={config.email.serviceUrl}
                onChange={(e) => updateEmail({ serviceUrl: e.target.value })}
                className={glassInputClasses + " font-mono text-[13px]"}
                placeholder="https://gateway.partialy.cn/auth-service/api/send/email"
              />
              <p className="text-xs text-slate-500 mt-2 ml-1 font-medium">用于邮箱验证码发送与资料邮箱验证。</p>
            </div>

            <EmailProviderEditor email={config.email} onChange={(email) => updateEmail(email)} />

            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">启动版本号</label>
                <input
                  type="text"
                  value={config.bootstrap.version}
                  onChange={(e) => updateSection("bootstrap", "version", e.target.value)}
                  className={glassInputClasses + " font-mono"}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3 ml-1">更新时间</label>
                <input
                  type="datetime-local"
                  value={formatDateTimeLocal(config.bootstrap.updatedAt)}
                  onChange={(e) => updateSection("bootstrap", "updatedAt", parseDateTimeLocal(e.target.value))}
                  className={glassInputClasses + " font-mono cursor-pointer"}
                />
                <p className="text-[10px] text-slate-400 mt-2 ml-1 font-mono">时间戳: {config.bootstrap.updatedAt}</p>
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-white/60 bg-white/40 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 text-base">PC 自动更新</p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">桌面端更新源在启动配置中下发。</p>
                </div>
                <Switch checked={desktopUpdater.enabled} onChange={(val) => updateDesktopUpdater({ enabled: val })} themeColor={themeColor} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">更新源地址</label>
                <input
                  type="text"
                  value={desktopUpdater.feedBaseUrl}
                  onChange={(e) => updateDesktopUpdater({ feedBaseUrl: e.target.value })}
                  className={glassInputClasses + " font-mono text-[13px]"}
                  placeholder="https://pm.hs.partialy.cn/api/config/desktop-updates/win32/x64"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-white/60 bg-white/50 p-3">
                  <span className="text-sm font-bold text-slate-700">启动后检查</span>
                  <Switch checked={desktopUpdater.checkOnStartup} onChange={(val) => updateDesktopUpdater({ checkOnStartup: val })} themeColor={themeColor} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">启动延迟 ms</label>
                  <input
                    type="number"
                    min={0}
                    value={desktopUpdater.startupDelayMs}
                    onChange={(e) => updateDesktopUpdater({ startupDelayMs: Number(e.target.value) })}
                    className={glassInputClasses + " font-mono"}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 右侧列：发现页、网关签名、API 网关与服务端点 */}
      <div className="space-y-6">
        <div className={glassCardClasses}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white flex items-center justify-center mr-4 shadow-lg shadow-blue-500/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 18V5l12-2v13M6 21a3 3 0 100-6 3 3 0 000 6zm12-2a3 3 0 100-6 3 3 0 000 6z" />
                </svg>
              </div>
              发现页
            </h2>
            <SaveButton dirty={discoverDirty} saving={discoverSaving} label="保存发现页" savingLabel="保存中..." onClick={onSaveDiscover} />
          </div>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">地址</label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={config.discover.url}
                  onChange={(e) => updateSection("discover", "url", e.target.value)}
                  className={glassInputClasses + " font-mono text-[13px]"}
                  placeholder="USE_LOCAL_FILE 或 https://pisamusic.partialy.cn"
                />
                <button
                  type="button"
                  onClick={() => updateSection("discover", "url", "USE_LOCAL_FILE")}
                  className="shrink-0 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-white"
                >
                  使用本地
                </button>
              </div>
              <p className="mt-2 ml-1 text-xs font-medium text-slate-500">USE_LOCAL_FILE 加载 Android 内置模板；否则填写完整 http/https 地址。</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">更新时间</label>
              <input
                type="datetime-local"
                value={formatDateTimeLocal(config.discover.updatedAt)}
                onChange={(e) => updateSection("discover", "updatedAt", parseDateTimeLocal(e.target.value))}
                className={glassInputClasses + " font-mono cursor-pointer"}
              />
              <p className="text-[10px] text-slate-400 mt-2 ml-1 font-mono">时间戳: {config.discover.updatedAt}</p>
            </div>
          </div>
        </div>

        <div className={glassCardClasses}>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center mr-4 shadow-lg shadow-slate-900/20">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H3v-4.586l5.257-5.257A6 6 0 1121 9z"
                  />
                </svg>
              </div>
              网关签名
            </h2>
            <SaveButton
              dirty={gatewaySignDirty}
              saving={gatewaySignSaving}
              label="保存签名"
              savingLabel="保存中..."
              onClick={onSaveGatewaySign}
            />
          </div>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">密钥 (secret)</label>
              <input
                type="text"
                value={config.bootstrap.gatewaySign?.secret ?? ""}
                onChange={(e) => updateGatewaySign("secret", e.target.value)}
                className={glassInputClasses + " font-mono text-[13px]"}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">签名算法 (as)</label>
              <input
                type="text"
                value={config.bootstrap.gatewaySign?.as ?? ""}
                onChange={(e) => updateGatewaySign("as", e.target.value)}
                className={glassInputClasses + " font-mono text-[13px]"}
              />
            </div>
          </div>
        </div>

        <div className={glassCardClasses}>
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 flex items-center">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 text-white flex items-center justify-center mr-4 shadow-lg shadow-emerald-500/30">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                  />
                </svg>
              </div>
              API 网关与服务端点
            </h2>
            <SaveButton
              dirty={endpointsDirty}
              saving={endpointsSaving}
              label="保存端点"
              savingLabel="保存中..."
              onClick={onSaveEndpoints}
            />
          </div>
          <div className="space-y-5">
            {Object.entries(config.bootstrap.endpoints).map(([key, value]) => (
              <div key={key}>
                <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">{key}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateEndpoint(key, e.target.value)}
                  className={glassInputClasses + " font-mono text-[13px]"}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}