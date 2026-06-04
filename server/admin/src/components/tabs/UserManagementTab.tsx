import { useEffect, useState } from "react";
import type { AdminUserFilter, AdminUserListItem } from "../../types/config";
import { glassCardClasses, glassInputClasses } from "../../constants/theme";
import { formatTimestamp } from "../../utils/date";

type Props = {
  users: AdminUserListItem[];
  total: number;
  offset: number;
  limit: number;
  filter: AdminUserFilter;
  loading: boolean;
  deletingId: string | null;
  themeColor: string;
  onFilterChange: (filter: AdminUserFilter) => void;
  onPageChange: (offset: number) => void;
  onRefresh: () => void;
  onView: (user: AdminUserListItem) => void;
  onEdit: (user: AdminUserListItem) => void;
  onDelete: (user: AdminUserListItem) => void;
};

function statBadge(label: string, value: number, tone: string) {
  return (
    <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold ${tone}`}>
      {label} {value}
    </span>
  );
}

function userAvatar(user: AdminUserListItem) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-white/70 shadow-sm">
      {user.avatarUrl || user.avatar ? (
        <img src={user.avatarUrl || user.avatar} alt={user.username} className="h-full w-full object-cover" />
      ) : (
        <span className="text-sm font-extrabold text-slate-500">{user.username.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}

export default function UserManagementTab({
  users,
  total,
  offset,
  limit,
  filter,
  loading,
  deletingId,
  themeColor,
  onFilterChange,
  onPageChange,
  onRefresh,
  onView,
  onEdit,
  onDelete,
}: Props) {
  const [keyword, setKeyword] = useState(filter.keyword ?? "");
  const pageEnd = Math.min(total, offset + limit);

  useEffect(() => {
    setKeyword(filter.keyword ?? "");
  }, [filter.keyword]);

  const applyFilter = () => onFilterChange({ keyword: keyword.trim() || undefined });
  const resetFilter = () => {
    setKeyword("");
    onFilterChange({});
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className={glassCardClasses}>
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">用户管理</h2>
            <p className="mt-1 text-sm text-slate-500">查看账号资料、同步收藏统计和用户歌单数据。</p>
          </div>
          <button type="button" onClick={onRefresh} className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: themeColor }}>
            刷新
          </button>
        </div>

        <form
          className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilter();
          }}
        >
          <input
            className={glassInputClasses}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜索用户 ID、邮箱或用户名"
          />
          <button type="submit" className="rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: themeColor }}>
            查询
          </button>
          <button type="button" onClick={resetFilter} className="rounded-2xl border border-white/60 bg-white/60 px-5 py-3 text-sm font-bold text-slate-700 shadow-sm hover:bg-white">
            重置
          </button>
        </form>
      </div>

      <div className={glassCardClasses}>
        {loading ? (
          <div className="py-10 text-center text-sm font-semibold text-slate-500">正在加载用户...</div>
        ) : users.length === 0 ? (
          <div className="py-10 text-center text-sm font-semibold text-slate-500">暂无用户记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase text-slate-500">
                  <th className="border-b border-slate-200/70 px-4 py-3">用户</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">邮箱</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">同步版本</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">收藏统计</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">创建时间</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">更新时间</th>
                  <th className="border-b border-slate-200/70 px-4 py-3">最后登录</th>
                  <th className="sticky right-0 z-10 border-b border-slate-200/70 bg-white/80 px-4 py-3 text-right backdrop-blur">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="group transition-colors hover:bg-white/50">
                    <td className="border-b border-slate-100/80 px-4 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {userAvatar(user)}
                        <div className="min-w-0">
                          <div className="truncate font-bold text-slate-800">{user.username}</div>
                          <div className="mt-1 truncate font-mono text-xs text-slate-400">{user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-slate-100/80 px-4 py-4 font-semibold text-slate-600">{user.email}</td>
                    <td className="border-b border-slate-100/80 px-4 py-4 font-mono text-slate-600">{user.syncVersion}</td>
                    <td className="border-b border-slate-100/80 px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        {statBadge("歌曲", user.stats.favoriteSongs, "bg-sky-100 text-sky-700")}
                        {statBadge("收藏歌单", user.stats.favoritePlaylists, "bg-emerald-100 text-emerald-700")}
                        {statBadge("自建歌单", user.stats.userPlaylists, "bg-amber-100 text-amber-700")}
                      </div>
                    </td>
                    <td className="border-b border-slate-100/80 px-4 py-4 text-xs text-slate-500">{formatTimestamp(user.createdAt)}</td>
                    <td className="border-b border-slate-100/80 px-4 py-4 text-xs text-slate-500">{formatTimestamp(user.updatedAt)}</td>
                    <td className="border-b border-slate-100/80 px-4 py-4 text-xs text-slate-500">{formatTimestamp(user.lastLoginAt)}</td>
                    <td className="sticky right-0 z-10 border-b border-slate-100/80 bg-white/80 px-4 py-4 backdrop-blur">
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <button type="button" onClick={() => onView(user)} className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-white">
                          详情
                        </button>
                        <button type="button" onClick={() => onEdit(user)} className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 shadow-sm hover:bg-sky-100">
                          编辑
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === user.id}
                          onClick={() => onDelete(user)}
                          className="rounded-xl bg-red-500 px-3 py-2 text-xs font-bold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === user.id ? "删除中..." : "删除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/50 p-4 text-sm font-bold text-slate-600">
        <span>
          {total === 0 ? "0" : `${offset + 1}-${pageEnd}`} / {total}
        </span>
        <div className="flex gap-2">
          <button className="rounded-xl bg-white px-4 py-2 disabled:opacity-50" disabled={offset <= 0} onClick={() => onPageChange(Math.max(0, offset - limit))}>
            上一页
          </button>
          <button className="rounded-xl bg-white px-4 py-2 disabled:opacity-50" disabled={pageEnd >= total} onClick={() => onPageChange(offset + limit)}>
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
