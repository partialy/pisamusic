import { Router } from "express";
import { listFileRecords } from "../../db/configStore";
import { deleteManagedFileRecord } from "../../services/fileManagementService";
import { fail, ok } from "../../types/response";

export const adminFilesRouter = Router();

adminFilesRouter.get("/", async (req, res) => {
  try {
    const status = String(req.query.status ?? "uploaded");
    const usageType = String(req.query.usageType ?? "all");
    const platform = String(req.query.platform ?? "");
    const version = String(req.query.version ?? "");
    const keyword = String(req.query.keyword ?? "");
    const offset = Number(req.query.offset ?? 0);
    const limit = Number(req.query.limit ?? 20);
    return res.json(
      ok(
        await listFileRecords({
          status: status === "deleted" || status === "all" ? status : "uploaded",
          usageType:
            usageType === "release-package" || usageType === "desktop-update" || usageType === "app-share-icon"
              ? usageType
              : "all",
          platform,
          version,
          keyword,
          offset,
          limit,
        }),
      ),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取文件记录失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminFilesRouter.delete("/:id", async (req, res) => {
  try {
    const id = String(req.params.id ?? "").trim();
    if (!id) return res.status(400).json(fail("文件记录 ID 不能为空", 400));
    const deleted = await deleteManagedFileRecord(id);
    return res.json(ok({ file: deleted }, "文件已删除"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除文件失败";
    const status = message === "文件记录不存在" ? 404 : 500;
    return res.status(status).json(fail(message, status));
  }
});
