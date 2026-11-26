import { Router } from "express";
import { getUserAuth, requireUserJwt, type UserAuthedRequest } from "../middleware/requireUserJwt";
import { redeemCodeForUser, RedemptionValidationError } from "../services/redemptionService";
import { fail, ok } from "../types/response";

export const redemptionRouter = Router();

redemptionRouter.post("/redeem", requireUserJwt, async (req: UserAuthedRequest, res) => {
  try {
    const { userId } = getUserAuth(req);
    const result = await redeemCodeForUser(userId, req.body);
    return res.json(ok(result, "兑换成功"));
  } catch (error) {
    if (error instanceof RedemptionValidationError) {
      return res.status(error.statusCode).json(fail(error.message, error.statusCode));
    }
    const message = error instanceof Error ? error.message : "兑换失败";
    return res.status(500).json(fail(message, 500));
  }
});
