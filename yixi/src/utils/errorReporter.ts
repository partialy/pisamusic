import electronAPI from "@/utils/electron";

export type ErrorReportContext = Record<string, unknown>;

export function reportError(error: unknown, context?: ErrorReportContext) {
  const route = window.location?.hash || window.location?.pathname;
  return electronAPI.reportError(error, {
    route,
    ...context,
  });
}

