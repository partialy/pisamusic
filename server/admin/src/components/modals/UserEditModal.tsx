import { useState } from "react";
import type { AdminUserListItem, AdminUserUpdatePayload } from "../../types/config";
import { glassInputClasses } from "../../constants/theme";

type Props = {
  user: AdminUserListItem;
  themeColor: string;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: AdminUserUpdatePayload) => void;
};

export default function UserEditModal({ user, themeColor, saving, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<AdminUserUpdatePayload>({
    username: user.username,
    email: user.email,
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative mx-auto my-4 flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl backdrop-blur-2xl animate-fade-in-up sm:my-8 sm:rounded-[2rem]"
        style={{ animationDuration: "0.2s" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/50 bg-white/30 px-4 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold text-slate-800 sm:text-xl">编辑用户资料</h3>
            <p className="mt-1 truncate font-mono text-sm text-slate-500">{user.id}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/50 p-2 text-slate-500 shadow-sm hover:bg-white" aria-label="关闭">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-4 sm:p-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 ml-1 block text-sm font-semibold text-slate-700">用户名</span>
              <input
                type="text"
                value={draft.username}
                onChange={(event) => setDraft((prev) => ({ ...prev, username: event.target.value }))}
                className={glassInputClasses}
              />
            </label>
            <label className="block">
              <span className="mb-2 ml-1 block text-sm font-semibold text-slate-700">邮箱</span>
              <input
                type="email"
                value={draft.email}
                onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
                className={glassInputClasses}
              />
            </label>
          </div>

          <div>
            <span className="mb-3 ml-1 block text-sm font-semibold text-slate-700">头像</span>
            <div className="flex items-center gap-4 rounded-2xl border border-white/60 bg-white/50 p-4">
              <img src={user.avatarUrl || user.avatar} alt={user.username} className="h-14 w-14 rounded-2xl object-cover shadow-sm" />
              <div className="min-w-0">
                <div className="font-bold text-slate-800">当前头像</div>
                <div className="mt-1 truncate font-mono text-xs text-slate-500">{user.avatarKey === "default" ? "default" : "custom"}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-white/50 bg-white/30 p-4 sm:p-6">
          <button type="button" onClick={onClose} className="rounded-xl border border-white/60 bg-white/60 px-6 py-3 font-bold text-slate-700 shadow-sm hover:bg-white">
            取消
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draft)}
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            className="rounded-xl px-8 py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
