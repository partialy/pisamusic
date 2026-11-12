import { Router } from "express";
import {
  WEBSITE_RECORD_TYPES,
  listAdminWebsiteRecords,
  readAdminWebsiteRecordDetail,
  type WebsiteRecordType,
} from "../db/websiteRecordStore";
import { fail, ok } from "../types/response";
import { readWebsiteStats } from "../db/websiteStatsStore";
import { normalizeWebsiteDomain } from "../utils/websiteDomain";

export const adminWebsiteRecordsRouter = Router();

const RECORD_ID_RE = /^[A-Za-z0-9_-]{1,128}$/;

function normalizeType(value: unknown): WebsiteRecordType | null {
  return typeof value === "string" && WEBSITE_RECORD_TYPES.includes(value as WebsiteRecordType)
    ? value as WebsiteRecordType
    : null;
}

function readFilters(query: Record<string, unknown>) {
  const domain = query.domain === undefined ? undefined : typeof query.domain === "string" ? query.domain : null;
  if (domain === null || (domain !== undefined && domain !== "" && normalizeWebsiteDomain(domain) !== domain)) throw new Error("domain 必须是规范域名，空字符串表示未知域名");
  const day = (value: unknown): string | undefined => {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("日期格式必须为 YYYY-MM-DD");
    return value;
  };
  const startDay = day(query.startDay);
  const endDay = day(query.endDay);
  if (startDay && endDay && startDay > endDay) throw new Error("开始日期不能晚于结束日期");
  return { domain, startDay, endDay };
}

adminWebsiteRecordsRouter.get("/stats", async (req, res) => {
  let filters: ReturnType<typeof readFilters>;
  const days = req.query.days === undefined ? 30 : Number(req.query.days);
  try {
    filters = readFilters(req.query);
    if (![7, 30, 90].includes(days)) throw new Error("days 仅支持 7、30、90");
  } catch (error) { return res.status(400).json(fail((error as Error).message, 400)); }
  try { return res.json(ok(await readWebsiteStats(days as 7 | 30 | 90, filters.domain))); }
  catch (error) { return res.status(500).json(fail(error instanceof Error ? error.message : "读取域名统计失败", 500)); }
});

adminWebsiteRecordsRouter.get("/", async (req, res) => {
  let filters: ReturnType<typeof readFilters>;
  try { filters = readFilters(req.query); }
  catch (error) { return res.status(400).json(fail((error as Error).message, 400)); }
  try {
    const type = normalizeType(req.query.type);
    if (!type) return res.status(400).json(fail("type 仅支持 visit 或 download", 400));
    return res.json(ok((await listAdminWebsiteRecords(type, {
      offset: req.query.offset,
      limit: req.query.limit,
      ...filters,
    }))));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取官网记录失败";
    return res.status(500).json(fail(message, 500));
  }
});

adminWebsiteRecordsRouter.get("/:type/:id", async (req, res) => {
  try {
    const type = normalizeType(req.params.type);
    if (!type) return res.status(400).json(fail("记录类型仅支持 visit 或 download", 400));
    const id = String(req.params.id ?? "").trim();
    if (!RECORD_ID_RE.test(id)) return res.status(400).json(fail("无效的记录 ID", 400));
    const record = (await readAdminWebsiteRecordDetail(type, id));
    if (!record) return res.status(404).json(fail("官网记录不存在", 404));
    return res.json(ok(record));
  } catch (error) {
    const message = error instanceof Error ? error.message : "读取官网记录详情失败";
    return res.status(500).json(fail(message, 500));
  }
});
