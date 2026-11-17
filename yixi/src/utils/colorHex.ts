export interface ColorGroupItem {
  id: number;
  value: string;
}

/**
 * 解析并规范化 16 进制颜色（支持 #RRGGBB 与 #RGB），不合法返回 null。
 */
export function parseHexColor(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

/**
 * 规范化多颜色选择器的最小/最大数量边界，保证 2 <= min <= max。
 */
export function resolveColorGroupBounds(maxCount?: number, minCount?: number): {
  min: number;
  max: number;
} {
  const max =
    typeof maxCount === "number" && Number.isInteger(maxCount) && maxCount >= 2
      ? maxCount
      : 2;

  let min: number;
  if (minCount === undefined) {
    min = 2;
  } else if (!Number.isInteger(minCount) || minCount > max) {
    min = max;
  } else if (minCount < 2) {
    min = 2;
  } else {
    min = minCount;
  }

  return { min, max };
}
