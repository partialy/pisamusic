import { Router } from "express";
import { configManager } from "../config/configManager";
import type { ConfigChange } from "../config/configTypes";
import { fail, ok } from "../types/response";

export const adminRuntimeConfigRouter = Router();

adminRuntimeConfigRouter.get("/", (_req, res) => {
  try {
    const items = configManager.getAllDTOs();
    const snapshot = configManager.snapshot();
    res.json(
      ok({
        items,
        snapshot,
      }),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "获取运行时配置失败";
    res.status(500).json(fail(message, 500));
  }
});

adminRuntimeConfigRouter.patch("/", (req, res) => {
  try {
    const rawChanges = req.body?.changes;
    if (!Array.isArray(rawChanges) || rawChanges.length === 0) {
      res.status(400).json(fail("changes 列表不能为空", 400));
      return;
    }

    const changes: ConfigChange[] = rawChanges.map((item) => ({
      key: String(item.key ?? "").trim(),
      value: item.value,
    }));

    const snapshot = configManager.setMany(changes);
    const items = configManager.getAllDTOs();

    res.json(
      ok({
        items,
        snapshot,
      }),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "修改运行时配置失败";
    res.status(400).json(fail(message, 400));
  }
});
