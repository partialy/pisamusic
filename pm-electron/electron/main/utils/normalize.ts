export function normalizeBaseUrl(raw: string): string {
  const value = raw.trim();
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    throw new Error(`非法 baseUrl: ${raw}`);
  }
  return value.endsWith("/") ? value : `${value}/`;
}

export function buildUrl(base: string, path: string, query: Record<string, string | number | boolean | undefined | null> = {}): string {
  const url = new URL(path, normalizeBaseUrl(base));
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

export function isValidHttpUrl(value?: string | null): value is string {
  return typeof value === "string" && /^https?:\/\//.test(value);
}
