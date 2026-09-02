import { useState } from "react";
import type { AdminFaultReportDetail, FaultReportStatus } from "../types/config";
import {
  deleteAdminFaultReport,
  fetchAdminFaultReportDetail,
  updateAdminFaultReportStatus,
} from "../api/client";
import { downloadFaultReportLogJson, downloadFaultReportLogsZip } from "../utils/faultReportExport";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import FaultReportsManagementTab from "../components/tabs/FaultReportsManagementTab";
import FaultReportDetailModal from "../components/modals/FaultReportDetailModal";

export default function FaultReportsPage() {
  const { themeColor } = useAdminLayout();

  const [selectedFaultReport, setSelectedFaultReport] = useState<AdminFaultReportDetail | null>(null);
  const [faultReportBusy, setFaultReportBusy] = useState(false);
  const [faultReportsRefreshKey, setFaultReportsRefreshKey] = useState(0);

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

  return (
    <>
      <FaultReportsManagementTab
        themeColor={themeColor}
        onView={(id) => void handleViewFaultReport(id)}
        refreshKey={faultReportsRefreshKey}
      />

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
    </>
  );
}
