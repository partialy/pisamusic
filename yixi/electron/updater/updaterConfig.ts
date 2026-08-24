function normalizeFeedUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  return url.toString().replace(/\/+$/, "");
}

export function resolveUpdaterFeedCandidates(
  bootstrapFeedBaseUrl: string,
  discoveryFeedBaseUrls: string[],
) {
  const values = [bootstrapFeedBaseUrl, ...discoveryFeedBaseUrls]
    .map((value) => normalizeFeedUrl(value))
    .filter((value): value is string => Boolean(value));
  return [...new Set(values)];
}
