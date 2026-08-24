import type { ByteRange, ParsedContentRange } from "./types";

export function parseByteRange(value: string | null, totalBytes = 0): ByteRange | null {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return null;

  const normalizedTotal = Number.isSafeInteger(totalBytes) && totalBytes > 0 ? totalBytes : 0;
  if (!match[1]) {
    if (!normalizedTotal) return null;
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return {
      start: Math.max(0, normalizedTotal - suffixLength),
      end: normalizedTotal - 1,
    };
  }

  const start = Number(match[1]);
  if (!Number.isSafeInteger(start) || start < 0) return null;
  if (normalizedTotal && start >= normalizedTotal) return null;

  if (!match[2]) {
    return { start, end: normalizedTotal ? normalizedTotal - 1 : null };
  }
  const requestedEnd = Number(match[2]);
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) return null;
  return {
    start,
    end: normalizedTotal ? Math.min(requestedEnd, normalizedTotal - 1) : requestedEnd,
  };
}

export function parseContentRange(value: string | null): ParsedContentRange | null {
  if (!value) return null;
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i.exec(value.trim());
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = match[3] === "*" ? null : Number(match[3]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) return null;
  if (total !== null && (!Number.isSafeInteger(total) || total <= end)) return null;
  return { start, end, total };
}

export function formatByteRange(range: ByteRange) {
  return `bytes=${range.start}-${range.end ?? ""}`;
}
