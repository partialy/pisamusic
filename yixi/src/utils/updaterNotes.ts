export function normalizeVersionLabel(value?: string | null): string {
  const cleaned = String(value ?? "").trim().replace(/^v/i, "");
  return cleaned || "-";
}

function stripBasicHtml(text: string): string {
  if (!/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractReleaseNotes(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return stripBasicHtml(item.trim());
        if (item && typeof item === "object" && "note" in item) {
          return stripBasicHtml(String((item as { note?: unknown }).note ?? "").trim());
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  const raw = String(value ?? "").trim();
  return raw ? stripBasicHtml(raw) : "";
}

export function normalizeReleaseNotes(value: unknown, fallback = "暂无更新说明"): string {
  return extractReleaseNotes(value) || fallback;
}
