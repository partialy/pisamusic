import { APIDOC_FILES } from "./apidocRegistry";

export type ApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "WS" | "DOC";

export const API_METHOD_META: Record<
  ApiHttpMethod,
  { label: string; tagColor: string; badgeClass: string }
> = {
  GET: {
    label: "GET",
    tagColor: "blue",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
  },
  POST: {
    label: "POST",
    tagColor: "green",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  PUT: {
    label: "PUT",
    tagColor: "orange",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
  },
  PATCH: {
    label: "PATCH",
    tagColor: "gold",
    badgeClass: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  DELETE: {
    label: "DELETE",
    tagColor: "red",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200",
  },
  WS: {
    label: "WS",
    tagColor: "purple",
    badgeClass: "bg-violet-50 text-violet-700 border-violet-200",
  },
  DOC: {
    label: "DOC",
    tagColor: "default",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

export type ApiDocEntry = {
  /** 条目唯一 ID（同一文档对应多接口时带序号后缀） */
  id: string;
  /** 相对 apidoc/ 的文档路径，例如 "admin/listUsers.md" */
  docPath: string;
  /** 可选目标小节标题提示（用于多接口合并文档的定位） */
  anchorHint?: string;
  /** 条目展示名称 */
  title: string;
  /** HTTP 方法或文档类型 */
  method: ApiHttpMethod;
  /** 接口路径，如 "/api/admin/users" */
  path: string;
  /** 鉴权说明 */
  auth: string;
  /** 所属分组 Key */
  groupKey: string;
  /** 所属分组展示名称 */
  groupTitle: string;
};

export type ApiDocGroup = {
  key: string;
  title: string;
  entries: ApiDocEntry[];
};

export type ApiDocTocItem = {
  level: 2 | 3;
  text: string;
  id: string;
};

export type ApiDocSearchHit = {
  entry: ApiDocEntry;
  matchType: "title" | "path" | "content";
  snippet: string;
};

/**
 * 与 Markdown 渲染器共享的标题锚点生成规则，保证 TOC 点击与站内跳转精确命中。
 */
export function slugifyHeading(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[`*_~()[\]{}<>.,:;!?'"\\/|+=@#$%^&]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function stripInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~]+/g, "")
    .trim();
}

/**
 * 从 Markdown 文档中提取 H2 / H3 标题大纲，自动跳过围栏代码块内部内容。
 */
export function extractMarkdownToc(markdown: string): ApiDocTocItem[] {
  const lines = markdown.split(/\r?\n/);
  const items: ApiDocTocItem[] = [];
  const usedIds = new Map<string, number>();
  let inFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length as 2 | 3;
    const text = stripInlineMarkdown(match[2]);
    if (!text) continue;

    const baseId = slugifyHeading(text) || `section-${items.length + 1}`;
    const count = usedIds.get(baseId) ?? 0;
    usedIds.set(baseId, count + 1);
    const id = count === 0 ? baseId : `${baseId}-${count}`;

    items.push({ level, text, id });
  }
  return items;
}

/**
 * 解析文档内的相对链接（如 "./common/overview.md#xxx"、"../admin/listUsers.md"、"#section"）。
 * 返回 null 表示为外部链接或非站内文档链接。
 */
export function resolveDocLink(
  currentDocPath: string,
  rawHref: string,
): { docPath: string; hash?: string } | null {
  const href = rawHref.trim();
  if (!href || /^(https?:|mailto:|tel:)/i.test(href)) {
    return null;
  }

  const hashIdx = href.indexOf("#");
  const pathPart = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const hashPart = hashIdx >= 0 ? decodeURIComponent(href.slice(hashIdx + 1)) : undefined;

  if (!pathPart) {
    return { docPath: currentDocPath, hash: hashPart };
  }

  if (!pathPart.toLowerCase().endsWith(".md")) {
    return null;
  }

  const baseParts = currentDocPath.split("/").slice(0, -1);
  const relParts = pathPart.split("/");
  const stack = [...baseParts];

  for (const seg of relParts) {
    if (!seg || seg === ".") continue;
    if (seg === "..") {
      stack.pop();
    } else {
      stack.push(seg);
    }
  }

  const resolvedPath = stack.join("/");
  if (!(resolvedPath in APIDOC_FILES)) {
    return null;
  }

  return { docPath: resolvedPath, hash: hashPart };
}

function normalizeMethod(raw: string): ApiHttpMethod {
  const upper = raw.replace(/`/g, "").trim().toUpperCase();
  if (upper === "GET" || upper === "POST" || upper === "PUT" || upper === "PATCH" || upper === "DELETE" || upper === "WS") {
    return upper;
  }
  if (upper.includes("GET")) return "GET";
  if (upper.includes("POST")) return "POST";
  if (upper.includes("PUT")) return "PUT";
  if (upper.includes("PATCH")) return "PATCH";
  if (upper.includes("DELETE")) return "DELETE";
  return "DOC";
}

function splitTableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function extractFirstHeading(markdown: string, fallback: string): string {
  const match = /^#\s+(.+?)\s*$/m.exec(markdown);
  return match ? stripInlineMarkdown(match[1]) : fallback;
}

function parseLinkCell(cell: string): { label: string; target: string } | null {
  const match = /\[([^\]]+)\]\(([^)]+)\)/.exec(cell);
  if (!match) return null;
  return { label: match[1].trim(), target: match[2].trim() };
}

function normalizeIndexTarget(target: string): string {
  return target.replace(/^\.\//, "").split("#")[0];
}

export type ParsedApiDocCatalog = {
  groups: ApiDocGroup[];
  entries: ApiDocEntry[];
  docPrimaryEntryMap: Map<string, ApiDocEntry>;
};

let cachedCatalog: ParsedApiDocCatalog | null = null;

/**
 * 解析 `server/apidoc/index.md` 并结合全部文件构建接口文档导航目录树。
 */
export function getApiDocCatalog(): ParsedApiDocCatalog {
  if (cachedCatalog) return cachedCatalog;

  const indexContent = APIDOC_FILES["index.md"] ?? "";
  const lines = indexContent.split(/\r?\n/);

  const groups: ApiDocGroup[] = [];
  const entries: ApiDocEntry[] = [];
  const docPrimaryEntryMap = new Map<string, ApiDocEntry>();
  const indexedDocPaths = new Set<string>(["index.md"]);
  const idCounter = new Map<string, number>();

  const makeEntryId = (docPath: string) => {
    const count = idCounter.get(docPath) ?? 0;
    idCounter.set(docPath, count + 1);
    return count === 0 ? docPath : `${docPath}#${count}`;
  };

  const overviewEntries: ApiDocEntry[] = [
    {
      id: "index.md",
      docPath: "index.md",
      title: "接口文档总览索引",
      method: "DOC",
      path: "index.md",
      auth: "",
      groupKey: "overview",
      groupTitle: "总览与通用规范",
    },
  ];
  if (APIDOC_FILES["common/overview.md"]) {
    overviewEntries.push({
      id: "common/overview.md",
      docPath: "common/overview.md",
      title: "全局通信、加密与分页规范",
      method: "DOC",
      path: "common/overview.md",
      auth: "",
      groupKey: "overview",
      groupTitle: "总览与通用规范",
    });
    indexedDocPaths.add("common/overview.md");
  }

  let currentGroup: ApiDocGroup | null = null;
  let inQuickNav = false;
  let inTable = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const h2Match = /^##\s+(.+?)\s*$/.exec(line);
    if (h2Match) {
      inTable = false;
      const rawTitle = stripInlineMarkdown(h2Match[1]);
      if (rawTitle.includes("模块快速导航")) {
        inQuickNav = true;
        currentGroup = null;
        continue;
      }
      inQuickNav = false;
      currentGroup = {
        key: `group-${groups.length + 1}`,
        title: rawTitle,
        entries: [],
      };
      groups.push(currentGroup);
      continue;
    }

    const h3Match = /^###\s+(.+?)\s*$/.exec(line);
    if (h3Match && !inQuickNav) {
      inTable = false;
      const subTitle = stripInlineMarkdown(h3Match[1]);
      currentGroup = {
        key: `group-${groups.length + 1}`,
        title: subTitle,
        entries: [],
      };
      groups.push(currentGroup);
      continue;
    }

    if (inQuickNav) {
      const bulletMatch = /^\s*-\s+\[([^\]]+)\]\(([^)]+)\)/.exec(line);
      if (bulletMatch) {
        const title = bulletMatch[1].trim();
        const rawTarget = bulletMatch[2].trim();
        if (!rawTarget.startsWith("#") && rawTarget.endsWith(".md")) {
          const docPath = normalizeIndexTarget(rawTarget);
          if (docPath in APIDOC_FILES && !indexedDocPaths.has(docPath)) {
            indexedDocPaths.add(docPath);
            overviewEntries.push({
              id: makeEntryId(docPath),
              docPath,
              title,
              method: "DOC",
              path: docPath,
              auth: "",
              groupKey: "overview",
              groupTitle: "总览与通用规范",
            });
          }
        }
      }
      continue;
    }

    if (!currentGroup) continue;

    if (/^\s*\|/.test(line)) {
      const cells = splitTableCells(line);
      if (cells.length < 4) continue;
      if (cells[0] === "接口名称" || cells.every((c) => /^:?-+:?$/.test(c))) {
        inTable = true;
        continue;
      }
      if (!inTable) continue;

      const title = stripInlineMarkdown(cells[0]);
      const method = normalizeMethod(cells[1]);
      const apiPath = stripInlineMarkdown(cells[2]);
      const hasAuthCol = cells.length >= 5;
      const auth = hasAuthCol ? stripInlineMarkdown(cells[3]) : (currentGroup.title.startsWith("13.") ? "Admin Token" : "");
      const linkCell = hasAuthCol ? cells[4] : cells[3];
      const parsedLink = parseLinkCell(linkCell);
      if (!parsedLink) continue;

      const docPath = normalizeIndexTarget(parsedLink.target);
      if (!(docPath in APIDOC_FILES)) continue;

      indexedDocPaths.add(docPath);
      const entry: ApiDocEntry = {
        id: makeEntryId(docPath),
        docPath,
        anchorHint: apiPath,
        title,
        method,
        path: apiPath,
        auth,
        groupKey: currentGroup.key,
        groupTitle: currentGroup.title,
      };
      currentGroup.entries.push(entry);
    } else {
      inTable = false;
    }
  }

  const nonEmptyGroups: ApiDocGroup[] = [
    {
      key: "overview",
      title: "总览与通用规范",
      entries: overviewEntries,
    },
    ...groups.filter((g) => g.entries.length > 0),
  ];

  // 兜底收录未在 index.md 表格中出现的文件
  const unindexedEntries: ApiDocEntry[] = [];
  for (const docPath of Object.keys(APIDOC_FILES)) {
    if (indexedDocPaths.has(docPath)) continue;
    unindexedEntries.push({
      id: makeEntryId(docPath),
      docPath,
      title: extractFirstHeading(APIDOC_FILES[docPath], docPath),
      method: "DOC",
      path: docPath,
      auth: "",
      groupKey: "other",
      groupTitle: "其他专题文档",
    });
  }
  if (unindexedEntries.length > 0) {
    nonEmptyGroups.push({
      key: "other",
      title: "其他专题文档",
      entries: unindexedEntries,
    });
  }

  for (const group of nonEmptyGroups) {
    for (const entry of group.entries) {
      entries.push(entry);
      if (!docPrimaryEntryMap.has(entry.docPath)) {
        docPrimaryEntryMap.set(entry.docPath, entry);
      }
    }
  }

  cachedCatalog = {
    groups: nonEmptyGroups,
    entries,
    docPrimaryEntryMap,
  };
  return cachedCatalog;
}

function buildContentSnippet(content: string, queryLower: string): string {
  const idx = content.toLowerCase().indexOf(queryLower);
  if (idx < 0) return "";
  const start = Math.max(0, idx - 26);
  const end = Math.min(content.length, idx + queryLower.length + 54);
  const rawSlice = content.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${rawSlice}${end < content.length ? "…" : ""}`;
}

/**
 * 全文检索：按标题、接口路径、Method 与正文关键词过滤目录条目。
 */
export function searchApiDocs(
  entries: ApiDocEntry[],
  keyword: string,
  methodFilter: ApiHttpMethod | "ALL",
): ApiDocSearchHit[] {
  const q = keyword.trim().toLowerCase();
  const hits: ApiDocSearchHit[] = [];

  for (const entry of entries) {
    if (methodFilter !== "ALL" && entry.method !== methodFilter) {
      continue;
    }

    if (!q) {
      hits.push({ entry, matchType: "title", snippet: "" });
      continue;
    }

    const titleHit =
      entry.title.toLowerCase().includes(q) || entry.groupTitle.toLowerCase().includes(q);
    if (titleHit) {
      hits.push({ entry, matchType: "title", snippet: "" });
      continue;
    }

    const pathHit =
      entry.path.toLowerCase().includes(q) || entry.docPath.toLowerCase().includes(q);
    if (pathHit) {
      hits.push({ entry, matchType: "path", snippet: "" });
      continue;
    }

    const content = APIDOC_FILES[entry.docPath] ?? "";
    const snippet = buildContentSnippet(content, q);
    if (snippet) {
      hits.push({ entry, matchType: "content", snippet });
    }
  }

  return hits;
}
