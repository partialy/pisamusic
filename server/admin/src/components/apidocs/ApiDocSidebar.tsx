import { useMemo, useState } from "react";
import { Input, Empty } from "antd";
import {
  CaretDownOutlined,
  CaretRightOutlined,
  FileTextOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  API_METHOD_META,
  type ApiDocEntry,
  type ApiDocGroup,
  type ApiDocSearchHit,
  type ApiHttpMethod,
} from "../../utils/apidocParser";

type ApiDocSidebarProps = {
  groups: ApiDocGroup[];
  hits: ApiDocSearchHit[];
  keyword: string;
  onKeywordChange: (value: string) => void;
  methodFilter: ApiHttpMethod | "ALL";
  onMethodFilterChange: (value: ApiHttpMethod | "ALL") => void;
  selectedEntryId: string;
  selectedDocPath: string;
  onSelectEntry: (entry: ApiDocEntry) => void;
  searchInputRef?: React.RefObject<any>;
};

const METHOD_FILTERS: Array<{ value: ApiHttpMethod | "ALL"; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "GET", label: "GET" },
  { value: "POST", label: "POST" },
  { value: "PUT", label: "PUT" },
  { value: "PATCH", label: "PATCH" },
  { value: "DELETE", label: "DELETE" },
];

export default function ApiDocSidebar({
  groups,
  hits,
  keyword,
  onKeywordChange,
  methodFilter,
  onMethodFilterChange,
  selectedEntryId,
  selectedDocPath,
  onSelectEntry,
  searchInputRef,
}: ApiDocSidebarProps) {
  const [collapsedKeys, setCollapsedKeys] = useState<Record<string, boolean>>({});
  const isFiltering = keyword.trim().length > 0 || methodFilter !== "ALL";

  const groupedHits = useMemo(() => {
    if (!isFiltering) return null;
    const map = new Map<string, { title: string; items: ApiDocSearchHit[] }>();
    for (const hit of hits) {
      const existing = map.get(hit.entry.groupKey);
      if (existing) {
        existing.items.push(hit);
      } else {
        map.set(hit.entry.groupKey, {
          title: hit.entry.groupTitle,
          items: [hit],
        });
      }
    }
    return Array.from(map.entries()).map(([key, val]) => ({ key, ...val }));
  }, [hits, isFiltering]);

  const toggleGroup = (key: string) => {
    setCollapsedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderEntryRow = (entry: ApiDocEntry, snippet?: string) => {
    const isActive =
      entry.id === selectedEntryId ||
      (!selectedEntryId && entry.docPath === selectedDocPath);
    const meta = API_METHOD_META[entry.method];

    return (
      <button
        key={entry.id}
        type="button"
        onClick={() => onSelectEntry(entry)}
        className={`w-full text-left px-2.5 py-2 rounded-xl transition-all border ${
          isActive
            ? "bg-sky-50/90 border-sky-200 shadow-2xs"
            : "bg-transparent border-transparent hover:bg-slate-100/80"
        }`}
      >
        <div className="flex items-start gap-2 min-w-0">
          <span
            className={`shrink-0 mt-0.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded border leading-none min-w-[44px] ${meta.badgeClass}`}
          >
            {meta.label}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className={`text-xs font-semibold truncate ${
                isActive ? "text-sky-900" : "text-slate-700"
              }`}
              title={entry.title}
            >
              {entry.title}
            </div>
            <div
              className="text-[11px] font-mono text-slate-400 truncate mt-0.5"
              title={entry.path}
            >
              {entry.path}
            </div>
            {snippet && (
              <div className="text-[11px] text-slate-500 bg-amber-50/80 border border-amber-100 rounded px-1.5 py-0.5 mt-1 line-clamp-2 break-all">
                {snippet}
              </div>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-slate-200/70 space-y-2.5 shrink-0">
        <Input
          ref={searchInputRef}
          allowClear
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="搜索接口名、路径、正文… (/)"
          size="middle"
        />

        <div className="flex flex-wrap gap-1">
          {METHOD_FILTERS.map((item) => {
            const active = methodFilter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onMethodFilterChange(item.value)}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border transition-colors ${
                  active
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white/70 text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
          <span>{isFiltering ? `匹配 ${hits.length} 项` : `共 ${hits.length} 项接口/文档`}</span>
          {!isFiltering && (
            <button
              type="button"
              onClick={() => {
                const hasExpanded = groups.some((g) => !collapsedKeys[g.key]);
                const next: Record<string, boolean> = {};
                if (hasExpanded) {
                  groups.forEach((g) => {
                    next[g.key] = true;
                  });
                }
                setCollapsedKeys(next);
              }}
              className="text-slate-500 hover:text-slate-800 transition-colors"
            >
              {groups.some((g) => !collapsedKeys[g.key]) ? "全部收起" : "全部展开"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
        {isFiltering ? (
          groupedHits && groupedHits.length > 0 ? (
            groupedHits.map((group) => (
              <div key={group.key} className="space-y-1">
                <div className="px-2 py-1 text-[11px] font-bold text-slate-500 flex items-center justify-between">
                  <span className="truncate">{group.title}</span>
                  <span className="text-slate-400 font-normal ml-1">{group.items.length}</span>
                </div>
                <div className="space-y-0.5">
                  {group.items.map((hit) => renderEntryRow(hit.entry, hit.snippet))}
                </div>
              </div>
            ))
          ) : (
            <div className="py-12">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="未找到匹配的接口或文档"
              />
            </div>
          )
        ) : (
          groups.map((group) => {
            const isCollapsed = Boolean(collapsedKeys[group.key]);
            return (
              <div key={group.key} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100/80 transition-colors"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {isCollapsed ? (
                      <CaretRightOutlined className="text-[10px] text-slate-400 shrink-0" />
                    ) : (
                      <CaretDownOutlined className="text-[10px] text-slate-400 shrink-0" />
                    )}
                    <FileTextOutlined className="text-slate-400 shrink-0 text-[11px]" />
                    <span className="truncate">{group.title}</span>
                  </span>
                  <span className="text-[11px] font-normal text-slate-400 shrink-0 ml-1.5">
                    {group.entries.length}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="pl-2 space-y-0.5">
                    {group.entries.map((entry) => renderEntryRow(entry))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
