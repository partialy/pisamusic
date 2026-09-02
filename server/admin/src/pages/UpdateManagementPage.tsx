import { useCallback, useMemo, useState } from "react";
import type {
  DesktopUpdateAssetInfo,
  DesktopUpdateAssetType,
  UpdateFormDraft,
  UpdateHistoryDeletionPreview,
  UpdateHistoryItem,
} from "../types/config";
import { getCurrentPlus8Time } from "../utils/date";
import { draftToPayload, historyItemToDraft } from "../utils/updatePayload";
import {
  activateDesktopUpdate,
  deleteReleasePackage,
  deleteUpdateHistory,
  fetchUpdateHistoryDeletePreview,
  publishUpdate,
  updatePublishedUpdate,
  uploadDesktopUpdateAsset,
  uploadReleasePackage,
} from "../api/client";
import { useAdminConfigWorkspace } from "../state/AdminConfigWorkspaceContext";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import UpdateTab from "../components/tabs/UpdateTab";
import UpdateModal from "../components/modals/UpdateModal";
import UpdateHistoryDeletePreviewModal from "../components/modals/UpdateHistoryDeletePreviewModal";

export default function UpdateManagementPage() {
  const { themeColor } = useAdminLayout();
  const { updateHistory, appConfigServer, refreshRemote } = useAdminConfigWorkspace();

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
      const releaseFile = await uploadReleasePackage(
        file,
        editingUpdateDraft.platform,
        editingUpdateDraft.version,
        setPackageUploadProgress,
      );
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
        setDesktopUpdateAssets((prev) => ({
          ...prev,
          [releaseFile.desktopUpdateAsset!.fileType]: releaseFile.desktopUpdateAsset,
        }));
        setDesktopUpdateProgress((prev) => ({
          ...prev,
          [releaseFile.desktopUpdateAsset!.fileType]: 100,
        }));
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
      await refreshRemote();
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
      await refreshRemote();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除版本及相关文件失败");
    } finally {
      setDeletingHistoryId(null);
    }
  };

  return (
    <>
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
    </>
  );
}
