import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchListeningLevelConfig,
  ListeningLevelVersionConflictError,
  saveListeningLevelConfig,
} from "../../api/listening";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";
import type { ListeningLevelConfig, ListeningLevelRule } from "../../types/listening";

type Props = {
  /** 当前后台主题色。 */
  themeColor: string;
};

type DraftRule = {
  level: number;
  minMinutes: string;
  maxMinutes: string | null;
};

type RuleValidationResult =
  | { rules: ListeningLevelRule[]; error: null }
  | { rules: null; error: string };

function rulesToDraft(rules: ListeningLevelRule[]): DraftRule[] {
  return rules.map((rule) => ({
    level: rule.level,
    minMinutes: String(rule.minMinutes),
    maxMinutes: rule.maxMinutes === null ? null : String(rule.maxMinutes),
  }));
}

function reindexRules(rules: DraftRule[]): DraftRule[] {
  return rules.map((rule, index) => ({ ...rule, level: index + 1 }));
}

function readMinute(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const minute = Number(value);
  return Number.isSafeInteger(minute) && minute >= 0 ? minute : null;
}

function validateRules(rules: DraftRule[]): RuleValidationResult {
  if (rules.length === 0) return { rules: null, error: "至少需要保留一个等级。" };
  const parsedRules: ListeningLevelRule[] = [];
  for (let index = 0; index < rules.length; index += 1) {
    const rule = rules[index];
    const minMinutes = readMinute(rule.minMinutes);
    const maxMinutes = rule.maxMinutes === null ? null : readMinute(rule.maxMinutes);
    const previous = parsedRules[index - 1];
    if (minMinutes === null) {
      return { rules: null, error: `Lv ${rule.level} 的起始分钟必须是非负整数。` };
    }
    if (index === 0 && minMinutes !== 0) return { rules: null, error: "Lv 1 必须从 0 分钟开始。" };
    if (rule.maxMinutes !== null && (maxMinutes === null || maxMinutes < minMinutes)) {
      return { rules: null, error: `Lv ${rule.level} 的结束分钟必须是不小于起始分钟的整数。` };
    }
    if (index < rules.length - 1 && maxMinutes === null) return { rules: null, error: "只有最后一级可以设置为无上限。" };
    if (index > 0 && (previous.maxMinutes === null || minMinutes !== previous.maxMinutes + 1)) {
      return { rules: null, error: "等级区间必须连续且不能重叠。" };
    }
    parsedRules.push({ level: rule.level, minMinutes, maxMinutes });
  }
  return parsedRules[parsedRules.length - 1].maxMinutes === null
    ? { rules: parsedRules, error: null }
    : { rules: null, error: "最后一级必须设置为无上限。" };
}

/** 管理后台的听歌等级连续区间编辑器。 */
export default function ListeningLevelsTab({ themeColor }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ListeningLevelConfig | null>(null);
  const [draftRules, setDraftRules] = useState<DraftRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeRequestRef = useRef<AbortController | null>(null);

  const loadConfig = useCallback(async () => {
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await fetchListeningLevelConfig(controller.signal);
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setConfig(next);
      setDraftRules(rulesToDraft(next.rules));
    } catch (reason) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setError(reason instanceof Error ? reason.message : "听歌等级配置加载失败");
    } finally {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      if (activeRequestRef.current === controller) activeRequestRef.current = null;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    return () => {
      activeRequestRef.current?.abort();
      activeRequestRef.current = null;
      requestIdRef.current += 1;
    };
  }, [loadConfig]);

  const validation = useMemo(() => validateRules(draftRules), [draftRules]);
  const validationError = validation.error;
  const hasChanges = useMemo(
    () => config !== null && JSON.stringify(config.rules) !== JSON.stringify(validation.rules ?? draftRules),
    [config, draftRules, validation.rules],
  );

  const updateRule = (index: number, patch: Partial<DraftRule>) => {
    setDraftRules((current) => current.map((rule, ruleIndex) => (ruleIndex === index ? { ...rule, ...patch } : rule)));
  };

  const updateMinute = (index: number, field: "minMinutes" | "maxMinutes", value: string) => {
    updateRule(index, { [field]: value });
  };

  const toggleUnlimited = (index: number, unlimited: boolean) => {
    const rule = draftRules[index];
    if (!rule) return;
    updateRule(index, { maxMinutes: unlimited ? null : rule.minMinutes });
  };

  const addRule = () => {
    const last = draftRules[draftRules.length - 1];
    if (!last) {
      setDraftRules([{ level: 1, minMinutes: "0", maxMinutes: null }]);
      return;
    }
    const minMinutes = readMinute(last.minMinutes);
    const maxMinutes = last.maxMinutes === null ? minMinutes : readMinute(last.maxMinutes);
    if (minMinutes === null || maxMinutes === null || maxMinutes < minMinutes) {
      setError("请先填写当前最高等级有效的起始和结束分钟，再添加等级。");
      return;
    }
    setDraftRules((current) => [
      ...current.slice(0, -1),
      { ...last, maxMinutes: String(maxMinutes) },
      { level: last.level + 1, minMinutes: String(maxMinutes + 1), maxMinutes: null },
    ]);
  };

  const removeRule = (index: number) => {
    setDraftRules((current) => {
      if (current.length <= 1) return current;
      const next = reindexRules(current.filter((_, ruleIndex) => ruleIndex !== index));
      return next.map((rule, ruleIndex) => (ruleIndex === next.length - 1 ? { ...rule, maxMinutes: null } : rule));
    });
  };

  const saveRules = async () => {
    if (!config) return;
    if (validation.error || !validation.rules) {
      setError(validation.error ?? "等级区间无效");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveListeningLevelConfig(config.version, validation.rules);
      setConfig(saved);
      setDraftRules(rulesToDraft(saved.rules));
    } catch (reason) {
      if (reason instanceof ListeningLevelVersionConflictError) {
        setError("配置已被其他管理员更新，请刷新后重新编辑再保存。");
      } else {
        setError(reason instanceof Error ? reason.message : "听歌等级配置保存失败");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className={glassCardClasses}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">听歌等级</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">按照用户全设备去重后的累计听歌分钟动态计算等级。区间必须连续且不能重叠，最后一级可设为无上限。</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <button type="button" onClick={() => void loadConfig()} disabled={loading || saving} className="rounded-2xl border border-white/60 bg-white/70 px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
              刷新配置
            </button>
            <button type="button" onClick={() => void saveRules()} disabled={loading || saving || !hasChanges} className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}>
              {saving ? "保存中..." : "保存等级"}
            </button>
          </div>
        </div>
        {config && <p className="mt-4 text-xs font-semibold text-slate-400">当前配置版本：v{config.version}</p>}
      </div>

      {loading ? (
        <div className={`${glassCardClasses} py-14 text-center text-sm font-semibold text-slate-500`}>正在加载听歌等级配置...</div>
      ) : error && !config ? (
        <div className={`${glassCardClasses} py-14 text-center`}>
          <p className="text-sm font-semibold text-rose-600">{error}</p>
          <button type="button" onClick={() => void loadConfig()} className="mt-4 rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: themeColor }}>重试</button>
        </div>
      ) : (
        <div className={glassCardClasses}>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800">等级区间</h3>
              <p className="mt-1 text-sm text-slate-500">分钟区间为闭区间；保存前会检查从 Lv 1 起的连续性。</p>
            </div>
            <button type="button" onClick={addRule} disabled={saving || draftRules.length >= 100} className="rounded-2xl border border-white/60 bg-white/70 px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50" title={draftRules.length >= 100 ? "最多只能配置 100 个等级" : undefined}>
              {draftRules.length >= 100 ? "最多 100 级" : "添加等级"}
            </button>
          </div>

          {error && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div>}
          {validationError && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">{validationError}</div>}

          <div className="space-y-3">
            {draftRules.map((rule, index) => {
              const isLast = index === draftRules.length - 1;
              const unlimited = rule.maxMinutes === null;
              return (
                <div key={rule.level} className="grid grid-cols-1 gap-4 rounded-3xl border border-white/60 bg-white/45 p-4 shadow-sm md:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end md:p-5">
                  <div className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-extrabold text-white">Lv {rule.level}</div>
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold text-slate-500">起始分钟</span>
                    <input type="number" min="0" step="1" inputMode="numeric" value={rule.minMinutes} onChange={(event) => updateMinute(index, "minMinutes", event.target.value)} className={glassInputClasses} disabled={saving} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold text-slate-500">结束分钟</span>
                    <input type="number" min="0" step="1" inputMode="numeric" value={unlimited ? "" : (rule.maxMinutes ?? "")} placeholder={unlimited ? "无上限" : "请输入结束分钟"} onChange={(event) => updateMinute(index, "maxMinutes", event.target.value)} className={glassInputClasses} disabled={saving || unlimited} />
                  </label>
                  <div className="flex items-center justify-between gap-3 md:justify-end">
                    {isLast && (
                      <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm font-bold text-slate-600">
                        <input type="checkbox" checked={unlimited} onChange={(event) => toggleUnlimited(index, event.target.checked)} disabled={saving} className="h-4 w-4 rounded border-slate-300" />
                        无上限
                      </label>
                    )}
                    <button type="button" onClick={() => removeRule(index)} disabled={saving || draftRules.length <= 1} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50">
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
