import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Drawer, Empty, Tag, message } from "antd";
import {
  CopyOutlined,
  HomeOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { APIDOC_FILES } from "../utils/apidocRegistry";
import {
  API_METHOD_META,
  extractMarkdownToc,
  getApiDocCatalog,
  searchApiDocs,
  slugifyHeading,
  type ApiDocEntry,
  type ApiHttpMethod,
} from "../utils/apidocParser";
import ApiDocSidebar from "../components/apidocs/ApiDocSidebar";
import ApiDocMarkdown from "../components/apidocs/ApiDocMarkdown";

const DEFAULT_DOC = "common/overview.md";

export default function ApiDocsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const catalog = useMemo(() => getApiDocCatalog(), []);

  const rawDocParam = searchParams.get("doc") || DEFAULT_DOC;
  const currentDocPath = rawDocParam in APIDOC_FILES ? rawDocParam : "index.md";
  const currentHash = searchParams.get("section") || "";

  const [keyword, setKeyword] = useState("");
  const [methodFilter, setMethodFilter] = useState<ApiHttpMethod | "ALL">("ALL");
  const [selectedEntryId, setSelectedEntryId] = useState<string>(() => {
    return catalog.docPrimaryEntryMap.get(currentDocPath)?.id ?? currentDocPath;
  });
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const searchInputRef = useRef<any>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const hits = useMemo(
    () => searchApiDocs(catalog.entries, keyword, methodFilter),
    [catalog.entries, keyword, methodFilter],
  );

  const activeEntry = useMemo(() => {
    return (
      catalog.entries.find((e) => e.id === selectedEntryId) ??
      catalog.docPrimaryEntryMap.get(currentDocPath)
    );
  }, [catalog.entries, catalog.docPrimaryEntryMap, selectedEntryId, currentDocPath]);

  const markdownContent = APIDOC_FILES[currentDocPath] ?? "";
  const tocItems = useMemo(() => extractMarkdownToc(markdownContent), [markdownContent]);

  const scrollToSection = useCallback((sectionId: string) => {
    if (!sectionId) {
      contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const target =
      document.getElementById(sectionId) ??
      document.getElementById(slugifyHeading(sectionId));
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      scrollToSection(currentHash);
    }, 30);
    return () => window.clearTimeout(timer);
  }, [currentDocPath, currentHash, scrollToSection]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigateDoc = useCallback(
    (docPath: string, hash?: string, entry?: ApiDocEntry) => {
      if (entry) {
        setSelectedEntryId(entry.id);
      } else {
        setSelectedEntryId(catalog.docPrimaryEntryMap.get(docPath)?.id ?? docPath);
      }

      let resolvedHash = hash || "";
      if (!resolvedHash && entry?.anchorHint && entry.anchorHint.startsWith("/")) {
        const docToc = extractMarkdownToc(APIDOC_FILES[docPath] ?? "");
        const hintLower = entry.anchorHint.toLowerCase();
        const hintSlug = hintLower.split("/").pop() ?? "";
        const matchedHeading =
          docToc.find((item) => item.text.toLowerCase().includes(hintLower)) ??
          (hintSlug ? docToc.find((item) => item.text.toLowerCase().includes(hintSlug)) : undefined);
        if (matchedHeading) {
          resolvedHash = matchedHeading.id;
        }
      }

      const nextParams = new URLSearchParams();
      nextParams.set("doc", docPath);
      if (resolvedHash) {
        nextParams.set("section", resolvedHash);
      }
      setSearchParams(nextParams);
      setMobileDrawerOpen(false);
    },
    [catalog.docPrimaryEntryMap, setSearchParams],
  );

  const handleCopyPath = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      void message.success(`已复制：${text}`);
    } catch {
      void message.error("复制失败");
    }
  };

  const methodMeta = activeEntry ? API_METHOD_META[activeEntry.method] : API_METHOD_META.DOC;

  return (
    <div className="flex gap-4 h-[calc(100vh-8.5rem)] min-h-[540px] animate-fade-in-up">
      {/* Desktop Left Directory */}
      <aside className="hidden lg:flex flex-col w-80 shrink-0 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-sm overflow-hidden">
        <ApiDocSidebar
          groups={catalog.groups}
          hits={hits}
          keyword={keyword}
          onKeywordChange={setKeyword}
          methodFilter={methodFilter}
          onMethodFilterChange={setMethodFilter}
          selectedEntryId={selectedEntryId}
          selectedDocPath={currentDocPath}
          onSelectEntry={(entry) => navigateDoc(entry.docPath, undefined, entry)}
          searchInputRef={searchInputRef}
        />
      </aside>

      {/* Mobile Directory Drawer */}
      <Drawer
        title="接口文档目录"
        placement="left"
        width={320}
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        styles={{ body: { padding: 0 } }}
      >
        <ApiDocSidebar
          groups={catalog.groups}
          hits={hits}
          keyword={keyword}
          onKeywordChange={setKeyword}
          methodFilter={methodFilter}
          onMethodFilterChange={setMethodFilter}
          selectedEntryId={selectedEntryId}
          selectedDocPath={currentDocPath}
          onSelectEntry={(entry) => navigateDoc(entry.docPath, undefined, entry)}
        />
      </Drawer>

      {/* Main Content Area */}
      <section className="flex-1 min-w-0 flex flex-col rounded-2xl bg-white/85 backdrop-blur-md border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Top Metadata Bar */}
        <div className="px-5 py-3 border-b border-slate-200/70 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <Button
              type="default"
              size="small"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setMobileDrawerOpen(true)}
              className="lg:hidden"
            >
              目录
            </Button>

            <Tag color={methodMeta.tagColor} className="!m-0 font-bold">
              {methodMeta.label}
            </Tag>

            {activeEntry?.path && activeEntry.path.startsWith("/") ? (
              <button
                type="button"
                onClick={() => handleCopyPath(activeEntry.path)}
                title="点击复制接口路径"
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 hover:border-sky-300 text-xs font-mono text-slate-700 transition-colors"
              >
                <span className="truncate max-w-[360px]">{activeEntry.path}</span>
                <CopyOutlined className="text-slate-400 text-[11px]" />
              </button>
            ) : null}

            {activeEntry?.auth && (
              <Tag icon={<SafetyCertificateOutlined />} className="!m-0">
                {activeEntry.auth}
              </Tag>
            )}

            <span className="text-xs font-mono text-slate-400 truncate">
              server/apidoc/{currentDocPath}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {currentDocPath !== "index.md" && (
              <Button
                size="small"
                icon={<HomeOutlined />}
                onClick={() => navigateDoc("index.md")}
              >
                文档索引
              </Button>
            )}
          </div>
        </div>

        {/* Content & Right TOC */}
        <div className="flex-1 min-h-0 flex">
          <div
            ref={contentScrollRef}
            className="flex-1 min-w-0 overflow-y-auto px-6 py-5 lg:px-8"
          >
            {markdownContent ? (
              <div className="max-w-4xl">
                <ApiDocMarkdown
                  content={markdownContent}
                  currentDocPath={currentDocPath}
                  onNavigateDoc={(docPath, hash) => navigateDoc(docPath, hash)}
                />
              </div>
            ) : (
              <div className="py-20">
                <Empty description="未找到对应接口文档文件" />
              </div>
            )}
          </div>

          {/* Right TOC Outline */}
          {tocItems.length > 0 && (
            <aside className="hidden xl:flex flex-col w-60 shrink-0 border-l border-slate-200/70 bg-slate-50/40 p-4 overflow-y-auto">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                本页大纲
              </div>
              <nav className="space-y-1">
                {tocItems.map((item) => {
                  const active = currentHash === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigateDoc(currentDocPath, item.id)}
                      className={`w-full text-left text-xs py-1 px-2 rounded-md transition-colors truncate ${
                        item.level === 3 ? "pl-4" : ""
                      } ${
                        active
                          ? "bg-sky-50 text-sky-700 font-semibold"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      title={item.text}
                    >
                      {item.text}
                    </button>
                  );
                })}
              </nav>
            </aside>
          )}
        </div>
      </section>
    </div>
  );
}
