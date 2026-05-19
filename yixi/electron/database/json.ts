export function normalizeLimit(limit: number) {
  if (!Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.floor(limit), 1), 500);
}

export function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify({
      stringifyError: true,
      fallback: String(value),
    });
  }
}
