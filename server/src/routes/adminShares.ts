import { Router } from "express";
import {
  SHARE_TYPES,
  invalidateShareRecord,
  listAdminShares,
  type ShareType,
} from "../db/shareStore";
import { fail, ok } from "../types/response";

export const adminSharesRouter = Router();

const SHARE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeType(value: unknown): ShareType | undefined {
  return typeof value === "string" && SHARE_TYPES.includes(value as ShareType)
    ? (value as ShareType)
    : undefined;
}

function normalizeValid(value: unknown): boolean | undefined | null {
  if (value === undefined || value === "" || value === "all") return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return null;
}

adminSharesRouter.get("/", (req, res) => {
  try {
    const typeValue = typeof req.query.type === "string" ? req.query.type.trim() : "";
    const validValue = typeof req.query.valid === "string" ? req.query.valid.trim() : undefined;
    const type = normalizeType(typeValue);
    const valid = normalizeValid(validValue);
    if (typeValue && !type) return res.status(400).json(fail("Invalid share type", 400));
    if (valid === null) return res.status(400).json(fail("Invalid share valid filter", 400));
    return res.json(
      ok(
        listAdminShares({
          type,
          valid,
          sharer: typeof req.query.sharer === "string" ? req.query.sharer : undefined,
          offset: req.query.offset,
          limit: req.query.limit,
        }),
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read share records";
    return res.status(500).json(fail(message, 500));
  }
});

adminSharesRouter.patch("/:uuid/invalid", (req, res) => {
  try {
    const uuid = String(req.params.uuid ?? "").trim();
    if (!SHARE_UUID_RE.test(uuid)) return res.status(400).json(fail("Invalid share uuid", 400));
    const updated = invalidateShareRecord(uuid);
    if (!updated) return res.status(404).json(fail("Share record not found", 404));
    return res.json(ok(updated, "Share record invalidated"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to invalidate share record";
    return res.status(500).json(fail(message, 500));
  }
});
