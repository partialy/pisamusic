const HTML_TAG_PATTERN = /<\/?[a-z][^>]*>/i;

export function normalizePlainTextContent(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function legacyHtmlToPlainText(value: string): string {
  if (!HTML_TAG_PATTERN.test(value)) return normalizePlainTextContent(value);

  return normalizePlainTextContent(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "- ")
      .replace(/<\/(?:p|div|h[1-6]|li|blockquote|section|article|tr)>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/\n[ \t]+\n/g, "\n\n")
      .replace(/\n{3,}/g, "\n\n"),
  );
}
