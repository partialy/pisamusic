import electronAPI from "@/utils/electron";

export type ErrorReportContext = Record<string, unknown>;

export function reportError(error: unknown, context?: ErrorReportContext) {
  const route = window.location?.hash || window.location?.pathname;
  return electronAPI.reportError(toReportableError(error), {
    route,
    ...toReportableContext(context),
  });
}

function toReportableError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      raw: JSON.stringify(error)
    };
  }

  if (isErrorLike(error)) {
    return {
      name: toStringValue(error.name, "Error"),
      message: toStringValue(error.message, String(error)),
      stack: toStringValue(error.stack),
      raw: JSON.stringify(error)
    };
  }

  return {
    name: "Error",
    message: toStringValue(error, String(error)),
    raw: JSON.stringify(error)
  };
}

function isErrorLike(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toReportableContext(context?: ErrorReportContext) {
  if (!context) return undefined;
  try {
    return JSON.parse(JSON.stringify(context)) as ErrorReportContext;
  } catch {
    return { contextSerializeError: true };
  }
}
