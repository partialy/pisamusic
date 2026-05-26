import { Router } from "express";
import {
  deleteDynamicConfig,
  listDynamicConfigs,
  readDynamicConfigById,
  saveDynamicConfig,
  type DynamicConfigItem,
  type DynamicConfigType,
} from "../db/dynamicConfigStore";
import { fail, ok } from "../types/response";

export const adminDynamicConfigRouter = Router();

const DYNAMIC_CONFIG_ID_RE = /^[A-Za-z0-9._-]{1,120}$/;
const DYNAMIC_CONFIG_TYPES: readonly DynamicConfigType[] = ["html", "string", "number", "url"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeType(value: unknown): DynamicConfigType | null {
  return typeof value === "string" && DYNAMIC_CONFIG_TYPES.includes(value as DynamicConfigType)
    ? (value as DynamicConfigType)
    : null;
}

function normalizeId(value: unknown): { ok: true; value: string } | { ok: false; msg: string } {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) return { ok: false, msg: "id 不能为空" };
  if (!DYNAMIC_CONFIG_ID_RE.test(id)) {
    return { ok: false, msg: "id 仅支持字母、数字、点号、下划线和短横线，长度不能超过 120" };
  }
  return { ok: true, value: id };
}

function normalizeContent(value: unknown, type: DynamicConfigType): { ok: true; value: string } | { ok: false; msg: string } {
  if (typeof value !== "string") return { ok: false, msg: "content 必须是字符串" };
  if (value.length > 50000) return { ok: false, msg: "content 长度不能超过 50000" };
  if (type === "number") {
    const num = Number(value.trim());
    if (!Number.isFinite(num)) return { ok: false, msg: "number 类型的 content 必须是有效数字" };
  }
  if (type === "url") {
    try {
      const url = new URL(value.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { ok: false, msg: "url 类型仅支持 http/https 链接" };
      }
    } catch {
      return { ok: false, msg: "url 类型的 content 必须是有效完整链接" };
    }
  }
  return { ok: true, value };
}

function normalizePayload(body: unknown, fixedId?: string): { ok: true; value: Pick<DynamicConfigItem, "id" | "type" | "content"> } | { ok: false; msg: string } {
  if (!isRecord(body)) return { ok: false, msg: "请求体必须是对象" };
  const id = normalizeId(fixedId ?? body.id);
  if (!id.ok) return id;
  const type = normalizeType(body.type);
  if (!type) {
    return { ok: false, msg: "type 仅支持 html、string、number、url" };
  }
  const content = normalizeContent(body.content, type);
  if (!content.ok) return content;
  return {
    ok: true,
    value: {
      id: id.value,
      type,
      content: content.value,
    },
  };
}

adminDynamicConfigRouter.get("/", (_req, res) => {
  try {
    return res.json(ok(listDynamicConfigs()));
  } catch (e) {
    const message = e instanceof Error ? e.message : "读取动态配置失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminDynamicConfigRouter.post("/", (req, res) => {
  try {
    const result = normalizePayload(req.body);
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    if (readDynamicConfigById(result.value.id)) {
      return res.status(409).json(fail("动态配置已存在", 409));
    }
    return res.json(ok(saveDynamicConfig(result.value), "动态配置已保存"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存动态配置失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminDynamicConfigRouter.put("/:id", (req, res) => {
  try {
    const result = normalizePayload(req.body, String(req.params.id ?? "").trim());
    if (!result.ok) return res.status(400).json(fail(result.msg, 400));
    if (!readDynamicConfigById(result.value.id)) {
      return res.status(404).json(fail("动态配置不存在", 404));
    }
    return res.json(ok(saveDynamicConfig(result.value), "动态配置已保存"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存动态配置失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminDynamicConfigRouter.delete("/:id", (req, res) => {
  try {
    const id = normalizeId(req.params.id);
    if (!id.ok) return res.status(400).json(fail(id.msg, 400));
    const deleted = deleteDynamicConfig(id.value);
    if (!deleted) return res.status(404).json(fail("动态配置不存在", 404));
    return res.json(ok(null, "动态配置已删除"));
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除动态配置失败";
    return res.status(500).json(fail(message, 500));
  }
});
