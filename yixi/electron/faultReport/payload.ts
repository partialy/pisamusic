import { FAULT_REPORT_LIMITS, limitText, sanitizedJson, sanitizeUrl } from "./sanitizer";
import type { DesktopFaultReportSourceRecord, FaultReportLogPayload } from "./types";

export function toDesktopFaultReportLog(record: DesktopFaultReportSourceRecord): FaultReportLogPayload {
  return {
    clientLogId: record.clientLogId,
    occurredAt: validOccurredAt(record.createdAt),
    scene: "desktop_network",
    failureType: record.requestScope === "gateway" ? "gateway_request_failed" : "system_request_failed",
    methodName: limitText(record.requestPath, 128),
    requestMethod: limitText(record.method, 16),
    requestUrl: sanitizeUrl(record.requestUrl),
    requestParamsJson: sanitizedJson(record.requestParams, FAULT_REPORT_LIMITS.params),
    nonceId: limitText(record.businessCode, 128),
    responseCode: validResponseCode(record.httpStatus),
    responseBody: sanitizedJson(record.response, FAULT_REPORT_LIMITS.response),
    resolvedUrl: "",
    errorType: limitText(record.requestScope, 256),
    errorMessage: limitText(record.errorMessage, FAULT_REPORT_LIMITS.error),
    stackTrace: "",
    songSource: "",
    songId: "",
    quality: "",
  };
}

function validOccurredAt(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
}

function validResponseCode(value: number | null) {
  return Number.isInteger(value) && value !== null && value >= 100 && value <= 999 ? value : null;
}
