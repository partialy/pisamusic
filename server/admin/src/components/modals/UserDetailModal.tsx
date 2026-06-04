import type { AdminUserDetail, AdminUserLibraryKind, AdminUserLibraryPage } from "../../types/config";
import { formatTimestamp } from "../../utils/date";

type Props = {
  user: AdminUserDetail;
  activeKind: AdminUserLibraryKind;
  libraryPage: AdminUserLibraryPage;
  libraryLoading: boolean;
  themeColor: string;
  onKindChange: (kind: AdminUserLibraryKind) => void;
  onPageChange: (offset: number) => void;
  onClose: () => void;
};

const TABS: Array<{ kind: AdminUserLibraryKind; label: string; tone: string; activeTone: string }> = [
  { kind: "favoriteSongs", label: "收藏歌曲", tone: "border-sky-100 bg-sky-50/80 text-sky-700", activeTone: "ring-sky-300" },
  { kind: "favoritePlaylists", label: "收藏歌单", tone: "border-emerald-100 bg-emerald-50/80 text-emerald-700", activeTone: "ring-emerald-300" },
  { kind: "userPlaylists", label: "自建歌单", tone: "border-amber-100 bg-amber-50/80 text-amber-700", activeTone: "ring-amber-300" },
];

function statValue(user: AdminUserDetail, kind: AdminUserLibraryKind): number {
  if (kind === "favoritePlaylists") return user.stats.favoritePlaylists;
  if (kind === "userPlaylists") return user.stats.userPlaylists;
  return user.stats.favoriteSongs;
}

function sourceText(source: string): string {
  if (source === "kg") return "酷狗";
  if (source === "wy") return "网易";
  if (source === "kw") return "酷我";
  if (source === "local") return "本地";
  return source || "-";
}

function activeTitle(kind: AdminUserLibraryKind): string {
  return TABS.find((tab) => tab.kind === kind)?.label ?? "收藏歌曲";
}

export default function UserDetailModal({
  user,
  activeKind,
  libraryPage,
  libraryLoading,
  themeColor,
  onKindChange,
  onPageChange,
  onClose,
}: Props) {
  const pageEnd = Math.min(libraryPage.total, libraryPage.offset + libraryPage.limit);
  const kindIsSong = activeKind === "favoriteSongs";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-3 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-md" onClick={onClose} aria-hidden />
      <div
        className="relative mx-auto my-4 flex w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-2xl backdrop-blur-2xl animate-fade-in-up sm:my-8 sm:max-h-[calc(100dvh-4rem)] sm:rounded-[2rem]"
        style={{ animationDuration: "0.2s" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/50 bg-white/30 px-4 py-4 sm:px-8 sm:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <img src={user.avatarUrl || user.avatar} alt={user.username} className="h-12 w-12 rounded-2xl border border-white/70 object-cover shadow-sm" />
            <div className="min-w-0">
              <h3 className="truncate text-lg font-extrabold text-slate-800 sm:text-xl">{user.username}</h3>
              <p className="mt-1 truncate text-sm text-slate-500">{user.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/50 p-2 text-slate-500 shadow-sm hover:bg-white" aria-label="关闭">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TABS.map((tab) => {
              const active = activeKind === tab.kind;
              return (
                <button
                  key={tab.kind}
                  type="button"
                  onClick={() => onKindChange(tab.kind)}
                  className={`rounded-2xl border px-5 py-4 text-left transition-all ${tab.tone} ${active ? `ring-2 ${tab.activeTone} shadow-sm` : "hover:bg-white/80"}`}
                >
                  <div className="text-2xl font-extrabold">{statValue(user, tab.kind)}</div>
                  <div className="mt-1 text-xs font-bold">{tab.label}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/60 bg-white/45 p-4 text-sm shadow-inner md:grid-cols-2">
            <div className="min-w-0">
              <span className="font-bold text-slate-500">用户 ID：</span>
              <span className="font-mono text-slate-700">{user.id}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500">同步版本：</span>
              <span className="font-mono text-slate-700">{user.syncVersion}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500">创建时间：</span>
              <span className="text-slate-700">{formatTimestamp(user.createdAt)}</span>
            </div>
            <div>
              <span className="font-bold text-slate-500">最后登录：</span>
              <span className="text-slate-700">{formatTimestamp(user.lastLoginAt)}</span>
            </div>
          </div>

          <section className="rounded-2xl border border-white/60 bg-white/45 p-4 shadow-inner">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="text-base font-extrabold text-slate-800">{activeTitle(activeKind)}</h4>
              <span className="rounded-lg bg-white/70 px-2.5 py-1 text-xs font-bold text-slate-500">
                {libraryPage.total === 0 ? "0" : `${libraryPage.offset + 1}-${pageEnd}`} / {libraryPage.total}
              </span>
            </div>

            {libraryLoading ? (
              <div className="rounded-xl bg-white/50 py-10 text-center text-sm font-semibold text-slate-500">正在加载...</div>
            ) : libraryPage.items.length === 0 ? (
              <div className="rounded-xl bg-white/50 py-10 text-center text-sm font-semibold text-slate-500">暂无数据</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs font-bold uppercase text-slate-500">
                      <th className="border-b border-slate-200/70 px-3 py-2">名称</th>
                      <th className="border-b border-slate-200/70 px-3 py-2">来源</th>
                      <th className="border-b border-slate-200/70 px-3 py-2">ID / Key</th>
                      <th className="border-b border-slate-200/70 px-3 py-2">{kindIsSong ? "歌手 / 专辑" : "描述 / 标签"}</th>
                      <th className="border-b border-slate-200/70 px-3 py-2">更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {libraryPage.items.map((item) => (
                      <tr key={item.itemKey} className="hover:bg-white/50">
                        <td className="max-w-[14rem] border-b border-slate-100/80 px-3 py-3">
                          <div className="truncate font-bold text-slate-800" title={item.name}>
                            {item.name || "-"}
                          </div>
                        </td>
                        <td className="border-b border-slate-100/80 px-3 py-3 text-slate-600">{sourceText(item.source)}</td>
                        <td className="max-w-[13rem] border-b border-slate-100/80 px-3 py-3">
                          <div className="truncate font-mono text-xs text-slate-500" title={item.itemKey}>
                            {item.itemId || item.itemKey}
                          </div>
                        </td>
                        <td className="max-w-[16rem] border-b border-slate-100/80 px-3 py-3">
                          <div className="truncate text-slate-600" title={item.subtitle}>
                            {item.subtitle || "-"}
                          </div>
                        </td>
                        <td className="border-b border-slate-100/80 px-3 py-3 text-xs text-slate-500">{formatTimestamp(item.serverUpdatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={libraryLoading || libraryPage.offset <= 0}
                onClick={() => onPageChange(Math.max(0, libraryPage.offset - libraryPage.limit))}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={libraryLoading || pageEnd >= libraryPage.total}
                onClick={() => onPageChange(libraryPage.offset + libraryPage.limit)}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </section>
        </div>

        <div className="flex justify-end border-t border-white/50 bg-white/30 p-4 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            style={{ backgroundColor: themeColor, boxShadow: `0 10px 15px -3px ${themeColor}40` }}
            className="rounded-xl px-8 py-3 font-bold text-white hover:opacity-90"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
