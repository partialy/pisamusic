import { Router, type Request, type Response } from "express";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import multer from "multer";
import {
  FEEDBACK_TYPES,
  insertFeedback,
  listClientFeedback,
  readClientFeedbackDetail,
  type ClientFeedbackIdentity,
  type FeedbackType,
} from "../db/feedbackStore";
import { deviceMessageIdentityFromRequest } from "../middleware/deviceMessageToken";
import { tokenFromRequest, verifyUserToken } from "../middleware/requireUserJwt";
import { fail, ok } from "../types/response";

export const feedbackRouter = Router();

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FEEDBACK_TYPE_SET = new Set<string>(FEEDBACK_TYPES);
const FEEDBACK_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads", "feedback");

function extForMime(mime: string): string {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return "";
}

try {
  mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {
  /* ignore */
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = extForMime(file.mimetype) || path.extname(file.originalname) || ".bin";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 3 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) cb(null, true);
    else cb(new Error("INVALID_IMAGE_TYPE"));
  },
});

type FeedbackFile = Express.Multer.File;

function handleMulterErr(err: unknown, res: import("express").Response, next: import("express").NextFunction) {
  if (!err) {
    next();
    return;
  }
  if (err instanceof Error && err.message === "INVALID_IMAGE_TYPE") {
    res.status(400).json(fail("仅支持 JPEG、PNG、WebP 图片", 400));
    return;
  }
  const me = err as { code?: string };
  if (me.code === "LIMIT_FILE_SIZE") {
    res.status(400).json(fail("单张图片不能超过 5MB", 400));
    return;
  }
  if (me.code === "LIMIT_UNEXPECTED_FILE") {
    res.status(400).json(fail("最多上传 3 张图片", 400));
    return;
  }
  next(err);
}

async function resolveOptionalSubmitIdentity(req: Request, device: Record<string, unknown>) {
  const user = await verifyUserToken(tokenFromRequest(req));
  const deviceToken = await deviceMessageIdentityFromRequest(req);
  if (deviceToken) {
    return {
      userId: user?.id ?? null,
      deviceKind: deviceToken.kind,
      deviceId: deviceToken.deviceId,
    };
  }
  const serverDeviceId = typeof device.serverDeviceId === "string" ? device.serverDeviceId.trim() : "";
  if (serverDeviceId && serverDeviceId.length <= 191) {
    return {
      userId: user?.id ?? null,
      deviceKind: "android" as const,
      deviceId: serverDeviceId,
    };
  }
  return {
    userId: user?.id ?? null,
    deviceKind: null,
    deviceId: null,
  };
}

async function requireClientFeedbackIdentity(
  req: Request,
  res: Response,
): Promise<ClientFeedbackIdentity | null> {
  const rawAuth = tokenFromRequest(req);
  const rawDeviceToken = String(req.header("x-pm-device-token") ?? "").trim();
  const [user, deviceToken] = await Promise.all([
    rawAuth ? verifyUserToken(rawAuth) : Promise.resolve(null),
    rawDeviceToken ? deviceMessageIdentityFromRequest(req) : Promise.resolve(null),
  ]);
  if (rawAuth && !user) {
    res.status(401).json(fail("登录凭证已失效，请重新登录", 401));
    return null;
  }
  if (rawDeviceToken && !deviceToken) {
    res.status(401).json(fail("设备凭证无效或已过期", 401));
    return null;
  }
  if (!user && !deviceToken) {
    res.status(401).json(fail("缺少有效的账号或设备身份", 401));
    return null;
  }
  return {
    userId: user?.id ?? null,
    device: deviceToken ? { kind: deviceToken.kind, id: deviceToken.deviceId } : null,
  };
}

feedbackRouter.get("/", async (req, res) => {
  const identity = await requireClientFeedbackIdentity(req, res);
  if (!identity) return;
  try {
    const data = await listClientFeedback(identity, req.query.offset, req.query.limit);
    return res.json(ok(data));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "查询反馈记录失败";
    return res.status(500).json(fail(msg, 500));
  }
});

feedbackRouter.get("/:id", async (req, res) => {
  const id = String(req.params.id ?? "").trim();
  if (!FEEDBACK_ID_RE.test(id)) {
    return res.status(400).json(fail("无效的反馈 ID", 400));
  }
  const identity = await requireClientFeedbackIdentity(req, res);
  if (!identity) return;
  try {
    const item = await readClientFeedbackDetail(identity, id);
    if (!item) return res.status(404).json(fail("反馈记录不存在", 404));
    return res.json(ok(item));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "查询反馈详情失败";
    return res.status(500).json(fail(msg, 500));
  }
});

feedbackRouter.post(
  "/",
  (req, res, next) => {
    upload.array("images", 3)(req, res, (e) => handleMulterErr(e, res, next));
  },
  async (req, res) => {
    try {
      const description = String(req.body?.description ?? "").trim();
      const feedback_type = String(req.body?.feedback_type ?? "").trim();
      const contactRaw = String(req.body?.contact ?? "").trim();
      const contact = contactRaw.length > 0 ? contactRaw : null;

      if (description.length < 1 || description.length > 500) {
        return res.status(400).json(fail("问题描述长度应为 1-500 字", 400));
      }
      if (!FEEDBACK_TYPE_SET.has(feedback_type)) {
        return res.status(400).json(fail("无效的反馈类型", 400));
      }

      let device: Record<string, unknown> = {};
      const deviceStr = req.body?.device;
      if (typeof deviceStr === "string" && deviceStr.length > 0) {
        try {
          const parsed = JSON.parse(deviceStr) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            device = parsed as Record<string, unknown>;
          }
        } catch {
          device = {};
        }
      }

      const files = (req.files as FeedbackFile[] | undefined) ?? [];
      for (const f of files) {
        if (!ALLOWED_MIMES.has(f.mimetype)) return res.status(400).json(fail("不支持的图片格式", 400));
        if (f.size > MAX_BYTES) return res.status(400).json(fail("单张图片不能超过 5MB", 400));
      }

      const identity = await resolveOptionalSubmitIdentity(req, device);
      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const imagePaths = files.map((f) => path.posix.join("uploads", "feedback", f.filename));
      (await insertFeedback({
        id,
        createdAt,
        feedbackType: feedback_type as FeedbackType,
        description,
        contact,
        device,
        imagePaths,
        userId: identity.userId,
        deviceKind: identity.deviceKind,
        deviceId: identity.deviceId,
      }));

      return res.json(ok({ id, createdAt }, "提交成功"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "提交失败";
      return res.status(500).json(fail(msg, 500));
    }
  },
);
