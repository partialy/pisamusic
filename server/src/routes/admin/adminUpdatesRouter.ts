import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  type DesktopUpdateAssetType,
  type ReleaseInfo,
  type ReleasePlatform,
  activateDesktopUpdateVersion,
  createDesktopUpdateUploadRecord,
  createReleaseUploadRecord,
  publishUpdate,
  readDesktopUpdateAssets,
  readUpdateHistory,
  updatePublishedUpdate,
} from "../../db/configStore";
import {
  deleteManagedReleaseFileForHistory,
  deleteManagedUpdateHistory,
  previewManagedUpdateHistoryDeletion,
} from "../../services/fileManagementService";
import {
  createDesktopUpdateUploadToken,
  createQiniuUploadToken,
  validateDesktopUpdateAsset,
  validateReleaseFile,
} from "../../services/qiniuReleaseFiles";
import { fail, ok } from "../../types/response";

export const adminUpdatesRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePlatform(value: unknown): ReleasePlatform {
  return value === "desktop" ? "desktop" : "android";
}

function normalizePayload(
  body: unknown,
): { platform: ReleasePlatform; release: ReleaseInfo; releaseFileId?: string } | null {
  const b = body as Record<string, unknown>;
  if (!b || typeof b !== "object") return null;

  const platform = normalizePlatform(b.platform);
  const latestVersion = String(b.latestVersion ?? "").trim();
  const updateTime = String(b.updateTime ?? "").trim();
  const downloadUrl = String(b.downloadUrl ?? "").trim();
  const officialUrl = String(b.officialUrl ?? "").trim();
  const updateContent = String(b.updateContent ?? "").trim();
  const forceUpdate = Boolean(b.forceUpdate);
  const platformLabel = String(b.platformLabel ?? (platform === "desktop" ? "PC 端" : "Android")).trim();
  const fileSizeText = String(b.fileSizeText ?? "").trim();
  const available = Boolean(b.available) && Boolean(downloadUrl);
  const releaseFileId = typeof b.releaseFileId === "string" ? b.releaseFileId.trim() : "";

  if (!latestVersion || !updateTime || !officialUrl || !updateContent || !platformLabel) return null;
  if (available && !downloadUrl) return null;
  if (platform === "android" && !downloadUrl) return null;
  return {
    platform,
    releaseFileId: releaseFileId || undefined,
    release: {
      latestVersion,
      updateTime,
      forceUpdate,
      downloadUrl,
      officialUrl,
      updateContent,
      platformLabel,
      fileSizeText,
      available,
    },
  };
}

function normalizeUploadTokenPayload(
  body: unknown,
):
  | { ok: true; value: { platform: ReleasePlatform; fileName: string; fileSize: number; mimeType: string } }
  | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const platform = normalizePlatform(body.platform);
  const fileName = String(body.fileName ?? "").trim();
  const fileSize = Number(body.fileSize);
  const mimeType = String(body.mimeType ?? "").trim();
  try {
    validateReleaseFile(platform, fileName, fileSize);
    return { ok: true, value: { platform, fileName, fileSize, mimeType } };
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "安装包文件不合法" };
  }
}

function normalizeUploadCompletePayload(
  body: unknown,
):
  | {
      ok: true;
      value: {
        platform: ReleasePlatform;
        version: string;
        bucket: string;
        key: string;
        hash: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
      };
    }
  | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const platform = normalizePlatform(body.platform);
  const version = String(body.version ?? "").trim();
  const bucket = String(body.bucket ?? "").trim();
  const key = String(body.key ?? "").trim();
  const hash = String(body.hash ?? "").trim();
  const fileName = String(body.fileName ?? "").trim();
  const mimeType = String(body.mimeType ?? "").trim();
  const fileSize = Number(body.fileSize);
  if (!bucket) return { ok: false, msg: "bucket 不能为空" };
  if (!key.startsWith(`pisamusic/releases/${platform}/`)) {
    return { ok: false, msg: "七牛文件 key 与发布平台不匹配" };
  }
  try {
    validateReleaseFile(platform, fileName, fileSize);
    return { ok: true, value: { platform, version, bucket, key, hash, fileName, mimeType, fileSize } };
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "安装包文件不合法" };
  }
}

function normalizeDesktopUpdateUploadTokenPayload(
  body: unknown,
):
  | {
      ok: true;
      value: {
        version: string;
        platform: "win32";
        arch: "x64";
        fileType: DesktopUpdateAssetType;
        fileName: string;
        fileSize: number;
        mimeType: string;
      };
    }
  | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const version = String(body.version ?? "").trim();
  const platform = body.platform === "win32" ? "win32" : "win32";
  const arch = body.arch === "x64" ? "x64" : "x64";
  const fileName = String(body.fileName ?? "").trim();
  const fileSize = Number(body.fileSize);
  const mimeType = String(body.mimeType ?? "").trim();
  if (!version) return { ok: false, msg: "version 不能为空" };
  try {
    const fileType = validateDesktopUpdateAsset(fileName, fileSize);
    return { ok: true, value: { version, platform, arch, fileType, fileName, fileSize, mimeType } };
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "自动更新文件不合法" };
  }
}

function normalizeDesktopUpdateCompletePayload(
  body: unknown,
):
  | {
      ok: true;
      value: {
        version: string;
        platform: "win32";
        arch: "x64";
        fileType: DesktopUpdateAssetType;
        bucket: string;
        key: string;
        hash: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
      };
    }
  | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const version = String(body.version ?? "").trim();
  const platform = body.platform === "win32" ? "win32" : "win32";
  const arch = body.arch === "x64" ? "x64" : "x64";
  const bucket = String(body.bucket ?? "").trim();
  const key = String(body.key ?? "").trim();
  const hash = String(body.hash ?? "").trim();
  const fileName = String(body.fileName ?? "").trim();
  const mimeType = String(body.mimeType ?? "").trim();
  const fileSize = Number(body.fileSize);
  if (!version) return { ok: false, msg: "version 不能为空" };
  if (!bucket) return { ok: false, msg: "bucket 不能为空" };
  if (!key.startsWith(`pisamusic/desktop-updates/${platform}/${arch}/`)) {
    return { ok: false, msg: "七牛文件 key 与自动更新平台不匹配" };
  }
  try {
    const fileType = validateDesktopUpdateAsset(fileName, fileSize);
    return {
      ok: true,
      value: { version, platform, arch, fileType, bucket, key, hash, fileName, mimeType, fileSize },
    };
  } catch (e) {
    return { ok: false, msg: e instanceof Error ? e.message : "自动更新文件不合法" };
  }
}

function normalizeDesktopUpdateActivatePayload(
  body: unknown,
):
  | { ok: true; value: { version: string; platform: "win32"; arch: "x64"; assetIds?: string[] } }
  | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const version = String(body.version ?? "").trim();
  if (!version) return { ok: false, msg: "version 不能为空" };
  const assetIds = Array.isArray(body.assetIds)
    ? body.assetIds.map((item) => String(item ?? "").trim()).filter(Boolean)
    : undefined;
  return {
    ok: true,
    value: {
      version,
      platform: "win32",
      arch: "x64",
      assetIds: assetIds && assetIds.length > 0 ? assetIds : undefined,
    },
  };
}

// Routes
adminUpdatesRouter.get("/update-history", async (_req, res) => {
  try {
    return res.json(ok(await readUpdateHistory()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取更新历史失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUpdatesRouter.post("/release-files/upload-token", (req, res) => {
  try {
    const payload = normalizeUploadTokenPayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    return res.json(ok(createQiniuUploadToken(payload.value), "上传凭证已生成"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成上传凭证失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUpdatesRouter.post("/release-files/complete", async (req, res) => {
  try {
    const payload = normalizeUploadCompletePayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    const file = await createReleaseUploadRecord({
      id: randomUUID(),
      platform: payload.value.platform,
      version: payload.value.version,
      provider: "qiniu",
      bucket: payload.value.bucket,
      objectKey: payload.value.key,
      hash: payload.value.hash,
      fileName: payload.value.fileName,
      mimeType: payload.value.mimeType,
      fileSize: payload.value.fileSize,
    });
    return res.json(ok(file, "安装包已登记"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "登记安装包失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUpdatesRouter.post("/desktop-updates/upload-token", (req, res) => {
  try {
    const payload = normalizeDesktopUpdateUploadTokenPayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    return res.json(ok(createDesktopUpdateUploadToken(payload.value), "自动更新上传凭证已生成"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成自动更新上传凭证失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUpdatesRouter.post("/desktop-updates/complete", async (req, res) => {
  try {
    const payload = normalizeDesktopUpdateCompletePayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    const asset = await createDesktopUpdateUploadRecord({
      id: randomUUID(),
      version: payload.value.version,
      platform: payload.value.platform,
      arch: payload.value.arch,
      fileType: payload.value.fileType,
      provider: "qiniu",
      bucket: payload.value.bucket,
      objectKey: payload.value.key,
      hash: payload.value.hash,
      fileName: payload.value.fileName,
      mimeType: payload.value.mimeType,
      fileSize: payload.value.fileSize,
    });
    return res.json(ok(asset, "自动更新文件已登记"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "登记自动更新文件失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUpdatesRouter.get("/desktop-updates/assets", async (req, res) => {
  try {
    const version = String(req.query.version ?? "").trim();
    if (!version) return res.status(400).json(fail("version 不能为空", 400));
    const assets = await readDesktopUpdateAssets(version, "win32", "x64");
    return res.json(ok({ assets }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取 PC 自动更新文件失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUpdatesRouter.post("/desktop-updates/activate", async (req, res) => {
  try {
    const payload = normalizeDesktopUpdateActivatePayload(req.body);
    if (!payload.ok) return res.status(400).json(fail(payload.msg, 400));
    const assets = await activateDesktopUpdateVersion(
      payload.value.version,
      payload.value.platform,
      payload.value.arch,
      payload.value.assetIds,
    );
    return res.json(ok({ assets }, "PC 自动更新版本已启用"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "启用 PC 自动更新版本失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUpdatesRouter.post("/publish-update", async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    if (!payload) return res.status(400).json(fail("发布信息不完整", 400));
    const history = await publishUpdate(payload.release, randomUUID(), payload.platform, payload.releaseFileId);
    return res.json(ok({ id: history.id, update: payload.release, platform: payload.platform }, "发布成功"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "发布更新失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminUpdatesRouter.put("/update-history/:id", async (req, res) => {
  try {
    const historyId = String(req.params.id ?? "").trim();
    if (!historyId) return res.status(400).json(fail("发布记录 ID 不能为空", 400));
    const payload = normalizePayload(req.body);
    if (!payload) return res.status(400).json(fail("发布信息不完整", 400));
    const history = await updatePublishedUpdate(
      historyId,
      payload.release,
      payload.platform,
      payload.releaseFileId,
    );
    return res.json(
      ok({ id: history.id, update: payload.release, platform: payload.platform, history }, "发布记录已保存"),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存发布记录失败";
    const status = message === "发布记录不存在" ? 404 : message === "发布记录平台不能修改" ? 400 : 500;
    return res.status(status).json(fail(message, status));
  }
});

adminUpdatesRouter.get("/update-history/:id/delete-preview", async (req, res) => {
  try {
    const historyId = String(req.params.id ?? "").trim();
    if (!historyId) return res.status(400).json(fail("发布记录 ID 不能为空", 400));
    return res.json(ok(await previewManagedUpdateHistoryDeletion(historyId)));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取版本删除预览失败";
    const status = message === "发布记录不存在" ? 404 : message === "当前最新版本不可删除" ? 400 : 500;
    return res.status(status).json(fail(message, status));
  }
});

adminUpdatesRouter.delete("/update-history/:id/release-file", async (req, res) => {
  try {
    const historyId = String(req.params.id ?? "").trim();
    if (!historyId) return res.status(400).json(fail("发布记录 ID 不能为空", 400));
    const deleted = await deleteManagedReleaseFileForHistory(historyId);
    return res.json(ok({ releaseFile: deleted }, "安装包已删除"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除安装包失败";
    const status = message === "该发布记录没有可删除的安装包" ? 404 : 500;
    return res.status(status).json(fail(message, status));
  }
});

adminUpdatesRouter.delete("/update-history/:id", async (req, res) => {
  try {
    const historyId = String(req.params.id ?? "").trim();
    if (!historyId) return res.status(400).json(fail("发布记录 ID 不能为空", 400));
    const result = await deleteManagedUpdateHistory(historyId);
    return res.json(ok(result, "版本记录及相关文件已删除"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除版本记录失败";
    const status = message === "发布记录不存在" ? 404 : message === "当前最新版本不可删除" ? 400 : 500;
    return res.status(status).json(fail(message, status));
  }
});
