export function normalizePathname(urlOrPath: string): string {
  if (!urlOrPath) return "/";
  // 仅提取 path 部分，去掉 query 与 hash
  const qIndex = urlOrPath.indexOf("?");
  const hIndex = urlOrPath.indexOf("#");
  let pathname = urlOrPath;
  if (qIndex !== -1 && hIndex !== -1) {
    pathname = urlOrPath.slice(0, Math.min(qIndex, hIndex));
  } else if (qIndex !== -1) {
    pathname = urlOrPath.slice(0, qIndex);
  } else if (hIndex !== -1) {
    pathname = urlOrPath.slice(0, hIndex);
  }
  // 规范化斜杠
  pathname = pathname.replace(/\/+/g, "/");
  if (!pathname.startsWith("/")) {
    pathname = `/${pathname}`;
  }
  return pathname;
}

export function matchPathPattern(pathname: string, pattern: string): boolean {
  const normPath = normalizePathname(pathname);
  const normPattern = normalizePathname(pattern);

  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2);
    const normPrefix = normalizePathname(prefix);
    return normPath === normPrefix || normPath.startsWith(`${normPrefix}/`);
  }
  if (pattern.endsWith("*")) {
    const prefix = pattern.slice(0, -1);
    return normPath.startsWith(prefix);
  }
  // 精确匹配（忽略末尾斜杠差异）
  const pathNoTrailing = normPath.length > 1 && normPath.endsWith("/") ? normPath.slice(0, -1) : normPath;
  const patternNoTrailing = normPattern.length > 1 && normPattern.endsWith("/") ? normPattern.slice(0, -1) : normPattern;
  return pathNoTrailing === patternNoTrailing;
}

export function isPathMatch(pathname: string, patterns: readonly string[]): boolean {
  if (!patterns || patterns.length === 0) return false;
  const normalized = normalizePathname(pathname);
  for (const pattern of patterns) {
    if (!pattern) continue;
    if (matchPathPattern(normalized, pattern)) {
      return true;
    }
  }
  return false;
}
