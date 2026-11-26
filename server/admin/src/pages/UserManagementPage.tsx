import { useCallback, useEffect, useState } from "react";
import type {
  AdminDirectMessagePage,
  AdminUserDetail,
  AdminUserDetailTab,
  AdminUserFilter,
  AdminUserLibraryKind,
  AdminUserLibraryPage,
  AdminUserLibraryStatus,
  AdminUserListItem,
  AdminUserSyncLogFilter,
  AdminUserSyncLogsPage,
  AdminUserUpdatePayload,
} from "../types/config";
import {
  deleteAdminUser,
  deleteDirectMessage,
  fetchDirectMessages,
  fetchAdminUserDetail,
  fetchAdminUserLibrary,
  fetchAdminUserSyncLogs,
  fetchAdminUsers,
  updateAdminUser,
} from "../api/client";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import UserManagementTab from "../components/tabs/UserManagementTab";
import UserDetailModal from "../components/modals/UserDetailModal";
import UserEditModal from "../components/modals/UserEditModal";
import BatchVipModal from "../components/modals/BatchVipModal";
import DirectMessageComposeModal from "../components/modals/DirectMessageComposeModal";
import { useDirectMessageComposer } from "../hooks/useDirectMessageComposer";

export default function UserManagementPage() {
  const { themeColor } = useAdminLayout();

  const [adminUsers, setAdminUsers] = useState<AdminUserListItem[]>([]);
  const [adminUserTotal, setAdminUserTotal] = useState(0);
  const [adminUserOffset, setAdminUserOffset] = useState(0);
  const [adminUserLimit] = useState(20);
  const [adminUserFilter, setAdminUserFilter] = useState<AdminUserFilter>({});
  const [adminUserLoading, setAdminUserLoading] = useState(false);
  const [deletingAdminUserId, setDeletingAdminUserId] = useState<string | null>(null);
  const [selectedAdminUser, setSelectedAdminUser] = useState<AdminUserDetail | null>(null);
  const [editingAdminUser, setEditingAdminUser] = useState<AdminUserListItem | null>(null);
  const [adminUserSaving, setAdminUserSaving] = useState(false);
  const [batchVipOpen, setBatchVipOpen] = useState(false);
  const [adminUserDetailTab, setAdminUserDetailTab] = useState<AdminUserDetailTab>("favoriteSongs");
  const [adminUserLibraryStatus, setAdminUserLibraryStatus] = useState<AdminUserLibraryStatus>("active");
  const [adminUserPlaylistFilter, setAdminUserPlaylistFilter] = useState<string | undefined>(undefined);
  const [adminUserLibraryPage, setAdminUserLibraryPage] = useState<AdminUserLibraryPage>({
    list: [],
    total: 0,
    offset: 0,
    limit: 30,
    hasMore: false,
  });
  const [adminUserLibraryLoading, setAdminUserLibraryLoading] = useState(false);
  const [adminUserSyncLogsPage, setAdminUserSyncLogsPage] = useState<AdminUserSyncLogsPage>({
    list: [],
    total: 0,
    offset: 0,
    limit: 30,
    hasMore: false,
    syncVersion: 0,
    syncLogFloor: 0,
  });
  const [adminUserSyncLogsFilter, setAdminUserSyncLogsFilter] = useState<AdminUserSyncLogFilter>({});
  const [adminUserSyncLogsLoading, setAdminUserSyncLogsLoading] = useState(false);
  const [adminUserMessagesPage, setAdminUserMessagesPage] = useState<AdminDirectMessagePage>({
    list: [],
    total: 0,
    offset: 0,
    limit: 30,
    hasMore: false,
  });
  const [adminUserMessagesLoading, setAdminUserMessagesLoading] = useState(false);

  const loadAdminUsers = useCallback(async () => {
    setAdminUserLoading(true);
    try {
      const result = await fetchAdminUsers({
        ...adminUserFilter,
        offset: adminUserOffset,
        limit: adminUserLimit,
      });
      setAdminUsers(result.list);
      setAdminUserTotal(result.total);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载用户列表失败");
    } finally {
      setAdminUserLoading(false);
    }
  }, [adminUserFilter, adminUserOffset, adminUserLimit]);

  useEffect(() => {
    void loadAdminUsers();
  }, [loadAdminUsers]);

  const handleAdminUserFilterChange = (next: AdminUserFilter) => {
    setAdminUserFilter(next);
    setAdminUserOffset(0);
  };

  const loadAdminUserLibrary = useCallback(
    async (
      userId: string,
      kind: AdminUserLibraryKind,
      offset: number,
      status: AdminUserLibraryStatus = "active",
      playlistId?: string,
    ) => {
      setAdminUserLibraryLoading(true);
      try {
        const page = await fetchAdminUserLibrary(userId, kind, offset, 30, { status, playlistId });
        setAdminUserLibraryPage(page);
      } catch (e) {
        alert(e instanceof Error ? e.message : "加载用户同步数据失败");
      } finally {
        setAdminUserLibraryLoading(false);
      }
    },
    [],
  );

  const loadAdminUserSyncLogs = useCallback(
    async (userId: string, filter: AdminUserSyncLogFilter, offset: number) => {
      setAdminUserSyncLogsLoading(true);
      try {
        const page = await fetchAdminUserSyncLogs(userId, { ...filter, offset, limit: 30 });
        setAdminUserSyncLogsPage(page);
      } catch (e) {
        alert(e instanceof Error ? e.message : "加载用户同步日志失败");
      } finally {
        setAdminUserSyncLogsLoading(false);
      }
    },
    [],
  );

  const loadAdminUserMessages = useCallback(async (userId: string, offset: number) => {
    setAdminUserMessagesLoading(true);
    try {
      const page = await fetchDirectMessages({
        targetKind: "user",
        targetId: userId,
        offset,
        limit: 30,
      });
      setAdminUserMessagesPage(page);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载用户留言失败");
    } finally {
      setAdminUserMessagesLoading(false);
    }
  }, []);

  const handleDeleteAdminUserMessage = async (id: string) => {
    if (!selectedAdminUser) return;
    try {
      await deleteDirectMessage(id);
      const currentOffset = adminUserMessagesPage.offset;
      const currentPage = await fetchDirectMessages({
        targetKind: "user",
        targetId: selectedAdminUser.id,
        offset: currentOffset,
        limit: adminUserMessagesPage.limit,
      });
      if (currentPage.list.length === 0 && currentOffset > 0) {
        await loadAdminUserMessages(
          selectedAdminUser.id,
          Math.max(0, currentOffset - adminUserMessagesPage.limit),
        );
      } else {
        setAdminUserMessagesPage(currentPage);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除用户留言失败");
    }
  };

  const handleViewAdminUser = async (user: AdminUserListItem) => {
    try {
      const detail = await fetchAdminUserDetail(user.id);
      setSelectedAdminUser(detail);
      setAdminUserDetailTab("favoriteSongs");
      setAdminUserLibraryStatus("active");
      setAdminUserPlaylistFilter(undefined);
      setAdminUserSyncLogsFilter({});
      void loadAdminUserLibrary(detail.id, "favoriteSongs", 0, "active");
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载用户详情失败");
    }
  };

  const handleAdminUserDetailTabChange = (kind: AdminUserDetailTab) => {
    if (!selectedAdminUser) return;
    setAdminUserDetailTab(kind);
    if (kind !== "playlistTracks") setAdminUserPlaylistFilter(undefined);
    if (kind === "messages") {
      void loadAdminUserMessages(selectedAdminUser.id, 0);
    } else if (kind === "syncLogs") {
      void loadAdminUserSyncLogs(selectedAdminUser.id, adminUserSyncLogsFilter, 0);
    } else {
      void loadAdminUserLibrary(
        selectedAdminUser.id,
        kind,
        0,
        adminUserLibraryStatus,
        kind === "playlistTracks" ? adminUserPlaylistFilter : undefined,
      );
    }
  };

  const handleAdminUserDetailPageChange = (offset: number) => {
    if (!selectedAdminUser) return;
    if (adminUserDetailTab === "messages") {
      void loadAdminUserMessages(selectedAdminUser.id, offset);
    } else if (adminUserDetailTab === "syncLogs") {
      void loadAdminUserSyncLogs(selectedAdminUser.id, adminUserSyncLogsFilter, offset);
    } else {
      void loadAdminUserLibrary(
        selectedAdminUser.id,
        adminUserDetailTab,
        offset,
        adminUserLibraryStatus,
        adminUserDetailTab === "playlistTracks" ? adminUserPlaylistFilter : undefined,
      );
    }
  };

  const handleAdminUserLibraryStatusChange = (status: AdminUserLibraryStatus) => {
    if (!selectedAdminUser) return;
    setAdminUserLibraryStatus(status);
    if (adminUserDetailTab !== "messages" && adminUserDetailTab !== "syncLogs") {
      void loadAdminUserLibrary(
        selectedAdminUser.id,
        adminUserDetailTab,
        0,
        status,
        adminUserDetailTab === "playlistTracks" ? adminUserPlaylistFilter : undefined,
      );
    }
  };

  const handleInspectPlaylistTracks = (playlistId: string) => {
    if (!selectedAdminUser) return;
    setAdminUserDetailTab("playlistTracks");
    setAdminUserPlaylistFilter(playlistId);
    void loadAdminUserLibrary(selectedAdminUser.id, "playlistTracks", 0, adminUserLibraryStatus, playlistId);
  };

  const handleClearPlaylistFilter = () => {
    if (!selectedAdminUser) return;
    setAdminUserPlaylistFilter(undefined);
    void loadAdminUserLibrary(selectedAdminUser.id, "playlistTracks", 0, adminUserLibraryStatus);
  };

  const handleSyncLogsFilterChange = (next: AdminUserSyncLogFilter) => {
    if (!selectedAdminUser) return;
    setAdminUserSyncLogsFilter(next);
    void loadAdminUserSyncLogs(selectedAdminUser.id, next, 0);
  };

  const directMessageComposer = useDirectMessageComposer(async (target) => {
    if (
      target.kind === "user" &&
      selectedAdminUser?.id === target.id &&
      adminUserDetailTab === "messages"
    ) {
      await loadAdminUserMessages(target.id, 0);
    }
  });

  const handleSaveAdminUser = async (payload: AdminUserUpdatePayload) => {
    if (!editingAdminUser) return;
    setAdminUserSaving(true);
    try {
      const updated = await updateAdminUser(editingAdminUser.id, payload);
      setAdminUsers((prev) => prev.map((user) => (user.id === updated.id ? updated : user)));
      if (selectedAdminUser?.id === updated.id) {
        setSelectedAdminUser(await fetchAdminUserDetail(updated.id));
      }
      setEditingAdminUser(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存用户资料失败");
    } finally {
      setAdminUserSaving(false);
    }
  };

  const handleDeleteAdminUser = async (user: AdminUserListItem) => {
    if (
      !window.confirm(
        `确定要删除用户 ${user.username} 吗？该账号的收藏和歌单同步数据也会被级联删除。`,
      )
    )
      return;
    setDeletingAdminUserId(user.id);
    try {
      await deleteAdminUser(user.id);
      if (selectedAdminUser?.id === user.id) setSelectedAdminUser(null);
      if (editingAdminUser?.id === user.id) setEditingAdminUser(null);
      await loadAdminUsers();
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除用户失败");
    } finally {
      setDeletingAdminUserId(null);
    }
  };

  return (
    <>
      <UserManagementTab
        users={adminUsers}
        total={adminUserTotal}
        offset={adminUserOffset}
        limit={adminUserLimit}
        filter={adminUserFilter}
        loading={adminUserLoading}
        deletingId={deletingAdminUserId}
        themeColor={themeColor}
        onFilterChange={handleAdminUserFilterChange}
        onPageChange={setAdminUserOffset}
        onRefresh={() => void loadAdminUsers()}
        onView={(user) => void handleViewAdminUser(user)}
        onEdit={setEditingAdminUser}
        onDelete={(user) => void handleDeleteAdminUser(user)}
        onMessage={directMessageComposer.openComposer}
        onBatchVip={() => setBatchVipOpen(true)}
      />

      {selectedAdminUser && (
        <UserDetailModal
          user={selectedAdminUser}
          activeKind={adminUserDetailTab}
          libraryStatus={adminUserLibraryStatus}
          playlistIdFilter={adminUserPlaylistFilter}
          libraryPage={adminUserLibraryPage}
          libraryLoading={adminUserLibraryLoading}
          syncLogsPage={adminUserSyncLogsPage}
          syncLogsLoading={adminUserSyncLogsLoading}
          syncLogsFilter={adminUserSyncLogsFilter}
          messagesPage={adminUserMessagesPage}
          messagesLoading={adminUserMessagesLoading}
          themeColor={themeColor}
          onKindChange={handleAdminUserDetailTabChange}
          onLibraryStatusChange={handleAdminUserLibraryStatusChange}
          onInspectPlaylistTracks={handleInspectPlaylistTracks}
          onClearPlaylistFilter={handleClearPlaylistFilter}
          onSyncLogsFilterChange={handleSyncLogsFilterChange}
          onRefreshSyncLogs={() =>
            void loadAdminUserSyncLogs(selectedAdminUser.id, adminUserSyncLogsFilter, adminUserSyncLogsPage.offset)
          }
          onPageChange={handleAdminUserDetailPageChange}
          onDeleteMessage={(id) => void handleDeleteAdminUserMessage(id)}
          onClose={() => setSelectedAdminUser(null)}
        />
      )}

      {editingAdminUser && (
        <UserEditModal
          user={editingAdminUser}
          themeColor={themeColor}
          saving={adminUserSaving}
          onClose={() => setEditingAdminUser(null)}
          onSave={(payload) => void handleSaveAdminUser(payload)}
        />
      )}

      {directMessageComposer.target && (
        <DirectMessageComposeModal
          target={directMessageComposer.target}
          sending={directMessageComposer.sending}
          onCancel={directMessageComposer.closeComposer}
          onSubmit={directMessageComposer.submit}
        />
      )}

      <BatchVipModal
        open={batchVipOpen}
        onClose={() => setBatchVipOpen(false)}
        onSuccess={() => void loadAdminUsers()}
      />
    </>
  );
}
