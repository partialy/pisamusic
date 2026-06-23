import { Router } from "express";
import {
  deleteAdminFaultReport,
  FAULT_REPORT_SCENES,
  FAULT_REPORT_STATUSES,
  listAdminFaultReports,
  readAdminFaultReport,
  updateAdminFaultReportStatus,
  type FaultReportScene,
  type FaultReportStatus,
} from "../db/faultReportStore";
import { fail, ok } from "../types/response";

export const adminFaultReportsRouter = Router();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validId(value: unknown): string | null {
  const id = typeof value === "string" ? value.trim() : "";
  return UUID_RE.test(id) ? id : null;
}

adminFaultReportsRouter.get("/", (req, res) => {
  try {
    const statusValue = typeof req.query.status === "string" ? req.query.status.trim() : "";
    const sceneValue = typeof req.query.scene === "string" ? req.query.scene.trim() : "";
    const status = statusValue && FAULT_REPORT_STATUSES.includes(statusValue as FaultReportStatus) ? statusValue as FaultReportStatus : undefined;
    const scene = sceneValue && FAULT_REPORT_SCENES.includes(sceneValue as FaultReportScene) ? sceneValue as FaultReportScene : undefined;
    if (statusValue && !status) return res.status(400).json(fail("无效的处理状态", 400));
    if (sceneValue && !scene) return res.status(400).json(fail("无效的故障场景", 400));
    return res.json(ok(listAdminFaultReports({ status, scene, keyword: typeof req.query.keyword === "string" ? req.query.keyword : undefined, offset: req.query.offset, limit: req.query.limit })));
  } catch (error) {
    return res.status(500).json(fail(error instanceof Error ? error.message : "读取故障上报失败", 500));
  }
});

adminFaultReportsRouter.get("/:id", (req, res) => {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json(fail("无效的故障上报 ID", 400));
  const report = readAdminFaultReport(id);
  return report ? res.json(ok(report)) : res.status(404).json(fail("故障上报不存在", 404));
});

adminFaultReportsRouter.patch("/:id/status", (req, res) => {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json(fail("无效的故障上报 ID", 400));
  const status = req.body?.status as FaultReportStatus;
  if (!FAULT_REPORT_STATUSES.includes(status)) return res.status(400).json(fail("状态必须为 pending 或 processed", 400));
  const report = updateAdminFaultReportStatus(id, status);
  return report ? res.json(ok(report, "故障上报状态已更新")) : res.status(404).json(fail("故障上报不存在", 404));
});

adminFaultReportsRouter.delete("/:id", (req, res) => {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json(fail("无效的故障上报 ID", 400));
  return deleteAdminFaultReport(id) ? res.json(ok(null, "故障上报已删除")) : res.status(404).json(fail("故障上报不存在", 404));
});
