import { Router } from "express";
import type { Request, Response } from "express";
import { readAdminDashboard } from "../db/dashboardStore";
import { DASHBOARD_RANGE_DAYS, type DashboardRangeDays } from "../types/dashboard";
import { fail, ok } from "../types/response";

export const adminDashboardRouter = Router();

adminDashboardRouter.get("/", (req: Request, res: Response) => {
  try {
    const rawDays = req.query.days;
    const days = rawDays !== undefined ? Number(rawDays) : 30;

    if (!DASHBOARD_RANGE_DAYS.includes(days as DashboardRangeDays)) {
      res.status(400).json(fail("days 仅支持 7、30、90", 400));
      return;
    }

    const data = readAdminDashboard(days as DashboardRangeDays);
    res.json(ok(data));
  } catch (err) {
    const message = err instanceof Error ? err.message : "获取仪表盘数据失败";
    res.status(500).json(fail(message, 500));
  }
});
