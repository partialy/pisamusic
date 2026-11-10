import { randomUUID } from "node:crypto";
import { getAppDb } from "./appDb";

export const FAULT_REPORT_STATUSES = ["pending", "processed"] as const;
export const FAULT_REPORT_SCENES = ["play_url", "desktop_network"] as const;
export const FAULT_REPORT_PLATFORMS = ["android", "desktop"] as const;

export type FaultReportStatus = (typeof FAULT_REPORT_STATUSES)[number];
export type FaultReportScene = (typeof FAULT_REPORT_SCENES)[number];
export type FaultReportPlatform = (typeof FAULT_REPORT_PLATFORMS)[number];

export type FaultReportEnvironment = {
  platform: FaultReportPlatform;
  arch: string;
  appVersion: string;
  appVersionCode: number;
  osVersion: string;
  sdkInt: number;
  brand: string;
  model: string;
  networkType: string;
};

export type FaultReportLogInput = {
  clientLogId: string;
  occurredAt: number;
  scene: FaultReportScene;
  failureType: string;
  methodName: string;
  requestMethod: string;
  requestUrl: string;
  requestParamsJson: string;
  nonceId: string;
  responseCode: number | null;
  responseBody: string;
  resolvedUrl: string;
  errorType: string;
  errorMessage: string;
  stackTrace: string;
  songSource: string;
  songId: string;
  quality: string;
};

export type FaultReportCreateInput = {
  reportId: string;
  scene: FaultReportScene;
  environment: FaultReportEnvironment;
  logs: FaultReportLogInput[];
};

export type FaultReportCreateResult = {
  reportId: string | null;
  acceptedCount: number;
  duplicateCount: number;
  receivedCount: number;
  createdAt: number;
};

export type AdminFaultReportFilter = {
  status?: FaultReportStatus;
  scene?: FaultReportScene;
  keyword?: string;
  offset?: unknown;
  limit?: unknown;
};

export type AdminFaultReportListItem = {
  id: string;
  userId: string | null;
  scene: FaultReportScene;
  platform: FaultReportPlatform;
  arch: string;
  appVersion: string;
  appVersionCode: number;
  osVersion: string;
  sdkInt: number;
  brand: string;
  model: string;
  networkType: string;
  logCount: number;
  status: FaultReportStatus;
  createdAt: number;
  processedAt: number | null;
};

export type AdminFaultReportDetail = AdminFaultReportListItem & {
  logs: FaultReportLogInput[];
};

export class FaultReportValidationError extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_LOGS = 300;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, maxLength: number, field: string, required = false): string {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (required && !normalized) throw new FaultReportValidationError(`${field}不能为空`);
  if (normalized.length > maxLength) throw new FaultReportValidationError(`${field}不能超过${maxLength}个字符`);
  return normalized;
}

function integer(value: unknown, min: number, max: number, field: string): number {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new FaultReportValidationError(`${field}无效`);
  }
  return parsed;
}

function nullableInteger(value: unknown, min: number, max: number, field: string): number | null {
  if (value === null || value === undefined || value === "") return null;
  return integer(value, min, max, field);
}

function scene(value: unknown): FaultReportScene {
  if (typeof value === "string" && FAULT_REPORT_SCENES.includes(value as FaultReportScene)) {
    return value as FaultReportScene;
  }
  throw new FaultReportValidationError("scene无效");
}

function platform(value: unknown, reportScene: FaultReportScene): FaultReportPlatform {
  if (value === undefined || value === null || value === "") {
    return reportScene === "desktop_network" ? "desktop" : "android";
  }
  if (typeof value === "string" && FAULT_REPORT_PLATFORMS.includes(value as FaultReportPlatform)) {
    return value as FaultReportPlatform;
  }
  throw new FaultReportValidationError("platform无效");
}

export function normalizeFaultReportCreateInput(value: unknown): FaultReportCreateInput {
  const body = record(value);
  const reportId = text(body.reportId, 64, "reportId", true);
  if (!UUID_RE.test(reportId)) throw new FaultReportValidationError("reportId无效");
  const reportScene = scene(body.scene);
  const rawEnvironment = record(body.environment);
  const environment: FaultReportEnvironment = {
    platform: platform(rawEnvironment.platform, reportScene),
    arch: text(rawEnvironment.arch, 32, "arch"),
    appVersion: text(rawEnvironment.appVersion, 64, "appVersion"),
    appVersionCode: integer(rawEnvironment.appVersionCode ?? 0, 0, Number.MAX_SAFE_INTEGER, "appVersionCode"),
    osVersion: text(rawEnvironment.osVersion, 64, "osVersion"),
    sdkInt: integer(rawEnvironment.sdkInt ?? 0, 0, 1000, "sdkInt"),
    brand: text(rawEnvironment.brand, 128, "brand"),
    model: text(rawEnvironment.model, 128, "model"),
    networkType: text(rawEnvironment.networkType, 32, "networkType"),
  };
  if (!Array.isArray(body.logs) || body.logs.length < 1 || body.logs.length > MAX_LOGS) {
    throw new FaultReportValidationError(`logs数量必须为1-${MAX_LOGS}`);
  }
  const seen = new Set<string>();
  const logs = body.logs.map((raw, index): FaultReportLogInput => {
    const item = record(raw);
    const clientLogId = text(item.clientLogId, 64, `logs[${index}].clientLogId`, true);
    if (!UUID_RE.test(clientLogId)) throw new FaultReportValidationError(`logs[${index}].clientLogId无效`);
    if (seen.has(clientLogId)) throw new FaultReportValidationError(`logs[${index}].clientLogId重复`);
    seen.add(clientLogId);
    const logScene = scene(item.scene);
    if (logScene !== reportScene) throw new FaultReportValidationError(`logs[${index}].scene与批次不一致`);
    return {
      clientLogId,
      occurredAt: integer(item.occurredAt, 1, Number.MAX_SAFE_INTEGER, `logs[${index}].occurredAt`),
      scene: logScene,
      failureType: text(item.failureType, 64, `logs[${index}].failureType`, true),
      methodName: text(item.methodName, 128, `logs[${index}].methodName`),
      requestMethod: text(item.requestMethod, 16, `logs[${index}].requestMethod`),
      requestUrl: text(item.requestUrl, 2048, `logs[${index}].requestUrl`),
      requestParamsJson: text(item.requestParamsJson, 4096, `logs[${index}].requestParamsJson`),
      nonceId: text(item.nonceId, 128, `logs[${index}].nonceId`),
      responseCode: nullableInteger(item.responseCode, 100, 999, `logs[${index}].responseCode`),
      responseBody: text(item.responseBody, 4096, `logs[${index}].responseBody`),
      resolvedUrl: text(item.resolvedUrl, 2048, `logs[${index}].resolvedUrl`),
      errorType: text(item.errorType, 256, `logs[${index}].errorType`),
      errorMessage: text(item.errorMessage, 2048, `logs[${index}].errorMessage`),
      stackTrace: text(item.stackTrace, 4096, `logs[${index}].stackTrace`),
      songSource: text(item.songSource, 32, `logs[${index}].songSource`),
      songId: text(item.songId, 256, `logs[${index}].songId`),
      quality: text(item.quality, 64, `logs[${index}].quality`),
    };
  });
  return { reportId, scene: reportScene, environment, logs };
}

async function uniqueReportId(preferred: string): Promise<string> {
  const db = getAppDb();
  if (!(await db.queryOne("SELECT 1 FROM fault_reports WHERE id = ?", [preferred]))) return preferred;
  let candidate = randomUUID();
  while ((await db.queryOne("SELECT 1 FROM fault_reports WHERE id = ?", [candidate]))) candidate = randomUUID();
  return candidate;
}

export async function createFaultReport(input: FaultReportCreateInput, userId: string | null): Promise<FaultReportCreateResult> {
  const db = getAppDb();
  const placeholders = input.logs.map(() => "?").join(",");
  const existingRows = (await db.query(`SELECT client_log_id FROM fault_report_logs WHERE client_log_id IN (${placeholders})`, [...input.logs.map((item) => item.clientLogId)])) as Array<{ client_log_id: string }>;
  const existingIds = new Set(existingRows.map((row) => row.client_log_id));
  const freshLogs = input.logs.filter((item) => !existingIds.has(item.clientLogId));
  const createdAt = Date.now();
  if (freshLogs.length === 0) {
    return { reportId: null, acceptedCount: 0, duplicateCount: input.logs.length, receivedCount: input.logs.length, createdAt };
  }

  const reportId = (await uniqueReportId(input.reportId));
  await db.transaction(async () => {
    (await db.execute(`INSERT INTO fault_reports (
        id, user_id, scene, platform, arch, app_version, app_version_code, os_version, sdk_int,
        brand, model, network_type, log_count, status, created_at, processed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, NULL)`, [reportId, userId, input.scene, input.environment.platform, input.environment.arch, input.environment.appVersion, input.environment.appVersionCode, input.environment.osVersion, input.environment.sdkInt, input.environment.brand, input.environment.model, input.environment.networkType, freshLogs.length, createdAt]));

    for (const log of freshLogs) {
      (await db.execute(`INSERT INTO fault_report_logs (
        client_log_id, report_id, occurred_at, scene, failure_type, method_name,
        request_method, request_url, request_params_json, nonce_id, response_code,
        response_body, resolved_url, error_type, error_message, stack_trace,
        song_source, song_id, quality
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [log.clientLogId, reportId, log.occurredAt, log.scene, log.failureType, log.methodName, log.requestMethod, log.requestUrl, log.requestParamsJson, log.nonceId, log.responseCode, log.responseBody, log.resolvedUrl, log.errorType, log.errorMessage, log.stackTrace, log.songSource, log.songId, log.quality]));
    }

  });
  return {
    reportId,
    acceptedCount: freshLogs.length,
    duplicateCount: input.logs.length - freshLogs.length,
    receivedCount: input.logs.length,
    createdAt,
  };
}

function pagination(offset: unknown, limit: unknown): { offset: number; limit: number } {
  return {
    offset: Math.max(0, Math.trunc(Number(offset) || 0)),
    limit: Math.min(100, Math.max(1, Math.trunc(Number(limit) || 20))),
  };
}

type FaultReportRow = {
  id: string; user_id: string | null; scene: FaultReportScene; app_version: string;
  platform: FaultReportPlatform; arch: string;
  app_version_code: number; os_version: string; sdk_int: number; brand: string; model: string;
  network_type: string; log_count: number; status: FaultReportStatus; created_at: number; processed_at: number | null;
};

function mapReport(row: FaultReportRow): AdminFaultReportListItem {
  return {
    id: row.id, userId: row.user_id, scene: row.scene, appVersion: row.app_version,
    platform: row.platform, arch: row.arch,
    appVersionCode: row.app_version_code, osVersion: row.os_version, sdkInt: row.sdk_int,
    brand: row.brand, model: row.model, networkType: row.network_type, logCount: row.log_count,
    status: row.status, createdAt: row.created_at, processedAt: row.processed_at,
  };
}

function whereClause(filter: AdminFaultReportFilter): { sql: string; params: Array<string | number> } {
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (filter.status) { clauses.push("r.status = ?"); params.push(filter.status); }
  if (filter.scene) { clauses.push("r.scene = ?"); params.push(filter.scene); }
  const keyword = filter.keyword?.trim();
  if (keyword) {
    const term = `%${keyword}%`;
    clauses.push(`(r.id LIKE ? OR COALESCE(r.user_id, '') LIKE ? OR r.app_version LIKE ? OR EXISTS (
      SELECT 1 FROM fault_report_logs l WHERE l.report_id = r.id AND (l.method_name LIKE ? OR l.error_message LIKE ? OR l.song_id LIKE ?)
    ))`);
    params.push(term, term, term, term, term, term);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export async function listAdminFaultReports(filter: AdminFaultReportFilter) {
  const db = getAppDb();
  const page = pagination(filter.offset, filter.limit);
  const where = whereClause(filter);
  const total = Number(((await db.queryOne(`SELECT COUNT(*) AS total FROM fault_reports r ${where.sql}`, [...where.params])) as { total: number }).total) || 0;
  const rows = (await db.query(`SELECT r.* FROM fault_reports r ${where.sql} ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`, [...where.params, page.limit, page.offset])) as FaultReportRow[];
  return { items: rows.map(mapReport), total, ...page };
}

export async function readAdminFaultReport(id: string): Promise<AdminFaultReportDetail | null> {
  const db = getAppDb();
  const report = (await db.queryOne("SELECT * FROM fault_reports WHERE id = ?", [id])) as FaultReportRow | undefined;
  if (!report) return null;
  const logs = (await db.query(`SELECT * FROM fault_report_logs WHERE report_id = ? ORDER BY occurred_at DESC, client_log_id DESC`, [id])) as Array<Record<string, unknown>>;
  return {
    ...mapReport(report),
    logs: logs.map((row) => ({
      clientLogId: String(row.client_log_id), occurredAt: Number(row.occurred_at), scene: row.scene as FaultReportScene,
      failureType: String(row.failure_type), methodName: String(row.method_name), requestMethod: String(row.request_method),
      requestUrl: String(row.request_url), requestParamsJson: String(row.request_params_json), nonceId: String(row.nonce_id),
      responseCode: row.response_code == null ? null : Number(row.response_code), responseBody: String(row.response_body),
      resolvedUrl: String(row.resolved_url), errorType: String(row.error_type), errorMessage: String(row.error_message),
      stackTrace: String(row.stack_trace), songSource: String(row.song_source), songId: String(row.song_id), quality: String(row.quality),
    })),
  };
}

export async function updateAdminFaultReportStatus(id: string, status: FaultReportStatus): Promise<AdminFaultReportDetail | null> {
  const processedAt = status === "processed" ? Date.now() : null;
  const result = (await getAppDb().execute("UPDATE fault_reports SET status = ?, processed_at = ? WHERE id = ?", [status, processedAt, id]));
  return result.affectedRows > 0 ? (await readAdminFaultReport(id)) : null;
}

export async function deleteAdminFaultReport(id: string): Promise<boolean> {
  return (await getAppDb().execute("DELETE FROM fault_reports WHERE id = ?", [id])).affectedRows > 0;
}
