import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type {
  Announcement,
  AppConfigJson,
  AppConfigSectionsPayload,
  DesktopDeviceInfo,
  DeviceFilter,
  DeviceInfo,
  DynamicConfigItem,
  GatewaySignConfig,
  UpdateFormDraft,
  UpdateHistoryItem,
} from "./types/config";
import { DEFAULT_PLAINTEXT_PATHS } from "./types/config";
import { bgPresets, colorPresets, tabs, type TabId } from "./constants/theme";
import { getCurrentPlus8Time } from "./utils/date";
import {
  createDynamicConfig,
  deleteDynamicConfig as deleteDynamicConfigApi,
  deleteAnnouncement as deleteAnnouncementApi,
  deleteDesktopDevice,
  deleteDevice,
  fetchAnnouncements,
  fetchAppConfig,
  fetchDynamicConfigs,
  fetchDesktopDeviceDetail,
  fetchDesktopDevices,
  fetchDeviceDetail,
  fetchDevices,
  fetchEncryptionConfig,
  fetchUpdateHistory,
  lockDesktopDevice,
  lockDevice,
  publishUpdate,
  registerUnauthorizedHandler,
  saveAppConfigSections,
  saveAnnouncement as saveAnnouncementApi,
  saveEncryptionConfig,
  uploadReleasePackage,
  updateDynamicConfig,
  deleteReleasePackage,
} from "./api/client";
import { clearStoredToken, getStoredToken } from "./auth/token";
import { defaultAppConfig } from "./data/defaultAppConfig";
import { draftToPayload, historyItemToDraft } from "./utils/updatePayload";
import { loadTheme, saveTheme } from "./utils/themeStorage";
import LoginPage from "./components/LoginPage";
import ChangePasswordModal from "./components/modals/ChangePasswordModal";
import DynamicConfigModal from "./components/modals/DynamicConfigModal";
import NoticeModal from "./components/modals/NoticeModal";
import UpdateModal from "./components/modals/UpdateModal";
import JsonExportModal from "./components/modals/JsonExportModal";

const SystemTab = lazy(() => import("./components/tabs/SystemTab"));
const UpdateTab = lazy(() => import("./components/tabs/UpdateTab"));
const ContentTab = lazy(() => import("./components/tabs/ContentTab"));
const AnnouncementsTab = lazy(() => import("./components/tabs/AnnouncementsTab"));
const DynamicConfigTab = lazy(() => import("./components/tabs/DynamicConfigTab"));
const EncryptionTab = lazy(() => import("./components/tabs/EncryptionTab"));
const DevicesTab = lazy(() => import("./components/tabs/DevicesTab"));

function tabFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-slate-500 font-semibold animate-fade-in-up">
      加载中…
    </div>
  );
}

const initialTheme = loadTheme();
const NEW_DYNAMIC_CONFIG: DynamicConfigItem = {
  id: "",
  type: "string",
  content: "",
  createdAt: 0,
  updatedAt: 0,
};

export default function App() {
  const [authed, setAuthed] = useState(() => Boolean(getStoredToken()));

  useEffect(() => {
    registerUnauthorizedHandler(() => setAuthed(false));
    return () => registerUnauthorizedHandler(null);
  }, []);

  if (!authed) {
    return <LoginPage onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <AdminDashboard
      onLogout={() => {
        clearStoredToken();
        setAuthed(false);
      }}
    />
  );
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const [appConfig, setAppConfig] = useState<AppConfigJson>(defaultAppConfig);
  const [appConfigServer, setAppConfigServer] = useState<AppConfigJson>(defaultAppConfig);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dynamicConfigs, setDynamicConfigs] = useState<DynamicConfigItem[]>([]);
  const [updateHistory, setUpdateHistory] = useState<UpdateHistoryItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const [currentTab, setCurrentTab] = useState<TabId>("system");
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const [themeColor, setThemeColor] = useState(initialTheme.themeColor);
  const [bgIndex, setBgIndex] = useState(initialTheme.bgIndex);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [editingNotice, setEditingNotice] = useState<Announcement | null>(null);
  const [editingNoticeIndex, setEditingNoticeIndex] = useState(-1);
  const [editingDynamicConfig, setEditingDynamicConfig] = useState<DynamicConfigItem | null>(null);
  const [editingDynamicConfigIsNew, setEditingDynamicConfigIsNew] = useState(true);
  const [dynamicConfigLoading, setDynamicConfigLoading] = useState(false);
  const [dynamicConfigSaving, setDynamicConfigSaving] = useState(false);

  const [editingUpdateDraft, setEditingUpdateDraft] = useState<UpdateFormDraft | null>(null);
  const [editingUpdateIsNew, setEditingUpdateIsNew] = useState(true);
  const [publishSaving, setPublishSaving] = useState(false);
  const [packageUploading, setPackageUploading] = useState(false);
  const [packageUploadProgress, setPackageUploadProgress] = useState<number | null>(null);
  const [deletingPackageHistoryId, setDeletingPackageHistoryId] = useState<string | null>(null);

  const [encryptionPathsServer, setEncryptionPathsServer] = useState<string[]>([]);
  const [encryptionPathsDraft, setEncryptionPathsDraft] = useState<string[]>([]);
  const [encryptionSaving, setEncryptionSaving] = useState(false);
  const [systemSaving, setSystemSaving] = useState(false);
  const [endpointsSaving, setEndpointsSaving] = useState(false);
  const [gatewaySignSaving, setGatewaySignSaving] = useState(false);
  const [discoverSaving, setDiscoverSaving] = useState(false);
  const [contentSaving, setContentSaving] = useState(false);

  const [deviceMode, setDeviceMode] = useState<"android" | "desktop">("android");
  const [devices, setDevices] = useState<Array<DeviceInfo | DesktopDeviceInfo>>([]);
  const [deviceTotal, setDeviceTotal] = useState(0);
  const [deviceOffset, setDeviceOffset] = useState(0);
  const [deviceLimit] = useState(20);
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>({});
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | DesktopDeviceInfo | null>(null);

  const displayHistory = useMemo(() => [...updateHistory].reverse(), [updateHistory]);

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

  useEffect(() => {
    saveTheme({ themeColor, bgIndex });
  }, [themeColor, bgIndex]);

  const updateSection = useCallback(
    <K extends keyof AppConfigJson, F extends keyof AppConfigJson[K]>(section: K, field: F, value: AppConfigJson[K][F]) => {
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

  const handleAddAnnouncement = () => {
    const plus8Time = getCurrentPlus8Time();
    const newId = `notice_${plus8Time.slice(0, 10).replace(/-/g, "")}_${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;
    setEditingNotice({
      id: newId,
      content: "<div><h3>新公告</h3><p>在此输入内容...</p></div>",
      time: plus8Time,
      publisher: "PisaMusic Team",
      confirmText: "我知道了",
      showEveryTime: false,
      showGotoButton: false,
      gotoUrl: "",
    });
    setEditingNoticeIndex(-1);
  };

  const handleEditAnnouncement = (index: number) => {
    setEditingNotice({ ...announcements[index] });
    setEditingNoticeIndex(index);
  };

  const handleSaveAnnouncement = async () => {
    if (!editingNotice) return;
    try {
      const saved = await saveAnnouncementApi(editingNotice);
      const next = [...announcements];
      if (editingNoticeIndex === -1) {
        next.unshift(saved);
      } else {
        next[editingNoticeIndex] = saved;
      }
      setAnnouncements(next);
      setEditingNotice(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存公告失败");
    }
  };

  const handleDeleteAnnouncement = async (index: number) => {
    const target = announcements[index];
    if (!target) return;
    if (window.confirm("确定要删除这条公告吗？")) {
      try {
        await deleteAnnouncementApi(target.id);
        setAnnouncements(announcements.filter((_, i) => i !== index));
      } catch (e) {
        alert(e instanceof Error ? e.message : "删除公告失败");
      }
    }
  };

  const handleAddDynamicConfig = () => {
    setEditingDynamicConfigIsNew(true);
    setEditingDynamicConfig({ ...NEW_DYNAMIC_CONFIG });
  };

  const handleEditDynamicConfig = (item: DynamicConfigItem) => {
    setEditingDynamicConfigIsNew(false);
    setEditingDynamicConfig({ ...item });
  };

  const handleSaveDynamicConfig = async () => {
    if (!editingDynamicConfig) return;
    setDynamicConfigSaving(true);
    try {
      const payload = {
        id: editingDynamicConfig.id,
        type: editingDynamicConfig.type,
        content: editingDynamicConfig.content,
      };
      const saved = editingDynamicConfigIsNew
        ? await createDynamicConfig(payload)
        : await updateDynamicConfig(editingDynamicConfig.id, payload);
      setDynamicConfigs((prev) => {
        const next = prev.filter((item) => item.id !== saved.id);
        return [saved, ...next];
      });
      setEditingDynamicConfig(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存动态配置失败");
    } finally {
      setDynamicConfigSaving(false);
    }
  };

  const handleDeleteDynamicConfig = async (item: DynamicConfigItem) => {
    if (!window.confirm(`确定要删除动态配置 ${item.id} 吗？`)) return;
    try {
      await deleteDynamicConfigApi(item.id);
      setDynamicConfigs((prev) => prev.filter((current) => current.id !== item.id));
      if (editingDynamicConfig?.id === item.id) {
        setEditingDynamicConfig(null);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除动态配置失败");
    }
  };

  const openNewUpdate = () => {
    const plus8Time = getCurrentPlus8Time();
    setEditingUpdateIsNew(true);
    setPackageUploadProgress(null);
    setEditingUpdateDraft({
      platform: "android",
      version: "v",
      updateTime: plus8Time,
      forceUpdate: false,
      downloadUrl: "",
      officialUrl: "https://pisamusic.partialy.cn",
      updateContent: "",
      platformLabel: "Android",
      fileSizeText: "",
      available: true,
      releaseFileId: undefined,
    });
  };

  const openEditUpdate = (item: UpdateHistoryItem) => {
    setEditingUpdateIsNew(false);
    setPackageUploadProgress(null);
    setEditingUpdateDraft(historyItemToDraft(item));
  };

  const handleSubmitPublish = async () => {
    if (!editingUpdateDraft) return;
    const payload = draftToPayload(editingUpdateDraft);
    if (
      !payload.latestVersion ||
      !payload.updateTime ||
      !payload.officialUrl ||
      !payload.updateContent ||
      !payload.platformLabel ||
      (payload.platform === "android" && !payload.downloadUrl) ||
      (payload.available && !payload.downloadUrl)
    ) {
      alert("请填写完整：版本号、时间、官网地址、更新说明；Android 或已开放下载的版本还需要下载地址。");
      return;
    }
    setPublishSaving(true);
    try {
      await publishUpdate(payload);
      setEditingUpdateDraft(null);
      await refreshRemote();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "发布失败";
      alert(msg);
    } finally {
      setPublishSaving(false);
    }
  };

  const formatFileSizeText = (size: number): string => {
    if (!Number.isFinite(size) || size <= 0) return "";
    const mb = size / 1024 / 1024;
    if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)}MB`;
    return `${Math.max(1, Math.round(size / 1024))}KB`;
  };

  const handleUploadReleasePackage = async (file: File) => {
    if (!editingUpdateDraft) return;
    setPackageUploading(true);
    setPackageUploadProgress(0);
    try {
      const releaseFile = await uploadReleasePackage(file, editingUpdateDraft.platform, setPackageUploadProgress);
      setEditingUpdateDraft((prev) =>
        prev
          ? {
              ...prev,
              downloadUrl: releaseFile.downloadUrl,
              fileSizeText: formatFileSizeText(releaseFile.fileSize),
              available: true,
              releaseFileId: releaseFile.id,
            }
          : prev,
      );
    } catch (e) {
      setPackageUploadProgress(null);
      alert(e instanceof Error ? e.message : "上传安装包失败");
    } finally {
      setPackageUploading(false);
    }
  };

  const handleDeleteReleasePackage = async (item: UpdateHistoryItem) => {
    if (!item.releaseFile || item.releaseFile.status !== "uploaded") return;
    if (!window.confirm(`确定要删除 ${item.version} 关联的七牛安装包吗？`)) return;
    setDeletingPackageHistoryId(item.id);
    try {
      await deleteReleasePackage(item.id);
      await refreshRemote();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除安装包失败");
    } finally {
      setDeletingPackageHistoryId(null);
    }
  };

  const encryptionDirty = useMemo(() => {
    if (encryptionPathsServer.length !== encryptionPathsDraft.length) return true;
    for (let i = 0; i < encryptionPathsServer.length; i += 1) {
      if (encryptionPathsServer[i] !== encryptionPathsDraft[i]) return true;
    }
    return false;
  }, [encryptionPathsServer, encryptionPathsDraft]);

  const handleSaveEncryption = async () => {
    setEncryptionSaving(true);
    try {
      const result = await saveEncryptionConfig(encryptionPathsDraft);
      setEncryptionPathsServer(result.plaintextPaths);
      setEncryptionPathsDraft(result.plaintextPaths);
      setAppConfig((prev) => ({
        ...prev,
        encryption: { plaintextPaths: result.plaintextPaths },
      }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      alert(msg);
    } finally {
      setEncryptionSaving(false);
    }
  };

  const handleReloadEncryption = async () => {
    try {
      const enc = await fetchEncryptionConfig();
      setEncryptionPathsServer(enc.plaintextPaths);
      setEncryptionPathsDraft(enc.plaintextPaths);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "拉取失败";
      alert(msg);
    }
  };

  const systemDirty = useMemo(
    () =>
      JSON.stringify({
        availability: appConfig.availability,
        version: appConfig.bootstrap.version,
        updatedAt: appConfig.bootstrap.updatedAt,
      }) !==
      JSON.stringify({
        availability: appConfigServer.availability,
        version: appConfigServer.bootstrap.version,
        updatedAt: appConfigServer.bootstrap.updatedAt,
      }),
    [appConfig, appConfigServer],
  );

  const endpointsDirty = useMemo(
    () => JSON.stringify(appConfig.bootstrap.endpoints) !== JSON.stringify(appConfigServer.bootstrap.endpoints),
    [appConfig.bootstrap.endpoints, appConfigServer.bootstrap.endpoints],
  );

  const gatewaySignDirty = useMemo(
    () => JSON.stringify(appConfig.bootstrap.gatewaySign ?? {}) !== JSON.stringify(appConfigServer.bootstrap.gatewaySign ?? {}),
    [appConfig.bootstrap.gatewaySign, appConfigServer.bootstrap.gatewaySign],
  );

  const discoverDirty = useMemo(
    () => JSON.stringify(appConfig.discover) !== JSON.stringify(appConfigServer.discover),
    [appConfig.discover, appConfigServer.discover],
  );

  const contentDirty = useMemo(
    () =>
      JSON.stringify({
        agreement: appConfig.agreement,
        privacy: appConfig.privacy,
        about: appConfig.about,
      }) !==
      JSON.stringify({
        agreement: appConfigServer.agreement,
        privacy: appConfigServer.privacy,
        about: appConfigServer.about,
      }),
    [appConfig, appConfigServer],
  );

  const saveConfigSections = async (
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
  };

  const handleSaveSystem = async () => {
    await saveConfigSections(
      {
        availability: appConfig.availability,
        bootstrap: {
          ...appConfigServer.bootstrap,
          version: appConfig.bootstrap.version,
          updatedAt: appConfig.bootstrap.updatedAt,
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

  const handleSaveContent = async () => {
    await saveConfigSections(
      {
        agreement: appConfig.agreement,
        privacy: appConfig.privacy,
        about: appConfig.about,
      },
      setContentSaving,
      "保存内容与协议失败",
    );
  };

  const handleSaveGatewaySign = async () => {
    const payload: GatewaySignConfig = {
      secret: (appConfig.bootstrap.gatewaySign?.secret ?? "").trim(),
      as: (appConfig.bootstrap.gatewaySign?.as ?? "").trim(),
    };
    if (!payload.secret || !payload.as) {
      alert("gatewaySign.secret 和 gatewaySign.as 不能为空");
      return;
    }

    setGatewaySignSaving(true);
    try {
      const result = await saveAppConfigSections({ bootstrap: { ...appConfigServer.bootstrap, gatewaySign: payload } });
      setAppConfig(result);
      setAppConfigServer(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "保存失败";
      alert(msg);
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

  const loadDevices = useCallback(async () => {
    setDeviceLoading(true);
    try {
      const fetcher = deviceMode === "desktop" ? fetchDesktopDevices : fetchDevices;
      const result = await fetcher({ ...deviceFilter, offset: deviceOffset, limit: deviceLimit });
      setDevices(result.devices);
      setDeviceTotal(result.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "加载设备列表失败";
      alert(msg);
    } finally {
      setDeviceLoading(false);
    }
  }, [deviceFilter, deviceOffset, deviceLimit, deviceMode]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const handleFilterChange = (filter: DeviceFilter) => {
    setDeviceFilter(filter);
    setDeviceOffset(0);
  };

  const handleDevicePageChange = (offset: number) => {
    setDeviceOffset(Math.max(0, offset));
  };

  const handleDeviceModeChange = (mode: "android" | "desktop") => {
    setDeviceMode(mode);
    setSelectedDevice(null);
    setDeviceFilter({});
    setDeviceOffset(0);
  };

  const handleSelectDevice = async (device: DeviceInfo | DesktopDeviceInfo | null) => {
    if (device) {
      try {
        const detail = deviceMode === "desktop"
          ? await fetchDesktopDeviceDetail(device.id)
          : await fetchDeviceDetail(device.id);
        setSelectedDevice(detail);
      } catch (e) {
        alert(e instanceof Error ? e.message : "加载设备详情失败");
      }
    } else {
      setSelectedDevice(null);
    }
  };

  const handleLockDevice = async (id: string, locked: boolean, lockEndTime?: number | null) => {
    try {
      const updated = deviceMode === "desktop"
        ? await lockDesktopDevice(id, locked, lockEndTime)
        : await lockDevice(id, locked, lockEndTime);
      setDevices(prev => prev.map(d => d.id === id ? updated : d));
      if (selectedDevice?.id === id) {
        setSelectedDevice(updated);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "操作失败");
    }
  };

  const handleDeleteDevice = async (id: string) => {
    try {
      if (deviceMode === "desktop") await deleteDesktopDevice(id);
      else await deleteDevice(id);
      setSelectedDevice(null);
      await loadDevices();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    }
  };

  const exportPayload = useMemo(
    () => ({
      ...appConfig,
      announcements,
      updateHistory,
    }),
    [appConfig, announcements, updateHistory],
  );

  const currentTitle = tabs.find((t) => t.id === currentTab)?.name ?? "";
  const handleSelectTab = (tabId: TabId) => {
    setCurrentTab(tabId);
    setMobileNavOpen(false);
  };

  const themePanel = (
    <div className="absolute right-0 top-12 w-[min(16rem,calc(100vw-2rem))] rounded-3xl border border-white/60 bg-white/90 p-5 shadow-[0_10px_40px_rgba(0,0,0,0.1)] backdrop-blur-2xl z-50 animate-fade-in-up lg:left-6 lg:right-auto lg:top-20 lg:w-64 lg:before:content-[''] lg:before:absolute lg:before:-top-2 lg:before:right-6 lg:before:w-4 lg:before:h-4 lg:before:bg-white/90 lg:before:rotate-45 lg:before:border-l lg:before:border-t lg:before:border-white/60">
      <h3 className="text-[11px] font-bold text-slate-500 mb-3 tracking-widest uppercase">鑳屾櫙娓愬彉</h3>
      <div className="grid grid-cols-4 gap-2 mb-6">
        {bgPresets.map((bg, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setBgIndex(idx)}
            className={`h-6 rounded-full border-2 ${bgIndex === idx ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:scale-105"} bg-gradient-to-r ${bg.base} transition-all`}
          />
        ))}
      </div>

      <h3 className="text-[11px] font-bold text-slate-500 mb-3 tracking-widest uppercase">涓婚棰滆壊</h3>
      <div className="grid grid-cols-4 gap-3">
        {colorPresets.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => setThemeColor(color)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${themeColor === color ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:scale-105"}`}
            style={{ backgroundColor: color }}
          />
        ))}
        <div
          className={`relative w-8 h-8 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${!colorPresets.includes(themeColor) ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:border-slate-400"}`}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 pointer-events-none" />
          <div className="absolute inset-1 bg-white rounded-full pointer-events-none flex items-center justify-center">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: themeColor }} />
          </div>
          <input
            type="color"
            value={colorPresets.includes(themeColor) ? "#ffffff" : themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="absolute inset-[-10px] w-12 h-12 opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );

  const sidebarContent = (
    <>
      <div className="h-20 flex items-center px-5 sm:px-6 border-b border-white/50 relative">
        <div className="w-10 h-10 rounded-[14px] flex items-center justify-center mr-3 shadow-lg bg-white/80 border border-white/70 overflow-hidden">
          <img src="/pisamusic_icon_1024.png" alt="PisaMusic" className="h-full w-full object-contain p-1" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-800 flex-1">PisaAdmin</h1>
        <button
          type="button"
          onClick={() => setShowThemePanel(!showThemePanel)}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-full transition-colors relative z-50"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
        </button>
        {showThemePanel && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowThemePanel(false)} aria-hidden />
            {themePanel}
          </>
        )}
      </div>

      <nav className="flex-1 py-5 lg:py-8 px-4 space-y-2 overflow-y-auto no-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleSelectTab(tab.id)}
            style={currentTab === tab.id ? { backgroundColor: themeColor, color: "#fff", boxShadow: `0 10px 15px -3px ${themeColor}40` } : {}}
            className={`w-full flex items-center px-5 py-3.5 rounded-[20px] transition-all duration-300 ${
              currentTab === tab.id ? "font-bold lg:translate-x-1" : "text-slate-500 hover:bg-white/60 hover:text-slate-800 font-semibold"
            }`}
          >
            <svg className={`w-5 h-5 mr-3 shrink-0 ${currentTab === tab.id ? "text-white/90" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
            </svg>
            <span className="truncate">{tab.name}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 sm:p-6 space-y-3">
        <button
          type="button"
          onClick={() => {
            setShowChangePasswordModal(true);
            setMobileNavOpen(false);
          }}
          className="w-full py-3 rounded-2xl text-sm font-bold border border-white/60 bg-white/50 text-slate-700 hover:bg-white/80 transition-colors shadow-sm"
        >
          淇敼瀵嗙爜
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-full py-3 rounded-2xl text-sm font-bold border border-white/60 bg-white/50 text-slate-700 hover:bg-white/80 transition-colors shadow-sm"
        >
          閫€鍑虹櫥褰?        </button>
        <div className="bg-white/50 backdrop-blur-md rounded-2xl p-5 border border-white/60 shadow-sm">
          <p className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">鐜</p>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
            <span className="text-sm font-extrabold text-slate-800">Production</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="relative flex min-h-dvh w-full overflow-x-hidden font-sans text-slate-800 lg:h-dvh lg:overflow-hidden">
      <div className={`fixed inset-0 z-[-1] bg-gradient-to-br ${bgPresets[bgIndex].base} transition-colors duration-700`}>
        <div
          className={`absolute top-[-10%] left-[-10%] w-96 h-96 ${bgPresets[bgIndex].blob1} rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-[pulse_8s_ease-in-out_infinite] transition-colors duration-700`}
        />
        <div
          className={`absolute top-[20%] right-[-10%] w-96 h-96 ${bgPresets[bgIndex].blob2} rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-[pulse_10s_ease-in-out_infinite_reverse] transition-colors duration-700`}
        />
        <div
          className={`absolute bottom-[-20%] left-[20%] w-96 h-96 ${bgPresets[bgIndex].blob3} rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-[pulse_9s_ease-in-out_infinite] transition-colors duration-700`}
        />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="鍏抽棴鑿滃崟"
            className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-dvh w-[min(18rem,calc(100vw-2rem))] flex-col border-r border-white/60 bg-white/80 shadow-2xl backdrop-blur-2xl animate-fade-in-up">
            {sidebarContent}
          </aside>
        </div>
      )}

      <aside className="w-64 bg-white/60 backdrop-blur-2xl border-r border-white/60 hidden lg:flex flex-col fixed inset-y-0 z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="h-20 flex items-center px-6 border-b border-white/50 relative">
          <div className="w-10 h-10 rounded-[14px] flex items-center justify-center mr-3 shadow-lg bg-white/80 border border-white/70 overflow-hidden">
            <img src="/pisamusic_icon_1024.png" alt="PisaMusic" className="h-full w-full object-contain p-1" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-800 flex-1">PisaAdmin</h1>

          <button
            type="button"
            onClick={() => setShowThemePanel(!showThemePanel)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white/50 rounded-full transition-colors relative z-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
          </button>

          {showThemePanel && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowThemePanel(false)} aria-hidden />
              <div className="absolute top-20 left-6 w-64 bg-white/90 backdrop-blur-2xl border border-white/60 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] p-5 z-50 animate-fade-in-up before:content-[''] before:absolute before:-top-2 before:right-6 before:w-4 before:h-4 before:bg-white/90 before:rotate-45 before:border-l before:border-t before:border-white/60">
                <h3 className="text-[11px] font-bold text-slate-500 mb-3 tracking-widest uppercase">背景渐变</h3>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {bgPresets.map((bg, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBgIndex(idx)}
                      className={`h-6 rounded-full border-2 ${bgIndex === idx ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:scale-105"} bg-gradient-to-r ${bg.base} transition-all`}
                    />
                  ))}
                </div>

                <h3 className="text-[11px] font-bold text-slate-500 mb-3 tracking-widest uppercase">主题颜色</h3>
                <div className="grid grid-cols-4 gap-3">
                  {colorPresets.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setThemeColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${themeColor === color ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:scale-105"}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <div
                    className={`relative w-8 h-8 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${!colorPresets.includes(themeColor) ? "border-slate-800 scale-110 shadow-md" : "border-transparent hover:border-slate-400"}`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 pointer-events-none" />
                    <div className="absolute inset-1 bg-white rounded-full pointer-events-none flex items-center justify-center">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: themeColor }} />
                    </div>
                    <input
                      type="color"
                      value={colorPresets.includes(themeColor) ? "#ffffff" : themeColor}
                      onChange={(e) => setThemeColor(e.target.value)}
                      className="absolute inset-[-10px] w-12 h-12 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <nav className="flex-1 py-8 px-4 space-y-2 overflow-y-auto no-scrollbar">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCurrentTab(tab.id)}
              style={currentTab === tab.id ? { backgroundColor: themeColor, color: "#fff", boxShadow: `0 10px 15px -3px ${themeColor}40` } : {}}
              className={`w-full flex items-center px-5 py-3.5 rounded-[20px] transition-all duration-300 ${
                currentTab === tab.id ? "font-bold translate-x-1" : "text-slate-500 hover:bg-white/60 hover:text-slate-800 font-semibold"
              }`}
            >
              <svg className={`w-5 h-5 mr-3 ${currentTab === tab.id ? "text-white/90" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={tab.icon} />
              </svg>
              {tab.name}
            </button>
          ))}
        </nav>

        <div className="p-6 space-y-3">
          <button
            type="button"
            onClick={() => setShowChangePasswordModal(true)}
            className="w-full py-3 rounded-2xl text-sm font-bold border border-white/60 bg-white/50 text-slate-700 hover:bg-white/80 transition-colors shadow-sm"
          >
            修改密码
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-3 rounded-2xl text-sm font-bold border border-white/60 bg-white/50 text-slate-700 hover:bg-white/80 transition-colors shadow-sm"
          >
            退出登录
          </button>
          <div className="bg-white/50 backdrop-blur-md rounded-2xl p-5 border border-white/60 shadow-sm">
            <p className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-widest">环境</p>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
              <span className="text-sm font-extrabold text-slate-800">Production</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative z-10 flex min-h-dvh w-full flex-1 flex-col lg:ml-64 lg:h-dvh lg:min-h-0">
        <header className="sticky top-0 z-10 flex min-h-16 shrink-0 flex-col gap-3 border-b border-white/50 bg-white/50 px-4 py-3 backdrop-blur-md sm:px-6 lg:h-20 lg:flex-row lg:items-center lg:justify-between lg:bg-white/40 lg:px-10 lg:py-0">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-white/70 text-slate-700 shadow-sm transition-colors hover:bg-white lg:hidden"
              aria-label="鎵撳紑鑿滃崟"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0 flex flex-col gap-1">
              <h2 className="truncate text-xl font-extrabold text-slate-800 sm:text-2xl">{currentTitle}</h2>
            {hydrated && loadError && <p className="text-xs text-amber-700 font-medium">配置加载失败（已使用本地默认）：{loadError}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:gap-4">
            <button
              type="button"
              onClick={() => void refreshRemote()}
              className="flex items-center rounded-2xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition-all hover:bg-white sm:px-5"
            >
              重新拉取
            </button>
            <button
              type="button"
              onClick={() => setShowJsonModal(true)}
              className="flex items-center rounded-2xl border border-white/60 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-[0_4px_14px_rgba(0,0,0,0.05)] transition-all hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] sm:px-6"
            >
              <svg className="mr-2 h-4 w-4 shrink-0" style={{ color: themeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              导出 JSON 配置
            </button>
          </div>
        </header>

        <div className="relative flex-1 overflow-y-auto p-4 no-scrollbar sm:p-6 lg:p-10">
          <div className="mx-auto w-full max-w-7xl pb-20">
            <Suspense fallback={tabFallback()}>
              {currentTab === "system" && (
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
                  updateGatewaySign={updateGatewaySign}
                  updateSection={updateSection}
                  onSaveSystem={() => void handleSaveSystem()}
                  onSaveEndpoints={() => void handleSaveEndpoints()}
                  onSaveGatewaySign={() => void handleSaveGatewaySign()}
                  onSaveDiscover={() => void handleSaveDiscover()}
                />
              )}
              {currentTab === "update" && (
                <UpdateTab
                  displayHistory={displayHistory}
                  themeColor={themeColor}
                  onPublishNew={openNewUpdate}
                  onEdit={openEditUpdate}
                  onDeletePackage={(item) => void handleDeleteReleasePackage(item)}
                  deletingPackageHistoryId={deletingPackageHistoryId}
                />
              )}
              {currentTab === "content" && (
                <ContentTab
                  config={appConfig}
                  themeColor={themeColor}
                  dirty={contentDirty}
                  saving={contentSaving}
                  updateSection={updateSection}
                  onSave={() => void handleSaveContent()}
                />
              )}
              {currentTab === "announcements" && (
                <AnnouncementsTab
                  announcements={announcements}
                  themeColor={themeColor}
                  onAdd={handleAddAnnouncement}
                  onEdit={handleEditAnnouncement}
                  onDelete={handleDeleteAnnouncement}
                />
              )}
              {currentTab === "dynamicConfig" && (
                <DynamicConfigTab
                  items={dynamicConfigs}
                  themeColor={themeColor}
                  loading={dynamicConfigLoading}
                  onCreate={handleAddDynamicConfig}
                  onEdit={handleEditDynamicConfig}
                  onDelete={(item) => void handleDeleteDynamicConfig(item)}
                />
              )}
              {currentTab === "encryption" && (
                <EncryptionTab
                  paths={encryptionPathsDraft}
                  themeColor={themeColor}
                  saving={encryptionSaving}
                  dirty={encryptionDirty}
                  onChange={setEncryptionPathsDraft}
                  onSave={() => void handleSaveEncryption()}
                  onResetToDefault={() => setEncryptionPathsDraft([...DEFAULT_PLAINTEXT_PATHS])}
                  onReloadFromServer={() => void handleReloadEncryption()}
                />
              )}
              {currentTab === "devices" && (
                <DevicesTab
                  deviceMode={deviceMode}
                  devices={devices}
                  totalDevices={deviceTotal}
                  deviceOffset={deviceOffset}
                  deviceLimit={deviceLimit}
                  deviceFilter={deviceFilter}
                  deviceLoading={deviceLoading}
                  themeColor={themeColor}
                  selectedDevice={selectedDevice}
                  onModeChange={handleDeviceModeChange}
                  onFilterChange={handleFilterChange}
                  onPageChange={handleDevicePageChange}
                  onRefreshDevices={() => void loadDevices()}
                  onSelectDevice={handleSelectDevice}
                  onLockDevice={handleLockDevice}
                  onDeleteDevice={handleDeleteDevice}
                />
              )}
            </Suspense>
          </div>
        </div>
      </main>

      {editingNotice && (
        <NoticeModal
          editing={editingNotice}
          isNew={editingNoticeIndex === -1}
          themeColor={themeColor}
          onClose={() => setEditingNotice(null)}
          onChange={setEditingNotice}
          onSave={handleSaveAnnouncement}
        />
      )}

      {editingUpdateDraft && (
        <UpdateModal
          draft={editingUpdateDraft}
          isNew={editingUpdateIsNew}
          themeColor={themeColor}
          saving={publishSaving}
          uploadingPackage={packageUploading}
          uploadProgress={packageUploadProgress}
          onClose={() => setEditingUpdateDraft(null)}
          onChange={setEditingUpdateDraft}
          onUploadPackage={(file) => void handleUploadReleasePackage(file)}
          onSubmit={() => void handleSubmitPublish()}
        />
      )}

      {editingDynamicConfig && (
        <DynamicConfigModal
          editing={editingDynamicConfig}
          isNew={editingDynamicConfigIsNew}
          themeColor={themeColor}
          saving={dynamicConfigSaving}
          onClose={() => setEditingDynamicConfig(null)}
          onChange={setEditingDynamicConfig}
          onSave={() => void handleSaveDynamicConfig()}
        />
      )}

      {showJsonModal && <JsonExportModal exportData={exportPayload} themeColor={themeColor} onClose={() => setShowJsonModal(false)} />}

      {showChangePasswordModal && (
        <ChangePasswordModal
          themeColor={themeColor}
          onClose={() => setShowChangePasswordModal(false)}
          onSuccess={() => alert("密码已更新，请妥善保管新密码。")}
        />
      )}
    </div>
  );
}
