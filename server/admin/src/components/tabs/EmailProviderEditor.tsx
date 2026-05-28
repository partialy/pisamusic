import { useState } from "react";
import type { EmailConfig, EmailProviderConfig } from "../../types/config";
import { glassInputClasses } from "../../constants/theme";

type Props = {
  email: EmailConfig;
  onChange: (next: EmailConfig) => void;
};

const PROVIDER_CODE_REGEX = /^[a-z][a-z0-9_-]*$/;

export function EmailProviderEditor({ email, onChange }: Props) {
  const [draftCode, setDraftCode] = useState("");
  const [draftName, setDraftName] = useState("");

  const updateProvider = (index: number, patch: Partial<EmailProviderConfig>) => {
    const providers = email.providers.map((item, i) => (i === index ? { ...item, ...patch } : item));
    const provider = providers.some((item) => item.code === email.provider) ? email.provider : providers[0]?.code ?? "";
    onChange({ ...email, provider, providers });
  };

  const addProvider = () => {
    const code = draftCode.trim();
    const name = draftName.trim();
    if (!PROVIDER_CODE_REGEX.test(code)) {
      alert("Provider code 必须以小写字母开头，且只能包含小写字母、数字、_、-");
      return;
    }
    if (!name) {
      alert("Provider 显示名称不能为空");
      return;
    }
    if (email.providers.some((item) => item.code === code)) {
      alert("Provider code 已存在");
      return;
    }
    onChange({ ...email, providers: [...email.providers, { code, name }] });
    setDraftCode("");
    setDraftName("");
  };

  const removeProvider = (code: string) => {
    if (code === email.provider) return;
    const providers = email.providers.filter((item) => item.code !== code);
    onChange({ ...email, providers });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-3 ml-1 block text-sm font-semibold text-slate-700">邮件服务商</label>
        <select value={email.provider} onChange={(e) => onChange({ ...email, provider: e.target.value })} className={glassInputClasses + " font-mono"}>
          {email.providers.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name} ({item.code})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        <p className="ml-1 text-sm font-semibold text-slate-700">服务商列表</p>
        {email.providers.map((item, index) => {
          const isSelected = item.code === email.provider;
          return (
            <div key={`${item.code}-${index}`} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                value={item.code}
                onChange={(e) => updateProvider(index, { code: e.target.value.trim() })}
                className={glassInputClasses + " font-mono text-[13px]"}
                placeholder="aliyun"
              />
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateProvider(index, { name: e.target.value })}
                className={glassInputClasses}
                placeholder="阿里云"
              />
              <button
                type="button"
                onClick={() => removeProvider(item.code)}
                disabled={isSelected}
                className={`rounded-2xl px-4 py-3 text-xs font-bold transition-colors ${
                  isSelected
                    ? "cursor-not-allowed border border-white/60 bg-white/40 text-slate-400"
                    : "border border-rose-200/70 bg-rose-50/80 text-rose-600 hover:bg-rose-100"
                }`}
              >
                删除
              </button>
            </div>
          );
        })}

        <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="text"
            value={draftCode}
            onChange={(e) => setDraftCode(e.target.value.trim())}
            className={glassInputClasses + " font-mono text-[13px]"}
            placeholder="provider_code"
          />
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            className={glassInputClasses}
            placeholder="显示名称"
          />
          <button
            type="button"
            onClick={addProvider}
            className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-white"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  );
}
