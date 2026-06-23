import { Router } from "express";
import { createFaultReport, FaultReportValidationError, normalizeFaultReportCreateInput } from "../db/faultReportStore";
import { tokenFromRequest, verifyUserToken } from "../middleware/requireUserJwt";
import { fail, ok } from "../types/response";

export const faultReportsRouter = Router();

faultReportsRouter.post("/", (req, res) => {
  try {
    const input = normalizeFaultReportCreateInput(req.body);
    const user = verifyUserToken(tokenFromRequest(req));
    return res.json(ok(createFaultReport(input, user?.id ?? null), "故障信息上报成功"));
  } catch (error) {
    if (error instanceof FaultReportValidationError) {
      return res.status(400).json(fail(error.message, 400));
    }
    const message = error instanceof Error ? error.message : "故障信息上报失败";
    return res.status(500).json(fail(message, 500));
  }
});
