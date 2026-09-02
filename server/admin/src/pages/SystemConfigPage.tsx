import { useMemo, useState } from "react";
import type { GatewaySignConfig } from "../types/config";
import { useAdminConfigWorkspace } from "../state/AdminConfigWorkspaceContext";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import SystemTab from "../components/tabs/SystemTab";

export default function SystemConfigPage() {
  const { themeColor } = useAdminLayout();
  const {
    appConfig,
    appConfigServer,
    updateSection,
    updateEndpoint,
    replaceEndpoints,
    updateGatewaySign,
    saveConfigSections,
  } = useAdminConfigWorkspace();

  const [systemSaving, setSystemSaving] = useState(false);
  const [endpointsSaving, setEndpointsSaving] = useState(false);
  const [gatewaySignSaving, setGatewaySignSaving] = useState(false);
  const [discoverSaving, setDiscoverSaving] = useState(false);

  const systemDirty = useMemo(
    () =>
      JSON.stringify({
        availability: appConfig.availability,
        email: appConfig.email,
        version: appConfig.bootstrap.version,
        updatedAt: appConfig.bootstrap.updatedAt,
        updater: appConfig.bootstrap.updater,
      }) !==
      JSON.stringify({
        availability: appConfigServer.availability,
        email: appConfigServer.email,
        version: appConfigServer.bootstrap.version,
        updatedAt: appConfigServer.bootstrap.updatedAt,
        updater: appConfigServer.bootstrap.updater,
      }),
    [appConfig, appConfigServer],
  );

  const endpointsDirty = useMemo(
    () => JSON.stringify(appConfig.bootstrap.endpoints) !== JSON.stringify(appConfigServer.bootstrap.endpoints),
    [appConfig.bootstrap.endpoints, appConfigServer.bootstrap.endpoints],
  );

  const gatewaySignDirty = useMemo(
    () =>
      JSON.stringify(appConfig.bootstrap.gatewaySign ?? {}) !==
      JSON.stringify(appConfigServer.bootstrap.gatewaySign ?? {}),
    [appConfig.bootstrap.gatewaySign, appConfigServer.bootstrap.gatewaySign],
  );

  const discoverDirty = useMemo(
    () => JSON.stringify(appConfig.discover) !== JSON.stringify(appConfigServer.discover),
    [appConfig.discover, appConfigServer.discover],
  );

  const handleSaveSystem = async () => {
    await saveConfigSections(
      {
        availability: appConfig.availability,
        email: appConfig.email,
        bootstrap: {
          ...appConfigServer.bootstrap,
          version: appConfig.bootstrap.version,
          updatedAt: appConfig.bootstrap.updatedAt,
          updater: appConfig.bootstrap.updater,
        },
      },
      setSystemSaving,
      "保存系统状态失败",
    );
  };

  const handleSaveEndpoints = async () => {
    await saveConfigSections(
      { bootstrap: { ...appConfigServer.bootstrap, endpoints: appConfig.bootstrap.endpoints } },
      setEndpointsSaving,
      "保存接口配置失败",
    );
  };

  const handleSaveGatewaySign = async () => {
    const payload: GatewaySignConfig = {
      secret: (appConfig.bootstrap.gatewaySign?.secret ?? "").trim(),
      as: (appConfig.bootstrap.gatewaySign?.as ?? "").trim(),
    };
    if (!payload.secret || !payload.as) {
      alert("网关签名密钥(secret)和签名算法(as)不能为空");
      return;
    }

    setGatewaySignSaving(true);
    try {
      await saveConfigSections(
        { bootstrap: { ...appConfigServer.bootstrap, gatewaySign: payload } },
        setGatewaySignSaving,
        "保存失败",
      );
    } finally {
      setGatewaySignSaving(false);
    }
  };

  const handleSaveDiscover = async () => {
    await saveConfigSections(
      { discover: appConfig.discover },
      setDiscoverSaving,
      "保存发现配置失败",
    );
  };

  return (
    <SystemTab
      config={appConfig}
      themeColor={themeColor}
      systemDirty={systemDirty}
      systemSaving={systemSaving}
      endpointsDirty={endpointsDirty}
      endpointsSaving={endpointsSaving}
      gatewaySignDirty={gatewaySignDirty}
      gatewaySignSaving={gatewaySignSaving}
      discoverDirty={discoverDirty}
      discoverSaving={discoverSaving}
      updateEndpoint={updateEndpoint}
      replaceEndpoints={replaceEndpoints}
      updateGatewaySign={updateGatewaySign}
      updateSection={updateSection}
      onSaveSystem={() => void handleSaveSystem()}
      onSaveEndpoints={() => void handleSaveEndpoints()}
      onSaveGatewaySign={() => void handleSaveGatewaySign()}
      onSaveDiscover={() => void handleSaveDiscover()}
    />
  );
}
