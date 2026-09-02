import { useCallback, useEffect, useState } from "react";
import type { FileRecordInfo } from "../types/config";
import { deleteFileRecord, fetchFileRecords } from "../api/client";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import FileManagementTab from "../components/tabs/FileManagementTab";
import FileRecordDetailModal from "../components/modals/FileRecordDetailModal";

export default function FileManagementPage() {
  const { themeColor } = useAdminLayout();

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
    void loadFiles();
  }, [loadFiles]);

  const handleFileFilterChange = (next: typeof fileFilters) => {
    setFileFilters(next);
    setFileOffset(0);
  };

  const handleDeleteFileRecord = async (file: FileRecordInfo) => {
    if (!window.confirm(`确定要删除七牛文件 ${file.fileName} 吗？删除后会清理发布历史、当前发布和自动更新引用。`)) return;
    setDeletingFileId(file.id);
    try {
      await deleteFileRecord(file.id);
      await loadFiles();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除文件失败");
    } finally {
      setDeletingFileId(null);
    }
  };

  return (
    <>
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

      {selectedFileRecord && (
        <FileRecordDetailModal
          file={selectedFileRecord}
          themeColor={themeColor}
          onClose={() => setSelectedFileRecord(null)}
        />
      )}
    </>
  );
}
