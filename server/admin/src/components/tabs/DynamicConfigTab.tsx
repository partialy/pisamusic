import { useMemo, useState } from "react";
import type { DynamicConfigItem } from "../../types/config";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";
import { Win } from "../../utils/win";

type Props = {
  items: DynamicConfigItem[];
  themeColor: string;
  loading: boolean;
  onCreate: () => void;
  onEdit: (item: DynamicConfigItem) => void;
  onDelete: (item: DynamicConfigItem) => void;
};

function typeLabel(type: DynamicConfigItem["type"]): string {
  switch (type) {
    case "html":
      return "HTML";
    case "number":
      return "数字";
    case "url":
      return "URL";
    default:
      return "字符串";
  }
}

export default function DynamicConfigTab({ items, themeColor, loading, onCreate, onEdit, onDelete }: Props) {
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => item.id.toLowerCase().includes(keyword));
  }, [items, query]);

  const handlePreviewHtml = (item: DynamicConfigItem) => {
    new Win({
      title: item.id,
      content: item.content,
      theme: "win",
      width: 800,
      height: 600,
    }).show();
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-sm">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={glassInputClasses}
            placeholder="按配置 ID 搜索"
          />
        </div>
        <button
          type="button"
          onClick={onCreate}
          style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
          className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
        >
          新增配置
        </button>
      </div>

      <div className={glassCardClasses}>
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">动态配置列表</h2>
            <p className="mt-1 text-sm text-slate-500">公开读取接口：`GET /api/config/get?id=xxx`</p>
          </div>
          <div className="text-sm font-semibold text-slate-500">共 {filteredItems.length} 项</div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/60 bg-white/40 px-4 py-12 text-center text-sm font-semibold text-slate-500">
            正在加载动态配置...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/60 bg-white/30 px-4 py-12 text-center text-sm text-slate-500">
            {items.length === 0 ? "暂无动态配置，点击右上角创建第一条配置。" : "没有匹配的配置项。"}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/60 bg-white/40 p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">{item.id}</span>
                      <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600">{typeLabel(item.type)}</span>
                    </div>
                    <div className="mt-4 line-clamp-2 overflow-hidden text-ellipsis whitespace-pre-wrap break-all rounded-2xl border border-white/60 bg-white/60 p-4 text-xs text-slate-700 shadow-inner">
                      {item.content || "(空字符串)"}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-3">
                    {item.type === "html" && (
                      <button
                        type="button"
                        onClick={() => handlePreviewHtml(item)}
                        className="rounded-2xl border border-white/60 bg-white/70 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-white"
                      >
                        预览
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="rounded-2xl border border-white/60 bg-white/70 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-white"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 shadow-sm transition-colors hover:bg-rose-100"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
