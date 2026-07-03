import { useMemo, useState } from "react";
import { decrypt } from "../../api/crypto";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";
import { DEFAULT_PLAINTEXT_PATHS } from "../../types/config";

type Props = {
  paths: string[];
  themeColor: string;
  saving: boolean;
  dirty: boolean;
  onChange: (paths: string[]) => void;
  onSave: () => void;
  onResetToDefault: () => void;
  onReloadFromServer: () => void;
};

const PATH_REGEX = /^\/[A-Za-z0-9._\-/*]*$/;
const FULL_KEY_REGEX = /^[0-9a-fA-F]{128}$/;

function validatePath(input: string): string | null {
  const t = input.trim();
  if (!t) return "路径不能为空";
  if (t.length > 256) return "路径过长";
  if (!t.startsWith("/")) return "路径必须以 / 开头";
  if (!PATH_REGEX.test(t)) return "仅允许字母数字 . _ - / *";
  const starIdx = t.indexOf("*");
  if (starIdx !== -1 && starIdx !== t.length - 1) return "* 只能出现在末尾";
  return null;
}

function extractEncData(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "string") return parsed.trim();
    if (parsed && typeof parsed === "object") {
      const encData = (parsed as { encData?: unknown }).encData;
      if (typeof encData === "string") return encData.trim();
      throw new Error("未找到 encData 字段");
    }
  } catch (e) {
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      throw e;
    }
  }
  return trimmed;
}

function formatPlainText(plain: string): string {
  try {
    return JSON.stringify(JSON.parse(plain) as unknown, null, 2);
  } catch {
    return plain;
  }
}

export default function EncryptionTab({
  paths,
  themeColor,
  saving,
  dirty,
  onChange,
  onSave,
  onResetToDefault,
  onReloadFromServer,
}: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [decryptKey, setDecryptKey] = useState("");
  const [cipherInput, setCipherInput] = useState("");
  const [decryptResult, setDecryptResult] = useState("");
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  const stats = useMemo(() => {
    let exact = 0;
    let wildcard = 0;
    for (const p of paths) {
      if (p.endsWith("*")) wildcard += 1;
      else exact += 1;
    }
    return { exact, wildcard, total: paths.length };
  }, [paths]);

  const handleAdd = () => {
    const t = draft.trim();
    const err = validatePath(t);
    if (err) {
      setError(err);
      return;
    }
    if (paths.includes(t)) {
      setError("该路径已存在");
      return;
    }
    onChange([...paths, t]);
    setDraft("");
    setError(null);
  };

  const handleRemove = (idx: number) => {
    const next = paths.filter((_, i) => i !== idx);
    onChange(next);
  };

  const handleDecrypt = async () => {
    const fullKey = decryptKey.trim();
    if (!FULL_KEY_REGEX.test(fullKey)) {
      setDecryptError("x-pm-random 必须是 128 位 hex 字符串");
      setDecryptResult("");
      return;
    }

    let encData = "";
    try {
      encData = extractEncData(cipherInput);
    } catch {
      setDecryptError("密文格式不正确，请输入 encData 或完整的加密 JSON");
      setDecryptResult("");
      return;
    }
    if (!encData) {
      setDecryptError("密文不能为空");
      setDecryptResult("");
      return;
    }

    setDecrypting(true);
    setDecryptError(null);
    try {
      const plain = await decrypt(fullKey, encData);
      setDecryptResult(formatPlainText(plain));
    } catch {
      setDecryptResult("");
      setDecryptError("解密失败，请检查密文和 x-pm-random 是否匹配");
    } finally {
      setDecrypting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className={glassCardClasses}>
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 items-center">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center mr-4 shadow-lg shadow-orange-500/30 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">端到端加密 - 明文白名单</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                白名单内的路径不要求 <code className="px-1 py-0.5 bg-white/60 rounded text-[11px] font-mono">x-pm-random</code> 头，响应也不会被加密。
                老版本客户端只能访问白名单接口；其它接口缺少加密头会直接返回 401。
                通配符 <code className="px-1 py-0.5 bg-white/60 rounded text-[11px] font-mono">/*</code> 仅允许出现在路径末尾。
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-row items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
            <span className="text-[11px] uppercase tracking-widest font-bold text-slate-500">条数</span>
            <span className="text-2xl font-extrabold text-slate-800 leading-none">{stats.total}</span>
            <span className="text-[10px] text-slate-500 font-mono">{stats.exact} 精确 · {stats.wildcard} 通配</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            value={draft}
            placeholder="例如 /api/health 或 /api/admin/*"
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            className={glassInputClasses + " font-mono text-[13px] flex-1"}
          />
          <button
            type="button"
            onClick={handleAdd}
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            className="text-white px-5 py-3 rounded-2xl text-sm font-bold transition-all hover:-translate-y-0.5 hover:opacity-90 shrink-0"
          >
            添加
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-600 font-semibold mb-4 -mt-3 ml-1">{error}</p>
        )}

        {paths.length === 0 ? (
          <div className="text-center py-12 bg-white/40 rounded-2xl border border-white/60 shadow-inner">
            <p className="text-slate-500 font-bold">尚未配置任何明文路径，所有接口都会要求加密头。</p>
            <button
              type="button"
              onClick={onResetToDefault}
              className="mt-4 text-sm font-bold text-slate-700 underline-offset-4 hover:underline"
            >
              使用默认推荐列表
            </button>
          </div>
        ) : (
          <ul className="space-y-2">
            {paths.map((p, idx) => {
              const wildcard = p.endsWith("*");
              return (
                <li
                  key={p}
                  className="flex items-center justify-between gap-3 py-2.5 px-4 bg-white/50 hover:bg-white/80 rounded-2xl border border-white/60 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-[10px] text-slate-400 font-mono w-6 shrink-0">{String(idx + 1).padStart(2, "0")}</span>
                    {wildcard ? (
                      <span className="text-[10px] bg-sky-100/60 border border-sky-200 text-sky-600 px-2 py-0.5 rounded-md font-bold shrink-0">通配</span>
                    ) : (
                      <span className="text-[10px] bg-slate-100/60 border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-bold shrink-0">精确</span>
                    )}
                    <code className="font-mono text-[13px] text-slate-800 truncate break-all">{p}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="text-red-500 hover:text-red-700 text-xs font-bold lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    移除
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className={glassCardClasses}>
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {dirty ? (
              <span className="text-amber-700 font-bold">有未保存的修改</span>
            ) : (
              <span>当前与服务器一致</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onReloadFromServer}
              className="px-5 py-2.5 rounded-2xl text-sm font-bold border border-white/60 bg-white/60 text-slate-700 hover:bg-white shadow-sm transition-all"
            >
              拉取服务端最新
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("确认要重置为默认推荐白名单吗？仅修改本地草稿，需要点击保存才会生效。")) {
                  onResetToDefault();
                }
              }}
              className="px-5 py-2.5 rounded-2xl text-sm font-bold border border-white/60 bg-white/60 text-slate-700 hover:bg-white shadow-sm transition-all"
            >
              重置为默认
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={!dirty || saving}
              style={
                dirty && !saving
                  ? { backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }
                  : {}
              }
              className={`px-6 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                dirty && !saving
                  ? "text-white hover:-translate-y-0.5 hover:opacity-90"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              {saving ? "保存中…" : "保存白名单"}
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-4 leading-relaxed">
          提示：保存后立即热更新生效，不需要重启服务；同时会写入 <code className="font-mono">data/app-config.json</code> 的 <code className="font-mono">encryption.plaintextPaths</code> 字段。
          推荐默认值：<span className="font-mono">{DEFAULT_PLAINTEXT_PATHS.length}</span> 条。
        </p>
      </div>

      <div className={glassCardClasses}>
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 items-center">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-700 to-slate-950 text-white flex items-center justify-center mr-4 shadow-lg shadow-slate-900/20 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">加密响应解密工具</h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                输入接口响应里的 <code className="px-1 py-0.5 bg-white/60 rounded text-[11px] font-mono">encData</code> 和响应头
                <code className="px-1 py-0.5 bg-white/60 rounded text-[11px] font-mono">x-pm-random</code>，在浏览器本地解出明文，不会提交到服务端。
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold text-emerald-700">
            本地解密
          </span>
        </div>

        <div className="grid gap-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-500">x-pm-random</span>
            <input
              type="text"
              value={decryptKey}
              placeholder="128 位 hex 字符串"
              onChange={(e) => {
                setDecryptKey(e.target.value);
                if (decryptError) setDecryptError(null);
              }}
              className={glassInputClasses + " font-mono text-[13px]"}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-500">密文 / 加密 JSON</span>
            <textarea
              value={cipherInput}
              placeholder='可粘贴 encData，或完整 {"isEnc":true,"encData":"..."}'
              onChange={(e) => {
                setCipherInput(e.target.value);
                if (decryptError) setDecryptError(null);
              }}
              className={glassInputClasses + " min-h-36 resize-y font-mono text-[13px] leading-relaxed"}
            />
          </label>

          {decryptError && (
            <p className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-xs font-bold text-red-600">
              {decryptError}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleDecrypt()}
              disabled={decrypting}
              style={!decrypting ? { backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` } : undefined}
              className={`px-6 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                decrypting
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                  : "text-white hover:-translate-y-0.5 hover:opacity-90"
              }`}
            >
              {decrypting ? "解密中…" : "解密"}
            </button>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-500">明文结果</span>
            <pre className="min-h-36 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-white/60 bg-slate-950 px-4 py-4 font-mono text-[12px] leading-relaxed text-emerald-300 shadow-inner">
              {decryptResult || "解密成功后会显示明文；JSON 明文会自动格式化。"}
            </pre>
          </label>
        </div>
      </div>
    </div>
  );
}
