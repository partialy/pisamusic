import { Router } from "express";
import type { Request } from "express";
import {
  type AppConfig,
  type ReleaseConfig,
  type ReleaseInfo,
  type UpdateHistoryItem,
  readAnnouncements,
  readAppConfig,
  readActiveDesktopUpdateAsset,
  readReleaseFileById,
  readUpdateHistory,
  shouldBlock,
} from "../db/configStore";
import { readDynamicConfigById } from "../db/dynamicConfigStore";
import { createPrivateQiniuDownloadUrl } from "../services/qiniuReleaseFiles";
import { fail, ok } from "../types/response";

export const configRouter = Router();

function blockedResponse() {
  const cfg = readAppConfig();
  const state = shouldBlock(cfg);
  return { cfg, state };
}

function getPublicBaseUrl(req: Request): string {
  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol;
  const host = req.get("host") ?? "";
  return host ? `${proto}://${host}` : "";
}

function toAbsoluteUrl(url: string, req: Request): string {
  if (!url.startsWith("/")) return url;
  const baseUrl = getPublicBaseUrl(req);
  return baseUrl ? `${baseUrl}${url}` : url;
}

function absolutizeRelease(release: ReleaseInfo, req: Request): ReleaseInfo {
  return {
    ...release,
    downloadUrl: toAbsoluteUrl(release.downloadUrl, req),
  };
}

function absolutizeConfigDownloads(cfg: AppConfig, req: Request): AppConfig {
  const releases: ReleaseConfig = {
    android: absolutizeRelease(cfg.releases.android, req),
    desktop: absolutizeRelease(cfg.releases.desktop, req),
  };
  return {
    ...cfg,
    update: {
      ...cfg.update,
      downloadUrl: toAbsoluteUrl(cfg.update.downloadUrl, req),
    },
    releases,
  };
}

function absolutizeHistoryDownloads(items: UpdateHistoryItem[], req: Request): UpdateHistoryItem[] {
  return items.map((item) => ({
    ...item,
    downloadUrl: toAbsoluteUrl(item.downloadUrl, req),
    releaseFile: item.releaseFile
      ? {
          ...item.releaseFile,
          downloadUrl: toAbsoluteUrl(item.releaseFile.downloadUrl, req),
        }
      : item.releaseFile,
  }));
}

configRouter.get("/bootstrap", (_req, res) => {
  try {
    const { cfg, state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(cfg.bootstrap));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/check-update", (req, res) => {
  try {
    const { cfg, state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(absolutizeConfigDownloads(cfg, req).update));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/releases", (req, res) => {
  try {
    const { cfg, state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(absolutizeConfigDownloads(cfg, req).releases));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/desktop-updates/:platform/:arch/latest.yml", (req, res) => {
  try {
    const { state } = blockedResponse();
    if (state.blocked) {
      res.status(403).type("text/plain").send(state.reason);
      return;
    }
    const platform = String(req.params.platform ?? "").trim();
    const arch = String(req.params.arch ?? "").trim();
    if (platform !== "win32" || arch !== "x64") {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    const asset = readActiveDesktopUpdateAsset("latest.yml", platform, arch);
    if (!asset) {
      res.status(404).type("text/plain").send("latest.yml not configured");
      return;
    }
    res.redirect(302, createPrivateQiniuDownloadUrl(asset.objectKey));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取自动更新配置失败";
    res.status(500).type("text/plain").send(message);
  }
});

configRouter.get("/desktop-updates/:platform/:arch/:fileName", (req, res) => {
  try {
    const { state } = blockedResponse();
    if (state.blocked) {
      res.status(403).type("text/plain").send(state.reason);
      return;
    }
    const platform = String(req.params.platform ?? "").trim();
    const arch = String(req.params.arch ?? "").trim();
    const fileName = String(req.params.fileName ?? "").trim();
    if (platform !== "win32" || arch !== "x64" || !fileName || fileName === "latest.yml") {
      res.status(404).type("text/plain").send("Not found");
      return;
    }
    const asset = readActiveDesktopUpdateAsset(fileName, platform, arch);
    if (!asset) {
      res.status(404).type("text/plain").send("update asset not configured");
      return;
    }
    res.redirect(302, createPrivateQiniuDownloadUrl(asset.objectKey));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取自动更新文件失败";
    res.status(500).type("text/plain").send(message);
  }
});

configRouter.get("/discover", (_req, res) => {
  try {
    const { cfg, state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(cfg.discover));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/get", (_req, res) => {
  try {
    const { state } = blockedResponse();
    if (state.blocked) {
      res.status(403).json(fail(state.reason, -233));
      return;
    }
    const id = String(_req.query.id ?? "").trim();
    if (!id) {
      res.status(400).json(fail("id 不能为空", 400));
      return;
    }
    const item = readDynamicConfigById(id);
    if (!item) {
      res.status(404).json(fail("配置不存在", 404));
      return;
    }
    res.json(
      ok({
        id: item.id,
        type: item.type,
        content: item.content,
      }),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/agreement", (_req, res) => {
  try {
    const { cfg, state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(cfg.agreement));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/service-agreement", (_req, res) => {
  try {
    const { cfg, state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(cfg.agreement));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/privacy-policy", (_req, res) => {
  try {
    const { cfg, state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(cfg.privacy));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/announcements", (_req, res) => {
  try {
    const { state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(readAnnouncements()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/update-history", (req, res) => {
  try {
    const { state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(absolutizeHistoryDownloads(readUpdateHistory(), req)));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/release-files/:id/download", (req, res) => {
  try {
    const { state } = blockedResponse();
    if (state.blocked) {
      res.status(403).json(fail(state.reason, -233));
      return;
    }
    const id = String(req.params.id ?? "").trim();
    const file = readReleaseFileById(id);
    if (!file || file.status !== "uploaded") {
      res.status(404).json(fail("安装包不存在或已删除", 404));
      return;
    }
    res.redirect(302, createPrivateQiniuDownloadUrl(file.objectKey));
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成下载链接失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/about", (_req, res) => {
  try {
    const { cfg, state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(cfg.about));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});
