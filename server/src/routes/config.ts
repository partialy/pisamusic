import { Router } from "express";
import {
  readAnnouncements,
  readAppConfig,
  readUpdateHistory,
  shouldBlock,
} from "../db/configStore";
import { fail, ok } from "../types/response";

export const configRouter = Router();

function blockedResponse() {
  const cfg = readAppConfig();
  const state = shouldBlock(cfg);
  return { cfg, state };
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

configRouter.get("/check-update", (_req, res) => {
  try {
    const { cfg, state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(cfg.update));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
  }
});

configRouter.get("/releases", (_req, res) => {
  try {
    const { cfg, state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(cfg.releases));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
    res.status(500).json(fail(message, 500));
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

configRouter.get("/update-history", (_req, res) => {
  try {
    const { state } = blockedResponse();
    if (state.blocked) {
      res.json(fail(state.reason, -233));
      return;
    }
    res.json(ok(readUpdateHistory()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取配置失败";
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
