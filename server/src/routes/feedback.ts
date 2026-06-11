import { Router } from "express";
import { mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import multer from "multer";
import { FEEDBACK_TYPES, insertFeedback, type FeedbackType } from "../db/feedbackStore";
import { fail, ok } from "../types/response";

export const feedbackRouter = Router();

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const FEEDBACK_TYPE_SET = new Set<string>(FEEDBACK_TYPES);
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

      const id = randomUUID();
      const createdAt = new Date().toISOString();
      const imagePaths = files.map((f) => path.posix.join("uploads", "feedback", f.filename));
      insertFeedback({
        id,
        createdAt,
        feedbackType: feedback_type as FeedbackType,
        description,
        contact,
        device,
        imagePaths,
      });

      return res.json(ok({ id, createdAt }, "提交成功"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "提交失败";
      return res.status(500).json(fail(msg, 500));
    }
  },
);
