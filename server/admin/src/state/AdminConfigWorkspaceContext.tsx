import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import type {
  Announcement,
  AppConfigJson,
  AppConfigSectionsPayload,
  DynamicConfigItem,
  GatewaySignConfig,
  UpdateHistoryItem,
} from "../types/config";
import { defaultAppConfig } from "../data/defaultAppConfig";
import {
  fetchAnnouncements,
  fetchAppConfig,
  fetchDynamicConfigs,
  fetchEncryptionConfig,
  fetchUpdateHistory,
  saveAppConfigSections,
} from "../api/client";

export interface AdminConfigWorkspaceContextValue {
  appConfig: AppConfigJson;
  setAppConfig: Dispatch<SetStateAction<AppConfigJson>>;
  appConfigServer: AppConfigJson;
  setAppConfigServer: Dispatch<SetStateAction<AppConfigJson>>;
  announcements: Announcement[];
  setAnnouncements: Dispatch<SetStateAction<Announcement[]>>;
  updateHistory: UpdateHistoryItem[];
  setUpdateHistory: Dispatch<SetStateAction<UpdateHistoryItem[]>>;
  dynamicConfigs: DynamicConfigItem[];
  setDynamicConfigs: Dispatch<SetStateAction<DynamicConfigItem[]>>;
  encryptionPathsServer: string[];
  setEncryptionPathsServer: Dispatch<SetStateAction<string[]>>;
  encryptionPathsDraft: string[];
  setEncryptionPathsDraft: Dispatch<SetStateAction<string[]>>;
  loadError: string | null;
  hydrated: boolean;
  dynamicConfigLoading: boolean;
  setDynamicConfigLoading: Dispatch<SetStateAction<boolean>>;
  refreshRemote: () => Promise<void>;
  updateSection: <K extends keyof AppConfigJson, F extends keyof AppConfigJson[K]>(
    section: K,
    field: F,
    value: AppConfigJson[K][F],
  ) => void;
  updateEndpoint: (field: string, value: string) => void;
  replaceEndpoints: (endpoints: Record<string, string>) => void;
  updateGatewaySign: (field: keyof GatewaySignConfig, value: string) => void;
  saveConfigSections: (
    payload: AppConfigSectionsPayload,
    setSaving: (value: boolean) => void,
    fallbackMessage: string,
  ) => Promise<void>;
  exportPayload: {
    announcements: Announcement[];
    updateHistory: UpdateHistoryItem[];
  } & AppConfigJson;
}

const AdminConfigWorkspaceContext = createContext<AdminConfigWorkspaceContextValue | null>(null);

export function AdminConfigWorkspaceProvider({ children }: { children: ReactNode }) {
  const [appConfig, setAppConfig] = useState<AppConfigJson>(defaultAppConfig);
  const [appConfigServer, setAppConfigServer] = useState<AppConfigJson>(defaultAppConfig);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dynamicConfigs, setDynamicConfigs] = useState<DynamicConfigItem[]>([]);
  const [updateHistory, setUpdateHistory] = useState<UpdateHistoryItem[]>([]);
  const [encryptionPathsServer, setEncryptionPathsServer] = useState<string[]>([]);
  const [encryptionPathsDraft, setEncryptionPathsDraft] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [dynamicConfigLoading, setDynamicConfigLoading] = useState(false);

  const refreshRemote = useCallback(async () => {
    setLoadError(null);
    setDynamicConfigLoading(true);
    try {
      const [cfg, ann, hist, enc, dyn] = await Promise.all([
        fetchAppConfig(),
        fetchAnnouncements(),
        fetchUpdateHistory(),
        fetchEncryptionConfig(),
        fetchDynamicConfigs(),
      ]);
      setAppConfig(cfg);
      setAppConfigServer(cfg);
      setAnnouncements(ann);
      setUpdateHistory(hist);
      setEncryptionPathsServer(enc.plaintextPaths);
      setEncryptionPathsDraft(enc.plaintextPaths);
      setDynamicConfigs(dyn);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载失败";
      setLoadError(msg);
    } finally {
      setDynamicConfigLoading(false);
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    void refreshRemote();
  }, [refreshRemote]);

  const updateSection = useCallback(
    <K extends keyof AppConfigJson, F extends keyof AppConfigJson[K]>(
      section: K,
      field: F,
      value: AppConfigJson[K][F],
    ) => {
      setAppConfig((prev) => ({
        ...prev,
        [section]: {
          ...(prev[section] as object),
          [field]: value,
        },
      } as AppConfigJson));
    },
    [],
  );

  const updateEndpoint = useCallback((field: string, value: string) => {
    setAppConfig((prev) => ({
      ...prev,
      bootstrap: {
        ...prev.bootstrap,
        endpoints: {
          ...prev.bootstrap.endpoints,
          [field]: value,
        },
      },
    }));
  }, []);

  const replaceEndpoints = useCallback((endpoints: Record<string, string>) => {
    setAppConfig((prev) => ({
      ...prev,
      bootstrap: {
        ...prev.bootstrap,
        endpoints,
      },
    }));
  }, []);

  const updateGatewaySign = useCallback((field: keyof GatewaySignConfig, value: string) => {
    setAppConfig((prev) => ({
      ...prev,
      bootstrap: {
        ...prev.bootstrap,
        gatewaySign: {
          secret: prev.bootstrap.gatewaySign?.secret ?? "",
          as: prev.bootstrap.gatewaySign?.as ?? "",
          [field]: value,
        },
      },
    }));
  }, []);

  const saveConfigSections = useCallback(
    async (
      payload: AppConfigSectionsPayload,
      setSaving: (value: boolean) => void,
      fallbackMessage: string,
    ) => {
      setSaving(true);
      try {
        const result = await saveAppConfigSections(payload);
        setAppConfig(result);
        setAppConfigServer(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : fallbackMessage;
        alert(msg);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const exportPayload = useMemo(
    () => ({
      ...appConfig,
      announcements,
      updateHistory,
    }),
    [appConfig, announcements, updateHistory],
  );

  return (
    <AdminConfigWorkspaceContext.Provider
      value={{
        appConfig,
        setAppConfig,
        appConfigServer,
        setAppConfigServer,
        announcements,
        setAnnouncements,
        updateHistory,
        setUpdateHistory,
        dynamicConfigs,
        setDynamicConfigs,
        encryptionPathsServer,
        setEncryptionPathsServer,
        encryptionPathsDraft,
        setEncryptionPathsDraft,
        loadError,
        hydrated,
        dynamicConfigLoading,
        setDynamicConfigLoading,
        refreshRemote,
        updateSection,
        updateEndpoint,
        replaceEndpoints,
        updateGatewaySign,
        saveConfigSections,
        exportPayload,
      }}
    >
      {children}
    </AdminConfigWorkspaceContext.Provider>
  );
}

export function useAdminConfigWorkspace(): AdminConfigWorkspaceContextValue {
  const ctx = useContext(AdminConfigWorkspaceContext);
  if (!ctx) {
    throw new Error("useAdminConfigWorkspace must be used within an AdminConfigWorkspaceProvider");
  }
  return ctx;
}
