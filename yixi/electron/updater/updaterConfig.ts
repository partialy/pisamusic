function normalizeFeedUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "https:") throw new Error("自动更新地址必须使用 HTTPS");
  return url.toString().replace(/\/+$/, "");
}

export function resolveUpdaterFeedCandidates(
  bootstrapFeedBaseUrl: string,
  discoveryFeedBaseUrls: string[],
) {
  const values = [bootstrapFeedBaseUrl, ...discoveryFeedBaseUrls]
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeFeedUrl);
  return [...new Set(values)];
}
