import { Router } from "express";
import {
  WEBSITE_RECORD_TYPES,
  listAdminWebsiteRecords,
  readAdminWebsiteRecordDetail,
  type WebsiteRecordType,
} from "../db/websiteRecordStore";
import { fail, ok } from "../types/response";

export const adminWebsiteRecordsRouter = Router();

const RECORD_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function normalizeType(value: unknown): WebsiteRecordType | null {
  return typeof value === "string" && WEBSITE_RECORD_TYPES.includes(value as WebsiteRecordType)
    ? value as WebsiteRecordType
    : null;
}

adminWebsiteRecordsRouter.get("/", (req, res) => {
  try {
    const type = normalizeType(req.query.type);
    if (!type) return res.status(400).json(fail("type 仅支持 visit 或 download", 400));
    return res.json(ok(listAdminWebsiteRecords(type, {
      offset: req.query.offset,
      limit: req.query.limit,
    })));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取官网记录失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminWebsiteRecordsRouter.get("/:type/:id", (req, res) => {
  try {
    const type = normalizeType(req.params.type);
    if (!type) return res.status(400).json(fail("记录类型仅支持 visit 或 download", 400));
    const id = String(req.params.id ?? "").trim();
    if (!RECORD_ID_RE.test(id)) return res.status(400).json(fail("无效的记录 ID", 400));
    const record = readAdminWebsiteRecordDetail(type, id);
    if (!record) return res.status(404).json(fail("官网记录不存在", 404));
    return res.json(ok(record));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取官网记录详情失败";
    return res.status(500).json(fail(message, 500));
  }
});
