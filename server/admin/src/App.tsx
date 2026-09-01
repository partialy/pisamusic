import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  Button,
  ConfigProvider,
  Drawer,
  Layout,
  Menu,
  type MenuProps,
  Popover,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  BgColorsOutlined,
  BugOutlined,
  CloudUploadOutlined,
  ControlOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DesktopOutlined,
  ExportOutlined,
  FileTextOutlined,
  FolderOutlined,
  GlobalOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  NotificationOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShareAltOutlined,
  TrophyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import "dayjs/locale/zh-cn";
import dayjs from "dayjs";

dayjs.locale("zh-cn");

const { Text } = Typography;
import type {
  AdminFaultReportDetail,
  AdminFeedbackDetail,
  AdminFeedbackFilter,
  AdminFeedbackListItem,
  AdminShareFilter,
  AdminShareListItem,
  AdminUserDetail,
  AdminUserFilter,
  AdminUserLibraryKind,
  AdminUserLibraryPage,
  AdminUserListItem,
  AdminUserUpdatePayload,
  Announcement,
  AppConfigJson,
  AppConfigSectionsPayload,
  DesktopUpdateAssetInfo,
  DesktopUpdateAssetType,
  DesktopDeviceInfo,
  DeviceFilter,
  DeviceInfo,
  DynamicConfigItem,
  FaultReportStatus,
  FileRecordInfo,
  FeedbackStatus,
  GatewaySignConfig,
  UpdateFormDraft,
  UpdateHistoryDeletionPreview,
  UpdateHistoryItem,
} from "./types/config";
import { DEFAULT_PLAINTEXT_PATHS } from "./types/config";
import { bgPresets, colorPresets, tabs, type TabId } from "./constants/theme";
import { getCurrentPlus8Time } from "./utils/date";
import {
  createDynamicConfig,
  deleteAdminUser,
  deleteDynamicConfig as deleteDynamicConfigApi,
  deleteAnnouncement as deleteAnnouncementApi,
  deleteDesktopDevice,
  deleteDevice,
  fetchAnnouncements,
  fetchAdminFaultReportDetail,
  fetchAdminFeedback,
  fetchAdminFeedbackDetail,
  fetchAdminUserDetail,
  fetchAdminUserLibrary,
  fetchAdminUsers,
  fetchAppConfig,
  fetchDynamicConfigs,
  fetchDesktopDeviceDetail,
  fetchDesktopDevices,
  fetchDeviceDetail,
  fetchDevices,
  fetchEncryptionConfig,
  fetchFileRecords,
  fetchUpdateHistoryDeletePreview,
  fetchUpdateHistory,
  activateDesktopUpdate,
  lockDesktopDevice,
  lockDevice,
  publishUpdate,
  registerUnauthorizedHandler,
  saveAppConfigSections,
  saveAnnouncement as saveAnnouncementApi,
  saveEncryptionConfig,
  updatePublishedUpdate,
  updateAdminFaultReportStatus,
  deleteAdminFaultReport,
  updateAdminFeedbackStatus,
  updateAdminUser,
  uploadReleasePackage,
  uploadDesktopUpdateAsset,
  updateDynamicConfig,
  deleteReleasePackage,
  deleteFileRecord,
  deleteUpdateHistory,
  fetchAdminShares,
  invalidateAdminShare,
} from "./api/client";
import { clearStoredToken, getStoredToken } from "./auth/token";
import { defaultAppConfig } from "./data/defaultAppConfig";
import { draftToPayload, historyItemToDraft } from "./utils/updatePayload";
import { loadTheme, saveTheme } from "./utils/themeStorage";
import { downloadFaultReportLogJson, downloadFaultReportLogsZip } from "./utils/faultReportExport";
import LoginPage from "./components/LoginPage";
import ChangePasswordModal from "./components/modals/ChangePasswordModal";
import DynamicConfigModal from "./components/modals/DynamicConfigModal";
import FileRecordDetailModal from "./components/modals/FileRecordDetailModal";
import FeedbackDetailModal from "./components/modals/FeedbackDetailModal";
import FaultReportDetailModal from "./components/modals/FaultReportDetailModal";
import NoticeModal from "./components/modals/NoticeModal";
import UpdateModal from "./components/modals/UpdateModal";
import UpdateHistoryDeletePreviewModal from "./components/modals/UpdateHistoryDeletePreviewModal";
import JsonExportModal from "./components/modals/JsonExportModal";
import UserDetailModal from "./components/modals/UserDetailModal";
import UserEditModal from "./components/modals/UserEditModal";

const DashboardTab = lazy(() => import("./components/tabs/DashboardTab"));
const SystemTab = lazy(() => import("./components/tabs/SystemTab"));
const WebsiteRecordsTab = lazy(() => import("./components/tabs/WebsiteRecordsTab"));
const UpdateTab = lazy(() => import("./components/tabs/UpdateTab"));
const FileManagementTab = lazy(() => import("./components/tabs/FileManagementTab"));
const CloudMusicManagementTab = lazy(() => import("./components/tabs/CloudMusicManagementTab"));
const FeedbackManagementTab = lazy(() => import("./components/tabs/FeedbackManagementTab"));
const FaultReportsManagementTab = lazy(() => import("./components/tabs/FaultReportsManagementTab"));
const ShareManagementTab = lazy(() => import("./components/tabs/ShareManagementTab"));
const UserManagementTab = lazy(() => import("./components/tabs/UserManagementTab"));
const ListeningLevelsTab = lazy(() => import("./components/tabs/ListeningLevelsTab"));
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

  const [currentTab, setCurrentTab] = useState<TabId>("dashboard");
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  const [themeColor, setThemeColor] = useState(initialTheme.themeColor);
  const [bgIndex, setBgIndex] = useState(initialTheme.bgIndex);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [editingNotice, setEditingNotice] = useState<Announcement | null>(null);
  const [editingNoticeIndex, setEditingNoticeIndex] = useState(-1);
  const [editingDynamicConfig, setEditingDynamicConfig] = useState<DynamicConfigItem | null>(null);
  const [editingDynamicConfigIsNew, setEditingDynamicConfigIsNew] = useState(true);
  const [dynamicConfigLoading, setDynamicConfigLoading] = useState(false);
  const [dynamicConfigSaving, setDynamicConfigSaving] = useState(false);

  const [editingUpdateDraft, setEditingUpdateDraft] = useState<UpdateFormDraft | null>(null);
  const [editingUpdateIsNew, setEditingUpdateIsNew] = useState(true);
  const [editingUpdateHistoryId, setEditingUpdateHistoryId] = useState<string | null>(null);
  const [editingUpdateIsCurrent, setEditingUpdateIsCurrent] = useState(false);
  const [publishSaving, setPublishSaving] = useState(false);
  const [packageUploading, setPackageUploading] = useState(false);
  const [packageUploadProgress, setPackageUploadProgress] = useState<number | null>(null);
  const [desktopUpdateUploading, setDesktopUpdateUploading] = useState<DesktopUpdateAssetType | null>(null);
  const [desktopUpdateProgress, setDesktopUpdateProgress] = useState<Partial<Record<DesktopUpdateAssetType, number>>>({});
  const [desktopUpdateAssets, setDesktopUpdateAssets] = useState<Partial<Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>>>({});
  const [deletingPackageHistoryId, setDeletingPackageHistoryId] = useState<string | null>(null);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [updateHistoryDeletePreview, setUpdateHistoryDeletePreview] = useState<UpdateHistoryDeletionPreview | null>(null);

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
  const [files, setFiles] = useState<FileRecordInfo[]>([]);
  const [fileTotal, setFileTotal] = useState(0);
  const [fileOffset, setFileOffset] = useState(0);
  const [fileLimit] = useState(20);
  const [fileLoading, setFileLoading] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [selectedFileRecord, setSelectedFileRecord] = useState<FileRecordInfo | null>(null);
  const [fileFilters, setFileFilters] = useState<{
    status: "uploaded" | "deleted" | "pending" | "all";
    usageType: "release-package" | "desktop-update" | "cloud-music" | "all";
    keyword: string;
  }>({ status: "uploaded", usageType: "all", keyword: "" });
  const [feedbackItems, setFeedbackItems] = useState<AdminFeedbackListItem[]>([]);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [feedbackOffset, setFeedbackOffset] = useState(0);
  const [feedbackLimit] = useState(20);
  const [feedbackFilter, setFeedbackFilter] = useState<AdminFeedbackFilter>({});
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [updatingFeedbackId, setUpdatingFeedbackId] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<AdminFeedbackDetail | null>(null);
  const [selectedFaultReport, setSelectedFaultReport] = useState<AdminFaultReportDetail | null>(null);
  const [faultReportBusy, setFaultReportBusy] = useState(false);
  const [faultReportsRefreshKey, setFaultReportsRefreshKey] = useState(0);
  const [shareItems, setShareItems] = useState<AdminShareListItem[]>([]);
  const [shareTotal, setShareTotal] = useState(0);
  const [shareOffset, setShareOffset] = useState(0);
  const [shareLimit] = useState(20);
  const [shareFilter, setShareFilter] = useState<AdminShareFilter>({ valid: "all" });
  const [shareLoading, setShareLoading] = useState(false);
  const [invalidatingShareId, setInvalidatingShareId] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserListItem[]>([]);
  const [adminUserTotal, setAdminUserTotal] = useState(0);
  const [adminUserOffset, setAdminUserOffset] = useState(0);
  const [adminUserLimit] = useState(20);
  const [adminUserFilter, setAdminUserFilter] = useState<AdminUserFilter>({});
  const [adminUserLoading, setAdminUserLoading] = useState(false);
  const [deletingAdminUserId, setDeletingAdminUserId] = useState<string | null>(null);
  const [selectedAdminUser, setSelectedAdminUser] = useState<AdminUserDetail | null>(null);
  const [editingAdminUser, setEditingAdminUser] = useState<AdminUserListItem | null>(null);
  const [adminUserSaving, setAdminUserSaving] = useState(false);
  const [adminUserLibraryKind, setAdminUserLibraryKind] = useState<AdminUserLibraryKind>("favoriteSongs");
  const [adminUserLibraryPage, setAdminUserLibraryPage] = useState<AdminUserLibraryPage>({ items: [], total: 0, offset: 0, limit: 30 });
  const [adminUserLibraryLoading, setAdminUserLibraryLoading] = useState(false);

  const displayHistory = useMemo(() => [...updateHistory].reverse(), [updateHistory]);

  const isCurrentReleaseHistory = useCallback(
    (item: UpdateHistoryItem) => {
      const current = appConfigServer.releases[item.platform];
      return (
        current.latestVersion === item.version &&
        current.updateTime === item.updateTime &&
        current.forceUpdate === item.forceUpdate &&
        current.downloadUrl === item.downloadUrl &&
        current.officialUrl === item.officialUrl &&
        current.updateContent === item.updateContent
      );
    },
    [appConfigServer.releases],
  );

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
    setEditingUpdateHistoryId(null);
    setEditingUpdateIsCurrent(false);
    setPackageUploadProgress(null);
    setDesktopUpdateProgress({});
    setDesktopUpdateAssets({});
    setDesktopUpdateUploading(null);
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
    setEditingUpdateHistoryId(item.id);
    setEditingUpdateIsCurrent(isCurrentReleaseHistory(item));
    setPackageUploadProgress(null);
    setDesktopUpdateProgress({});
    setDesktopUpdateAssets({});
    setDesktopUpdateUploading(null);
    setEditingUpdateDraft(historyItemToDraft(item));
  };

  const handleSubmitPublish = async () => {
    if (!editingUpdateDraft) return;
    if (!editingUpdateIsNew && !editingUpdateHistoryId) return;
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
      if (payload.platform === "desktop" && payload.available && (editingUpdateIsNew || editingUpdateIsCurrent)) {
        await activateDesktopUpdate(payload.latestVersion);
      }
      if (editingUpdateIsNew) {
        await publishUpdate(payload);
      } else {
        await updatePublishedUpdate(editingUpdateHistoryId!, payload);
      }
      setEditingUpdateDraft(null);
      setEditingUpdateHistoryId(null);
      setEditingUpdateIsCurrent(false);
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
      const releaseFile = await uploadReleasePackage(file, editingUpdateDraft.platform, editingUpdateDraft.version, setPackageUploadProgress);
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
      if (releaseFile.desktopUpdateAsset) {
        setDesktopUpdateAssets((prev) => ({ ...prev, [releaseFile.desktopUpdateAsset!.fileType]: releaseFile.desktopUpdateAsset }));
        setDesktopUpdateProgress((prev) => ({ ...prev, [releaseFile.desktopUpdateAsset!.fileType]: 100 }));
      }
    } catch (e) {
      setPackageUploadProgress(null);
      alert(e instanceof Error ? e.message : "上传安装包失败");
    } finally {
      setPackageUploading(false);
    }
  };

  const inferDesktopAssetType = (fileName: string): DesktopUpdateAssetType => {
    const lower = fileName.toLowerCase();
    if (lower === "latest.yml") return "latest-yml";
    if (lower.endsWith(".blockmap")) return "blockmap";
    return "installer";
  };

  const handleUploadDesktopUpdateAsset = async (file: File) => {
    if (!editingUpdateDraft) return;
    if (editingUpdateDraft.platform !== "desktop") return;
    const fileType = inferDesktopAssetType(file.name);
    setDesktopUpdateUploading(fileType);
    setDesktopUpdateProgress((prev) => ({ ...prev, [fileType]: 0 }));
    try {
      const asset = await uploadDesktopUpdateAsset(file, editingUpdateDraft.version, (progress) => {
        setDesktopUpdateProgress((prev) => ({ ...prev, [fileType]: progress }));
      });
      setDesktopUpdateAssets((prev) => ({ ...prev, [asset.fileType]: asset }));
      setDesktopUpdateProgress((prev) => ({ ...prev, [asset.fileType]: 100 }));
      if (asset.releaseFile) {
        setEditingUpdateDraft((prev) =>
          prev
            ? {
                ...prev,
                downloadUrl: asset.releaseFile!.downloadUrl,
                fileSizeText: formatFileSizeText(asset.releaseFile!.fileSize),
                available: true,
                releaseFileId: asset.releaseFile!.id,
              }
            : prev,
        );
      }
    } catch (e) {
      setDesktopUpdateProgress((prev) => {
        const next = { ...prev };
        delete next[fileType];
        return next;
      });
      alert(e instanceof Error ? e.message : "上传自动更新文件失败");
    } finally {
      setDesktopUpdateUploading(null);
    }
  };

  const handleDeleteReleasePackage = async (item: UpdateHistoryItem) => {
    if (!item.releaseFile || item.releaseFile.status !== "uploaded") return;
    if (!window.confirm(`确定要删除 ${item.version} 关联的七牛安装包吗？删除后会清理发布引用和当前下载状态。`)) return;
    setDeletingPackageHistoryId(item.id);
    try {
      await deleteReleasePackage(item.id);
      await Promise.all([refreshRemote(), loadFiles()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除安装包失败");
    } finally {
      setDeletingPackageHistoryId(null);
    }
  };

  const handleOpenUpdateHistoryDeletePreview = async (item: UpdateHistoryItem) => {
    setDeletingHistoryId(item.id);
    try {
      const preview = await fetchUpdateHistoryDeletePreview(item.id);
      setUpdateHistoryDeletePreview(preview);
    } catch (e) {
      alert(e instanceof Error ? e.message : "读取版本删除预览失败");
    } finally {
      setDeletingHistoryId(null);
    }
  };

  const handleConfirmDeleteUpdateHistory = async () => {
    if (!updateHistoryDeletePreview) return;
    const historyId = updateHistoryDeletePreview.history.id;
    setDeletingHistoryId(historyId);
    try {
      await deleteUpdateHistory(historyId);
      setUpdateHistoryDeletePreview(null);
      await Promise.all([refreshRemote(), loadFiles()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除版本及相关文件失败");
    } finally {
      setDeletingHistoryId(null);
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
      alert("网关签名密钥(secret)和签名算法(as)不能为空");
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

  const loadFiles = useCallback(async () => {
    setFileLoading(true);
    try {
      const result = await fetchFileRecords({
        ...fileFilters,
        offset: fileOffset,
        limit: fileLimit,
      });
      setFiles(result.items);
      setFileTotal(result.total);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载文件记录失败");
    } finally {
      setFileLoading(false);
    }
  }, [fileFilters, fileOffset, fileLimit]);

  useEffect(() => {
    if (currentTab === "files") void loadFiles();
  }, [currentTab, loadFiles]);

  const handleFileFilterChange = (next: typeof fileFilters) => {
    setFileFilters(next);
    setFileOffset(0);
  };

  const handleDeleteFileRecord = async (file: FileRecordInfo) => {
    if (!window.confirm(`确定要删除七牛文件 ${file.fileName} 吗？删除后会清理发布历史、当前发布和自动更新引用。`)) return;
    setDeletingFileId(file.id);
    try {
      await deleteFileRecord(file.id);
      await Promise.all([loadFiles(), refreshRemote()]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除文件失败");
    } finally {
      setDeletingFileId(null);
    }
  };

  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const result = await fetchAdminFeedback({
        ...feedbackFilter,
        offset: feedbackOffset,
        limit: feedbackLimit,
      });
      setFeedbackItems(result.items);
      setFeedbackTotal(result.total);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载反馈列表失败");
    } finally {
      setFeedbackLoading(false);
    }
  }, [feedbackFilter, feedbackOffset, feedbackLimit]);

  useEffect(() => {
    if (currentTab === "feedback") void loadFeedback();
  }, [currentTab, loadFeedback]);

  const handleFeedbackFilterChange = (next: AdminFeedbackFilter) => {
    setFeedbackFilter(next);
    setFeedbackOffset(0);
  };

  const handleViewFeedback = async (feedback: AdminFeedbackListItem) => {
    try {
      setSelectedFeedback(await fetchAdminFeedbackDetail(feedback.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载反馈详情失败");
    }
  };

  const handleFeedbackStatusChange = async (id: string, status: FeedbackStatus) => {
    setUpdatingFeedbackId(id);
    try {
      const updated = await updateAdminFeedbackStatus(id, status);
      if (selectedFeedback?.id === id) setSelectedFeedback(updated);
      await loadFeedback();
    } catch (e) {
      alert(e instanceof Error ? e.message : "更新反馈状态失败");
    } finally {
      setUpdatingFeedbackId(null);
    }
  };

  const handleViewFaultReport = async (id: string) => {
    try {
      setSelectedFaultReport(await fetchAdminFaultReportDetail(id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载故障上报详情失败");
    }
  };

  const handleFaultReportStatusChange = async (status: FaultReportStatus) => {
    if (!selectedFaultReport) return;
    setFaultReportBusy(true);
    try {
      setSelectedFaultReport(await updateAdminFaultReportStatus(selectedFaultReport.id, status));
      setFaultReportsRefreshKey((k) => k + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : "状态更新失败");
    } finally {
      setFaultReportBusy(false);
    }
  };

  const handleFaultReportLogExport = (index: number) => {
    if (!selectedFaultReport) return;
    try {
      downloadFaultReportLogJson(selectedFaultReport, index);
    } catch (e) {
      alert(e instanceof Error ? e.message : "导出故障日志失败");
    }
  };

  const handleFaultReportExportAll = () => {
    if (!selectedFaultReport) return;
    try {
      downloadFaultReportLogsZip(selectedFaultReport);
    } catch (e) {
      alert(e instanceof Error ? e.message : "导出故障日志压缩包失败");
    }
  };

  const handleFaultReportDelete = async () => {
    if (!selectedFaultReport || !window.confirm("确定永久删除这批故障上报及全部日志吗？此操作不可撤销。")) return;
    setFaultReportBusy(true);
    try {
      await deleteAdminFaultReport(selectedFaultReport.id);
      setSelectedFaultReport(null);
      setFaultReportsRefreshKey((k) => k + 1);
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除失败");
    } finally {
      setFaultReportBusy(false);
    }
  };

  const loadShares = useCallback(async () => {
    setShareLoading(true);
    try {
      const result = await fetchAdminShares({
        ...shareFilter,
        offset: shareOffset,
        limit: shareLimit,
      });
      setShareItems(result.items);
      setShareTotal(result.total);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载分享记录失败");
    } finally {
      setShareLoading(false);
    }
  }, [shareFilter, shareOffset, shareLimit]);

  useEffect(() => {
    if (currentTab === "shares") void loadShares();
  }, [currentTab, loadShares]);

  const handleShareFilterChange = (next: AdminShareFilter) => {
    setShareFilter(next);
    setShareOffset(0);
  };

  const handleInvalidateShare = async (share: AdminShareListItem) => {
    if (!share.valid) return;
    if (!window.confirm(`确定要将分享“${share.title || share.uuid}”标记为失效吗？失效后公开链接将不可继续读取。`)) return;
    setInvalidatingShareId(share.uuid);
    try {
      await invalidateAdminShare(share.uuid);
      await loadShares();
    } catch (e) {
      alert(e instanceof Error ? e.message : "标记分享失效失败");
    } finally {
      setInvalidatingShareId(null);
    }
  };

  const loadAdminUsers = useCallback(async () => {
    setAdminUserLoading(true);
    try {
      const result = await fetchAdminUsers({
        ...adminUserFilter,
        offset: adminUserOffset,
        limit: adminUserLimit,
      });
      setAdminUsers(result.users);
      setAdminUserTotal(result.total);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载用户列表失败");
    } finally {
      setAdminUserLoading(false);
    }
  }, [adminUserFilter, adminUserOffset, adminUserLimit]);

  useEffect(() => {
    if (currentTab === "users") void loadAdminUsers();
  }, [currentTab, loadAdminUsers]);

  const handleAdminUserFilterChange = (next: AdminUserFilter) => {
    setAdminUserFilter(next);
    setAdminUserOffset(0);
  };

  const handleViewAdminUser = async (user: AdminUserListItem) => {
    try {
      const detail = await fetchAdminUserDetail(user.id);
      setSelectedAdminUser(detail);
      setAdminUserLibraryKind("favoriteSongs");
      void loadAdminUserLibrary(detail.id, "favoriteSongs", 0);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载用户详情失败");
    }
  };

  const loadAdminUserLibrary = useCallback(async (userId: string, kind: AdminUserLibraryKind, offset: number) => {
    setAdminUserLibraryLoading(true);
    try {
      const page = await fetchAdminUserLibrary(userId, kind, offset, 30);
      setAdminUserLibraryPage(page);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载用户同步数据失败");
    } finally {
      setAdminUserLibraryLoading(false);
    }
  }, []);

  const handleAdminUserLibraryKindChange = (kind: AdminUserLibraryKind) => {
    if (!selectedAdminUser) return;
    setAdminUserLibraryKind(kind);
    void loadAdminUserLibrary(selectedAdminUser.id, kind, 0);
  };

  const handleAdminUserLibraryPageChange = (offset: number) => {
    if (!selectedAdminUser) return;
    void loadAdminUserLibrary(selectedAdminUser.id, adminUserLibraryKind, offset);
  };

  const handleSaveAdminUser = async (payload: AdminUserUpdatePayload) => {
    if (!editingAdminUser) return;
    setAdminUserSaving(true);
    try {
      const updated = await updateAdminUser(editingAdminUser.id, payload);
      setAdminUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
      if (selectedAdminUser?.id === updated.id) {
        setSelectedAdminUser(await fetchAdminUserDetail(updated.id));
      }
      setEditingAdminUser(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存用户资料失败");
    } finally {
      setAdminUserSaving(false);
    }
  };

  const handleDeleteAdminUser = async (user: AdminUserListItem) => {
    if (!window.confirm(`确定要删除用户 ${user.username} 吗？该账号的收藏和歌单同步数据也会被级联删除。`)) return;
    setDeletingAdminUserId(user.id);
    try {
      await deleteAdminUser(user.id);
      if (selectedAdminUser?.id === user.id) setSelectedAdminUser(null);
      if (editingAdminUser?.id === user.id) setEditingAdminUser(null);
      await loadAdminUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除用户失败");
    } finally {
      setDeletingAdminUserId(null);
    }
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

  const menuItems: MenuProps["items"] = [
    { key: "dashboard", icon: <DashboardOutlined />, label: "仪表盘" },
    { key: "system", icon: <SettingOutlined />, label: "系统配置" },
    { key: "websiteRecords", icon: <GlobalOutlined />, label: "官网记录" },
    { key: "users", icon: <UserOutlined />, label: "用户管理" },
    { key: "listeningLevels", icon: <TrophyOutlined />, label: "听歌等级" },
    { key: "devices", icon: <DesktopOutlined />, label: "设备管理" },
    { key: "update", icon: <CloudUploadOutlined />, label: "版本发布" },
    { key: "announcements", icon: <NotificationOutlined />, label: "公告管理" },
    { key: "files", icon: <FolderOutlined />, label: "文件管理" },
    { key: "cloudMusic", icon: <CustomerServiceOutlined />, label: "网盘音乐" },
    { key: "feedback", icon: <MessageOutlined />, label: "反馈管理" },
    { key: "faultReports", icon: <BugOutlined />, label: "故障管理" },
    { key: "shares", icon: <ShareAltOutlined />, label: "分享管理" },
    { key: "content", icon: <FileTextOutlined />, label: "内容与协议" },
    { key: "dynamicConfig", icon: <ControlOutlined />, label: "动态配置" },
    { key: "encryption", icon: <SafetyCertificateOutlined />, label: "加密白名单" },
  ];

  const currentTitle = tabs.find((t) => t.id === currentTab)?.name ?? "";
  const handleSelectTab = (tabId: TabId) => {
    setCurrentTab(tabId);
    setMobileNavOpen(false);
  };

  const themePanel = (
    <div className="w-64 p-2 space-y-4">
      <div>
        <Text strong className="text-xs text-slate-500 uppercase tracking-wider block mb-2">
          背景色调
        </Text>
        <div className="grid grid-cols-4 gap-2">
          {bgPresets.map((bg, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setBgIndex(idx);
                saveTheme({ themeColor, bgIndex: idx });
              }}
              className={`h-6 rounded-lg border-2 transition-all ${
                bgIndex === idx ? "border-slate-800 scale-110 shadow-sm" : "border-transparent hover:scale-105"
              } bg-gradient-to-r ${bg.base}`}
            />
          ))}
        </div>
      </div>

      <div>
        <Text strong className="text-xs text-slate-500 uppercase tracking-wider block mb-2">
          主色调 (Theme Color)
        </Text>
        <div className="grid grid-cols-4 gap-2">
          {colorPresets.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => {
                setThemeColor(color);
                saveTheme({ themeColor: color, bgIndex });
              }}
              className={`h-7 rounded-lg border-2 transition-all ${
                themeColor === color ? "border-slate-800 scale-110 shadow-sm" : "border-transparent hover:scale-105"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <div
            className={`relative h-7 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
              !colorPresets.includes(themeColor) ? "border-slate-800 scale-110 shadow-sm" : "border-slate-200 hover:border-slate-400"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 pointer-events-none" />
            <div className="absolute inset-0.5 bg-white rounded-md pointer-events-none flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: themeColor }} />
            </div>
            <input
              type="color"
              value={colorPresets.includes(themeColor) ? "#ffffff" : themeColor}
              onChange={(e) => {
                setThemeColor(e.target.value);
                saveTheme({ themeColor: e.target.value, bgIndex });
              }}
              className="absolute inset-[-10px] w-12 h-12 opacity-0 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      <div className="flex flex-col min-h-0 flex-1">
        {/* Top Branding */}
        <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-slate-200/80 bg-white/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar
              shape="square"
              size={32}
              src="/pisamusic_icon_1024.png"
              className="rounded-lg shadow-2xs border border-slate-200/80 shrink-0 bg-white p-0.5"
            />
            <span className="font-extrabold text-base tracking-tight text-slate-800 truncate">
              PisaAdmin
            </span>
          </div>

          <Popover
            content={themePanel}
            trigger="click"
            placement="bottomRight"
          >
            <Button
              type="text"
              shape="circle"
              size="small"
              icon={<BgColorsOutlined />}
              title="切换主题与配色"
            />
          </Popover>
        </div>

        {/* Ant Design Menu */}
        <div className="flex-1 overflow-y-auto py-2">
          <Menu
            mode="inline"
            selectedKeys={[currentTab]}
            onClick={({ key }) => handleSelectTab(key as TabId)}
            items={menuItems}
            className="!border-r-0 !bg-transparent font-medium"
          />
        </div>
      </div>

      {/* Sider Footer */}
      <div className="p-3 shrink-0 border-t border-slate-200/80 bg-white/40 space-y-2">
        <div className="flex items-center justify-between px-1">
          <Badge status="processing" color="green" text={<span className="text-[11px] text-slate-500 font-medium">运行状态</span>} />
          <Tag color="success" className="!mr-0 font-bold font-mono text-[10px]">
            Production
          </Tag>
        </div>
        <div className="flex gap-2 pt-0.5">
          <Button
            size="small"
            icon={<KeyOutlined />}
            className="flex-1 text-xs"
            onClick={() => {
              setShowChangePasswordModal(true);
              setMobileNavOpen(false);
            }}
          >
            修改密码
          </Button>
          <Button
            size="small"
            danger
            icon={<LogoutOutlined />}
            className="flex-1 text-xs"
            onClick={onLogout}
          >
            退出
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: themeColor,
          borderRadius: 8,
        },
      }}
    >
      <div className="relative min-h-dvh w-full font-sans text-slate-800">
        {/* Background Gradients */}
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

        <Layout className="min-h-dvh bg-transparent">
          {/* Mobile Drawer Navigation */}
          <Drawer
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            placement="left"
            width={240}
            styles={{ body: { padding: 0 } }}
            className="lg:hidden"
          >
            {sidebarContent}
          </Drawer>

          {/* Desktop Sider */}
          <Layout.Sider
            width={240}
            theme="light"
            className="!hidden lg:!flex !fixed !inset-y-0 !left-0 !z-20 !bg-white/70 !backdrop-blur-2xl !border-r !border-slate-200/80 !shadow-sm flex-col"
          >
            {sidebarContent}
          </Layout.Sider>

          {/* Main Layout Area */}
          <Layout className="min-w-0 flex-1 lg:ml-[240px] bg-transparent flex flex-col min-h-dvh">
            <Layout.Header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/70 px-4 backdrop-blur-xl sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  className="lg:hidden shrink-0"
                  onClick={() => setMobileNavOpen(true)}
                />
                <div className="min-w-0 flex items-center gap-3">
                  <span className="truncate text-lg font-bold text-slate-800">
                    {currentTitle}
                  </span>
                  {hydrated && loadError && currentTab !== "dashboard" && currentTab !== "websiteRecords" && (
                    <Tag color="warning" className="!mr-0 text-xs">
                      配置加载失败 (已使用本地默认)
                    </Tag>
                  )}
                </div>
              </div>

              {currentTab !== "dashboard" && currentTab !== "websiteRecords" && (
                <Space>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => void refreshRemote()}
                  >
                    重新拉取
                  </Button>
                  <Button
                    type="primary"
                    icon={<ExportOutlined />}
                    onClick={() => setShowJsonModal(true)}
                  >
                    导出 JSON 配置
                  </Button>
                </Space>
              )}
            </Layout.Header>

            <Layout.Content className="relative flex-1 min-w-0 p-4">
              <div className="w-full pb-10">
                <Suspense fallback={tabFallback()}>
                  {currentTab === "dashboard" && <DashboardTab themeColor={themeColor} />}
                  {currentTab === "websiteRecords" && <WebsiteRecordsTab themeColor={themeColor} />}
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
                  replaceEndpoints={replaceEndpoints}
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
                  onDeleteHistory={(item) => void handleOpenUpdateHistoryDeletePreview(item)}
                  deletingHistoryId={deletingHistoryId}
                />
              )}
              {currentTab === "files" && (
                <FileManagementTab
                  files={files}
                  total={fileTotal}
                  offset={fileOffset}
                  limit={fileLimit}
                  filters={fileFilters}
                  loading={fileLoading}
                  deletingId={deletingFileId}
                  themeColor={themeColor}
                  onFilterChange={handleFileFilterChange}
                  onPageChange={setFileOffset}
                  onRefresh={() => void loadFiles()}
                  onView={setSelectedFileRecord}
                  onDelete={(file) => void handleDeleteFileRecord(file)}
                />
              )}
              {currentTab === "cloudMusic" && <CloudMusicManagementTab themeColor={themeColor} />}
              {currentTab === "feedback" && (
                <FeedbackManagementTab
                  items={feedbackItems}
                  total={feedbackTotal}
                  offset={feedbackOffset}
                  limit={feedbackLimit}
                  filter={feedbackFilter}
                  loading={feedbackLoading}
                  updatingId={updatingFeedbackId}
                  themeColor={themeColor}
                  onFilterChange={handleFeedbackFilterChange}
                  onPageChange={setFeedbackOffset}
                  onRefresh={() => void loadFeedback()}
                  onView={(feedback) => void handleViewFeedback(feedback)}
                  onStatusChange={(feedback, status) => void handleFeedbackStatusChange(feedback.id, status)}
                />
              )}
              {currentTab === "faultReports" && <FaultReportsManagementTab themeColor={themeColor} onView={(id) => void handleViewFaultReport(id)} refreshKey={faultReportsRefreshKey} />}
              {currentTab === "shares" && (
                <ShareManagementTab
                  items={shareItems}
                  total={shareTotal}
                  offset={shareOffset}
                  limit={shareLimit}
                  filter={shareFilter}
                  loading={shareLoading}
                  invalidatingId={invalidatingShareId}
                  themeColor={themeColor}
                  onFilterChange={handleShareFilterChange}
                  onPageChange={setShareOffset}
                  onRefresh={() => void loadShares()}
                  onInvalidate={(share) => void handleInvalidateShare(share)}
                />
              )}
              {currentTab === "users" && (
                <UserManagementTab
                  users={adminUsers}
                  total={adminUserTotal}
                  offset={adminUserOffset}
                  limit={adminUserLimit}
                  filter={adminUserFilter}
                  loading={adminUserLoading}
                  deletingId={deletingAdminUserId}
                  themeColor={themeColor}
                  onFilterChange={handleAdminUserFilterChange}
                  onPageChange={setAdminUserOffset}
                  onRefresh={() => void loadAdminUsers()}
                  onView={(user) => void handleViewAdminUser(user)}
                  onEdit={setEditingAdminUser}
                  onDelete={(user) => void handleDeleteAdminUser(user)}
                />
              )}
              {currentTab === "listeningLevels" && <ListeningLevelsTab themeColor={themeColor} />}
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
        </Layout.Content>
      </Layout>
    </Layout>

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
          desktopUpdateUploading={desktopUpdateUploading}
          desktopUpdateProgress={desktopUpdateProgress}
          desktopUpdateAssets={desktopUpdateAssets}
          onClose={() => {
            setEditingUpdateDraft(null);
            setEditingUpdateHistoryId(null);
            setEditingUpdateIsCurrent(false);
          }}
          onChange={setEditingUpdateDraft}
          onUploadPackage={(file) => void handleUploadReleasePackage(file)}
          onUploadDesktopUpdateAsset={(file) => void handleUploadDesktopUpdateAsset(file)}
          onSubmit={() => void handleSubmitPublish()}
        />
      )}

      {updateHistoryDeletePreview && (
        <UpdateHistoryDeletePreviewModal
          preview={updateHistoryDeletePreview}
          themeColor={themeColor}
          deleting={deletingHistoryId === updateHistoryDeletePreview.history.id}
          onClose={() => setUpdateHistoryDeletePreview(null)}
          onConfirm={() => void handleConfirmDeleteUpdateHistory()}
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

      {selectedFileRecord && (
        <FileRecordDetailModal
          file={selectedFileRecord}
          themeColor={themeColor}
          onClose={() => setSelectedFileRecord(null)}
        />
      )}

      {selectedFeedback && (
        <FeedbackDetailModal
          feedback={selectedFeedback}
          updating={updatingFeedbackId === selectedFeedback.id}
          themeColor={themeColor}
          onStatusChange={(status) => void handleFeedbackStatusChange(selectedFeedback.id, status)}
          onClose={() => setSelectedFeedback(null)}
        />
      )}

      {selectedAdminUser && (
        <UserDetailModal
          user={selectedAdminUser}
          activeKind={adminUserLibraryKind}
          libraryPage={adminUserLibraryPage}
          libraryLoading={adminUserLibraryLoading}
          themeColor={themeColor}
          onKindChange={handleAdminUserLibraryKindChange}
          onPageChange={handleAdminUserLibraryPageChange}
          onClose={() => setSelectedAdminUser(null)}
        />
      )}

      {editingAdminUser && (
        <UserEditModal
          user={editingAdminUser}
          themeColor={themeColor}
          saving={adminUserSaving}
          onClose={() => setEditingAdminUser(null)}
          onSave={(payload) => void handleSaveAdminUser(payload)}
        />
      )}

      {selectedFaultReport && (
        <FaultReportDetailModal
          report={selectedFaultReport}
          busy={faultReportBusy}
          themeColor={themeColor}
          onStatusChange={(status) => void handleFaultReportStatusChange(status)}
          onExportLog={handleFaultReportLogExport}
          onExportAll={handleFaultReportExportAll}
          onDelete={() => void handleFaultReportDelete()}
          onClose={() => setSelectedFaultReport(null)}
        />
      )}

      {showChangePasswordModal && (
        <ChangePasswordModal
          themeColor={themeColor}
          onClose={() => setShowChangePasswordModal(false)}
          onSuccess={() => alert("密码已更新，请妥善保管新密码。")}
        />
      )}
      </div>
    </ConfigProvider>
  );
}
