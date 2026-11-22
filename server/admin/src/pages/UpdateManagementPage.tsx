import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "antd";
import type {
  DesktopUpdateAssetInfo,
  DesktopUpdateAssetType,
  ReleasePlatform,
  UpdateFormDraft,
  UpdateHistoryDeletionPreview,
  UpdateHistoryItem,
} from "../types/config";
import { getCurrentPlus8Time } from "../utils/date";
import { draftToPayload, historyItemToDraft } from "../utils/updatePayload";
import {
  formatReleaseFileSize,
  getMissingDesktopSlotLabels,
  matchAndroidReleaseFiles,
  matchDesktopReleaseFiles,
  normalizeReleaseVersionWithV,
  parseLatestYmlVersion,
  stripVersionPrefix,
  suggestNextVersion,
  type DesktopStagedFiles,
} from "../utils/releaseFormHelpers";
import {
  deleteReleasePackage,
  deleteUpdateHistory,
  exportUpdateHistory,
  fetchDesktopUpdateAssets,
  fetchUpdateHistoryDeletePreview,
  fetchUpdateHistoryPage,
} from "../api/client";
import { useAdminConfigWorkspace } from "../state/AdminConfigWorkspaceContext";
import { useReleasePublishQueue } from "../state/ReleasePublishQueueContext";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import UpdateTab, { type UpdateHistoryPlatformFilter } from "../components/tabs/UpdateTab";
import UpdateModal from "../components/modals/UpdateModal";
import UpdateHistoryDeletePreviewModal from "../components/modals/UpdateHistoryDeletePreviewModal";

function mapAssetsByType(
  assets: DesktopUpdateAssetInfo[],
): Partial<Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>> {
  const result: Partial<Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>> = {};
  for (const asset of assets) {
    if (asset.status !== "uploaded") continue;
    if (!result[asset.fileType]) {
      result[asset.fileType] = asset;
    }
  }
  return result;
}

export default function UpdateManagementPage() {
  const { themeColor } = useAdminLayout();
  const { appConfigServer, refreshRemote } = useAdminConfigWorkspace();
  const {
    tasks: publishTasks,
    stats: publishQueueStats,
    completedRevision,
    openQueueModal,
    enqueuePublish,
  } = useReleasePublishQueue();

  const [historyItems, setHistoryItems] = useState<UpdateHistoryItem[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyLimit, setHistoryLimit] = useState(15);
  const [platformFilter, setPlatformFilter] = useState<UpdateHistoryPlatformFilter>("all");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [editingUpdateDraft, setEditingUpdateDraft] = useState<UpdateFormDraft | null>(null);
  const [editingUpdateIsNew, setEditingUpdateIsNew] = useState(true);
  const [editingUpdateHistoryId, setEditingUpdateHistoryId] = useState<string | null>(null);
  const [editingUpdateIsCurrent, setEditingUpdateIsCurrent] = useState(false);

  const [stagedAndroidFile, setStagedAndroidFile] = useState<File | null>(null);
  const [stagedDesktopFiles, setStagedDesktopFiles] = useState<DesktopStagedFiles>({});
  const [existingDesktopAssets, setExistingDesktopAssets] = useState<
    Partial<Record<DesktopUpdateAssetType, DesktopUpdateAssetInfo>>
  >({});
  const [loadingExistingAssets, setLoadingExistingAssets] = useState(false);

  const [deletingPackageHistoryId, setDeletingPackageHistoryId] = useState<string | null>(null);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [updateHistoryDeletePreview, setUpdateHistoryDeletePreview] =
    useState<UpdateHistoryDeletionPreview | null>(null);

  const versionManuallyEditedRef = useRef(false);

  const loadHistoryPage = useCallback(
    async (
      targetOffset = historyOffset,
      targetLimit = historyLimit,
      targetPlatform = platformFilter,
    ) => {
      setHistoryLoading(true);
      try {
        const res = await fetchUpdateHistoryPage({
          platform: targetPlatform,
          offset: targetOffset,
          limit: targetLimit,
        });
        setHistoryItems(res.list);
        setHistoryTotal(res.total);
        setHistoryOffset(res.offset);
        setHistoryLimit(res.limit);
      } catch (e) {
        void message.error(e instanceof Error ? e.message : "加载版本发布历史失败");
      } finally {
        setHistoryLoading(false);
      }
    },
    [historyOffset, historyLimit, platformFilter],
  );

  useEffect(() => {
    void loadHistoryPage(historyOffset, historyLimit, platformFilter);
  }, [historyOffset, historyLimit, platformFilter, completedRevision, loadHistoryPage]);

  const isCurrentReleaseHistory = useCallback(
    (item: UpdateHistoryItem) => {
      if (typeof item.isCurrent === "boolean") return item.isCurrent;
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

  const resetModalTransientState = () => {
    setStagedAndroidFile(null);
    setStagedDesktopFiles({});
    setExistingDesktopAssets({});
    setLoadingExistingAssets(false);
    versionManuallyEditedRef.current = false;
  };

  const closeModal = () => {
    setEditingUpdateDraft(null);
    setEditingUpdateHistoryId(null);
    setEditingUpdateIsCurrent(false);
    resetModalTransientState();
  };

  const openNewUpdate = () => {
    const plus8Time = getCurrentPlus8Time();
    const initialPlatform: ReleasePlatform = "android";
    resetModalTransientState();
    setEditingUpdateIsNew(true);
    setEditingUpdateHistoryId(null);
    setEditingUpdateIsCurrent(false);
    setEditingUpdateDraft({
      platform: initialPlatform,
      version: suggestNextVersion(initialPlatform, appConfigServer, historyItems),
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
    resetModalTransientState();
    const draft = historyItemToDraft(item);
    if (!draft.fileSizeText && item.releaseFile?.fileSize) {
      draft.fileSizeText = formatReleaseFileSize(item.releaseFile.fileSize);
    }
    setEditingUpdateIsNew(false);
    setEditingUpdateHistoryId(item.id);
    setEditingUpdateIsCurrent(isCurrentReleaseHistory(item));
    setEditingUpdateDraft(draft);

    if (item.platform === "desktop" && item.version) {
      setLoadingExistingAssets(true);
      void fetchDesktopUpdateAssets(item.version)
        .then((assets) => {
          setExistingDesktopAssets(mapAssetsByType(assets));
        })
        .catch(() => {
          // 读取历史更新资产失败时不阻断打开编辑弹窗
        })
        .finally(() => {
          setLoadingExistingAssets(false);
        });
    }
  };

  const handleDraftChange = (next: UpdateFormDraft) => {
    if (editingUpdateDraft && next.version !== editingUpdateDraft.version) {
      versionManuallyEditedRef.current = true;
    }
    setEditingUpdateDraft(next);
  };

  const handlePlatformChange = (nextPlatform: ReleasePlatform) => {
    if (!editingUpdateDraft || editingUpdateDraft.platform === nextPlatform) return;
    setStagedAndroidFile(null);
    setStagedDesktopFiles({});
    setExistingDesktopAssets({});
    setEditingUpdateDraft((prev) => {
      if (!prev) return prev;
      const nextVersion = versionManuallyEditedRef.current
        ? prev.version
        : suggestNextVersion(nextPlatform, appConfigServer, historyItems);
      return {
        ...prev,
        platform: nextPlatform,
        version: nextVersion,
        platformLabel: nextPlatform === "desktop" ? "PC 版" : "Android",
        available: nextPlatform === "android" ? true : prev.available,
        downloadUrl: "",
        fileSizeText: "",
        releaseFileId: undefined,
      };
    });
  };

  const handleSelectFiles = async (files: File[]) => {
    if (!editingUpdateDraft || files.length === 0) return;

    if (editingUpdateDraft.platform === "android") {
      const { file, ignoredCount } = matchAndroidReleaseFiles(files);
      if (!file) {
        void message.error("未找到 .apk 或 .aab 安装包文件，请重新选择");
        return;
      }
      setStagedAndroidFile(file);
      setEditingUpdateDraft((prev) =>
        prev
          ? {
              ...prev,
              fileSizeText: formatReleaseFileSize(file.size) || prev.fileSizeText,
              available: true,
            }
          : prev,
      );
      if (ignoredCount > 0) {
        void message.success(`已匹配安装包：${file.name}（已忽略其余 ${ignoredCount} 个文件）`);
      } else {
        void message.success(`已匹配安装包：${file.name}`);
      }
      return;
    }

    const { matched, ignoredCount, invalidYamlNames } = matchDesktopReleaseFiles(files);
    if (invalidYamlNames.length > 0) {
      void message.warning(
        `YAML 更新文件必须命名为 latest.yml（已忽略：${invalidYamlNames.join("、")}）`,
      );
    }

    const matchedKeys = Object.keys(matched) as DesktopUpdateAssetType[];
    if (matchedKeys.length === 0) {
      void message.error("未匹配到 latest.yml、.exe 或 .blockmap 文件");
      return;
    }

    const nextStaged: DesktopStagedFiles = {
      ...stagedDesktopFiles,
      ...matched,
    };
    setStagedDesktopFiles(nextStaged);

    if (matched.installer) {
      const installerSize = formatReleaseFileSize(matched.installer.size);
      setEditingUpdateDraft((prev) =>
        prev
          ? {
              ...prev,
              fileSizeText: installerSize || prev.fileSizeText,
              available: true,
            }
          : prev,
      );
    }

    if (matched["latest-yml"]) {
      try {
        const ymlText = await matched["latest-yml"].text();
        const ymlVersion = parseLatestYmlVersion(ymlText);
        if (ymlVersion) {
          setEditingUpdateDraft((prev) => {
            if (!prev) return prev;
            if (stripVersionPrefix(prev.version) !== stripVersionPrefix(ymlVersion)) {
              void message.warning("检测到版本不一致，请检查");
              versionManuallyEditedRef.current = true;
              return { ...prev, version: normalizeReleaseVersionWithV(ymlVersion) };
            }
            return prev;
          });
        }
      } catch {
        // 读取本地 latest.yml 失败时保留原版本号
      }
    }

    const missingLabels = getMissingDesktopSlotLabels(nextStaged, existingDesktopAssets);
    if (missingLabels.length > 0) {
      void message.warning(
        `缺少必选文件：${missingLabels.join("、")}（已匹配文件已暂存，请补选）`,
      );
    } else if (ignoredCount > 0) {
      void message.success(`已匹配全部 PC 必需文件（已忽略其余 ${ignoredCount} 个无关文件）`);
    } else {
      void message.success("已匹配全部 PC 必需文件（latest.yml、EXE、blockmap）");
    }
  };

  const handleSubmitPublish = () => {
    if (!editingUpdateDraft) return;
    if (!editingUpdateIsNew && !editingUpdateHistoryId) return;

    const payload = draftToPayload(editingUpdateDraft);
    const hasValidVersion = Boolean(payload.latestVersion) && !/^[vV]$/.test(payload.latestVersion);
    if (
      !hasValidVersion ||
      !payload.updateTime ||
      !payload.officialUrl ||
      !payload.updateContent ||
      !payload.platformLabel
    ) {
      void message.error("请填写完整：版本号、发布时间、官网地址、平台显示名和更新日志");
      return;
    }

    if (payload.platform === "android") {
      if (!stagedAndroidFile && !payload.downloadUrl) {
        void message.error("请选择 Android 安装包（.apk/.aab）或填写直接下载地址");
        return;
      }
    } else {
      const hasStagedDesktopFiles = Object.values(stagedDesktopFiles).some(Boolean);
      const requireDesktopTriplet =
        editingUpdateIsNew || payload.available || hasStagedDesktopFiles;
      if (requireDesktopTriplet) {
        const missingLabels = getMissingDesktopSlotLabels(
          stagedDesktopFiles,
          existingDesktopAssets,
        );
        if (missingLabels.length > 0) {
          void message.error(`缺少 PC 必选文件：${missingLabels.join("、")}`);
          return;
        }
      }
    }

    enqueuePublish({
      mode: editingUpdateIsNew ? "create" : "edit",
      historyId: editingUpdateHistoryId ?? undefined,
      isCurrent: editingUpdateIsCurrent,
      draft: {
        ...editingUpdateDraft,
        version: payload.latestVersion,
      },
      androidFile: stagedAndroidFile,
      desktopFiles:
        editingUpdateDraft.platform === "desktop" ? { ...stagedDesktopFiles } : undefined,
      existingDesktopAssets:
        editingUpdateDraft.platform === "desktop" ? { ...existingDesktopAssets } : undefined,
    });

    closeModal();
    void message.info("已提交至后台队列，正在上传并发布，可在右下角查看进度");
  };

  const handleExport = async (format: "json" | "csv") => {
    setExporting(true);
    try {
      await exportUpdateHistory(format);
      void message.success(`已导出全部发行记录 (${format.toUpperCase()})`);
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "导出发行记录失败");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteReleasePackage = async (item: UpdateHistoryItem) => {
    if (!item.releaseFile || item.releaseFile.status !== "uploaded") return;
    if (
      !window.confirm(
        `确定要删除 ${item.version} 关联的七牛安装包吗？删除后会清理发布引用和当前下载状态。`,
      )
    ) {
      return;
    }
    setDeletingPackageHistoryId(item.id);
    try {
      await deleteReleasePackage(item.id);
      await Promise.all([refreshRemote(), loadHistoryPage()]);
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "删除安装包失败");
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
      void message.error(e instanceof Error ? e.message : "读取版本删除预览失败");
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
      const nextOffset =
        historyItems.length === 1 && historyOffset > 0
          ? Math.max(0, historyOffset - historyLimit)
          : historyOffset;
      setHistoryOffset(nextOffset);
      await Promise.all([
        refreshRemote(),
        loadHistoryPage(nextOffset, historyLimit, platformFilter),
      ]);
    } catch (e) {
      void message.error(e instanceof Error ? e.message : "删除版本及相关文件失败");
    } finally {
      setDeletingHistoryId(null);
    }
  };

  return (
    <>
      <UpdateTab
        items={historyItems}
        total={historyTotal}
        page={Math.floor(historyOffset / Math.max(1, historyLimit)) + 1}
        pageSize={historyLimit}
        loading={historyLoading}
        platformFilter={platformFilter}
        exporting={exporting}
        themeColor={themeColor}
        publishTasks={publishTasks}
        publishQueueStats={publishQueueStats}
        onPlatformFilterChange={(platform) => {
          setPlatformFilter(platform);
          setHistoryOffset(0);
        }}
        onPageChange={(nextPage, nextPageSize) => {
          setHistoryOffset((Math.max(1, nextPage) - 1) * nextPageSize);
          setHistoryLimit(nextPageSize);
        }}
        onRefresh={() => void loadHistoryPage()}
        onExport={(format) => void handleExport(format)}
        onOpenQueueModal={openQueueModal}
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
          stagedAndroidFile={stagedAndroidFile}
          stagedDesktopFiles={stagedDesktopFiles}
          existingDesktopAssets={existingDesktopAssets}
          loadingExistingAssets={loadingExistingAssets}
          onClose={closeModal}
          onChange={handleDraftChange}
          onPlatformChange={handlePlatformChange}
          onSelectFiles={(files) => void handleSelectFiles(files)}
          onClearAndroidFile={() => setStagedAndroidFile(null)}
          onClearDesktopSlot={(slot) =>
            setStagedDesktopFiles((prev) => {
              const next = { ...prev };
              delete next[slot];
              return next;
            })
          }
          onSubmit={handleSubmitPublish}
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
