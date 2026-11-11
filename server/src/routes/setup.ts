import { Router } from "express";
import { completeSetup, setupStatus, SetupError } from "../services/setupService";
import { fail, ok } from "../types/response";

export const setupRouter = Router();
setupRouter.get("/status", async (_req, res, next) => {
  try { res.json(ok(await setupStatus())); } catch (error) { next(error); }
});
setupRouter.post("/complete", async (req, res, next) => {
  try { res.json(ok(await completeSetup(req.body ?? {}))); }
  catch (error) {
    if (error instanceof SetupError) res.status(error.status).json(fail(error.message, error.status));
    else next(error);
  }
});
