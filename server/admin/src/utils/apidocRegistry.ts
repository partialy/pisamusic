const rawModules = import.meta.glob("../../../apidoc/**/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function normalizeDocKey(rawPath: string): string {
  const normalized = rawPath.replace(/\\/g, "/");
  const marker = "/apidoc/";
  const idx = normalized.lastIndexOf(marker);
  if (idx >= 0) {
    return normalized.slice(idx + marker.length);
  }
  return normalized.replace(/^\.?\//, "");
}

/**
 * 全部接口文档原文映射表，key 为相对 `server/apidoc/` 的规范路径（例如 `"admin/listUsers.md"`）。
 */
export const APIDOC_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(rawModules)
    .map(([rawPath, content]) => [normalizeDocKey(rawPath), content] as const)
    .sort(([a], [b]) => a.localeCompare(b)),
);
