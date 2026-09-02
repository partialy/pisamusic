import { useCallback, useEffect, useState } from "react";
import type {
  AdminDirectMessagePage,
  AdminUserDetail,
  AdminUserDetailTab,
  AdminUserFilter,
  AdminUserLibraryKind,
  AdminUserLibraryPage,
  AdminUserListItem,
  AdminUserUpdatePayload,
} from "../types/config";
import {
  deleteAdminUser,
  fetchDirectMessages,
  fetchAdminUserDetail,
  fetchAdminUserLibrary,
  fetchAdminUsers,
  updateAdminUser,
} from "../api/client";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import UserManagementTab from "../components/tabs/UserManagementTab";
import UserDetailModal from "../components/modals/UserDetailModal";
import UserEditModal from "../components/modals/UserEditModal";
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
  const [adminUserDetailTab, setAdminUserDetailTab] = useState<AdminUserDetailTab>("favoriteSongs");
  const [adminUserLibraryPage, setAdminUserLibraryPage] = useState<AdminUserLibraryPage>({
    items: [],
    total: 0,
    offset: 0,
    limit: 30,
  });
  const [adminUserLibraryLoading, setAdminUserLibraryLoading] = useState(false);
  const [adminUserMessagesPage, setAdminUserMessagesPage] = useState<AdminDirectMessagePage>({
    items: [],
    total: 0,
    offset: 0,
    limit: 30,
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
      setAdminUsers(result.users);
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
    async (userId: string, kind: AdminUserLibraryKind, offset: number) => {
      setAdminUserLibraryLoading(true);
      try {
        const page = await fetchAdminUserLibrary(userId, kind, offset, 30);
        setAdminUserLibraryPage(page);
      } catch (e) {
        alert(e instanceof Error ? e.message : "加载用户同步数据失败");
      } finally {
        setAdminUserLibraryLoading(false);
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

  const handleViewAdminUser = async (user: AdminUserListItem) => {
    try {
      const detail = await fetchAdminUserDetail(user.id);
      setSelectedAdminUser(detail);
      setAdminUserDetailTab("favoriteSongs");
      void loadAdminUserLibrary(detail.id, "favoriteSongs", 0);
    } catch (e) {
      alert(e instanceof Error ? e.message : "加载用户详情失败");
    }
  };

  const handleAdminUserDetailTabChange = (kind: AdminUserDetailTab) => {
    if (!selectedAdminUser) return;
    setAdminUserDetailTab(kind);
    if (kind === "messages") {
      void loadAdminUserMessages(selectedAdminUser.id, 0);
    } else {
      void loadAdminUserLibrary(selectedAdminUser.id, kind, 0);
    }
  };

  const handleAdminUserDetailPageChange = (offset: number) => {
    if (!selectedAdminUser) return;
    if (adminUserDetailTab === "messages") {
      void loadAdminUserMessages(selectedAdminUser.id, offset);
    } else {
      void loadAdminUserLibrary(selectedAdminUser.id, adminUserDetailTab, offset);
    }
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
      />

      {selectedAdminUser && (
        <UserDetailModal
          user={selectedAdminUser}
          activeKind={adminUserDetailTab}
          libraryPage={adminUserLibraryPage}
          libraryLoading={adminUserLibraryLoading}
          messagesPage={adminUserMessagesPage}
          messagesLoading={adminUserMessagesLoading}
          themeColor={themeColor}
          onKindChange={handleAdminUserDetailTabChange}
          onPageChange={handleAdminUserDetailPageChange}
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
    </>
  );
}
