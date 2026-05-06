import { useState, type FormEvent } from "react";
import { glassInputClasses } from "../../constants/theme";
import { changePassword } from "../../api/client";

type Props = {
  themeColor: string;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ChangePasswordModal({ themeColor, onClose, onSuccess }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!currentPassword || !newPassword) {
      setError("请填写当前密码和新密码");
      return;
    }
    if (newPassword.length < 6) {
      setError("新密码至少 6 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "修改失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative bg-white/80 backdrop-blur-2xl rounded-3xl sm:rounded-[2rem] border border-white/60 shadow-2xl w-full max-w-md flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] overflow-hidden animate-fade-in-up"
        style={{ animationDuration: "0.2s" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-8 sm:py-5 border-b border-white/50 bg-white/30">
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center min-w-0">
            <svg className="w-6 h-6 mr-2" style={{ color: themeColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
            修改密码
          </h3>
          <button type="button" onClick={onClose} className="p-2 bg-white/50 rounded-full hover:bg-white text-slate-500 transition-colors shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="overflow-y-auto p-4 sm:p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">当前密码</label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={glassInputClasses}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">新密码（至少 6 位）</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={glassInputClasses}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">确认新密码</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={glassInputClasses}
            />
          </div>
          {error && <p className="text-sm text-red-600 font-medium px-1">{error}</p>}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl text-slate-600 font-bold hover:bg-white/60 transition-colors shadow-sm border border-white/50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
              className="px-8 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
