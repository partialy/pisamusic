import { useState } from "react";
import type { Announcement } from "../types/config";
import { getCurrentPlus8Time } from "../utils/date";
import {
  deleteAnnouncement as deleteAnnouncementApi,
  saveAnnouncement as saveAnnouncementApi,
} from "../api/client";
import { useAdminConfigWorkspace } from "../state/AdminConfigWorkspaceContext";
import { useAdminLayout } from "../layouts/AdminLayoutContext";
import AnnouncementsTab from "../components/tabs/AnnouncementsTab";
import NoticeModal from "../components/modals/NoticeModal";

export default function AnnouncementsManagementPage() {
  const { themeColor } = useAdminLayout();
  const { announcements, setAnnouncements } = useAdminConfigWorkspace();

  const [editingNotice, setEditingNotice] = useState<Announcement | null>(null);
  const [editingNoticeIndex, setEditingNoticeIndex] = useState(-1);

  const handleAddAnnouncement = () => {
    const plus8Time = getCurrentPlus8Time();
    const newId = `notice_${plus8Time.slice(0, 10).replace(/-/g, "")}_${Math.floor(
      Math.random() * 1000,
    )
      .toString()
      .padStart(3, "0")}`;
    setEditingNotice({
      id: newId,
      content: {
        schemaVersion: 1,
        blocks: [{ type: "text", text: "新公告内容..." }],
      },
      time: plus8Time,
      publisher: "PisaMusic Team",
      confirmText: "我知道了",
      showEveryTime: false,
      showGotoButton: false,
      gotoUrl: "",
    });
    setEditingNoticeIndex(-1);
  };

  const handleEditAnnouncement = (index: number) => {
    setEditingNotice({ ...announcements[index] });
    setEditingNoticeIndex(index);
  };

  const handleSaveAnnouncement = async () => {
    if (!editingNotice) return;
    try {
      const saved = await saveAnnouncementApi(editingNotice);
      const next = [...announcements];
      if (editingNoticeIndex === -1) {
        next.unshift(saved);
      } else {
        next[editingNoticeIndex] = saved;
      }
      setAnnouncements(next);
      setEditingNotice(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存公告失败");
    }
  };

  const handleDeleteAnnouncement = async (index: number) => {
    const target = announcements[index];
    if (!target) return;
    if (window.confirm("确定要删除这条公告吗？")) {
      try {
        await deleteAnnouncementApi(target.id);
        setAnnouncements(announcements.filter((_, i) => i !== index));
      } catch (e) {
        alert(e instanceof Error ? e.message : "删除公告失败");
      }
    }
  };

  return (
    <>
      <AnnouncementsTab
        announcements={announcements}
        themeColor={themeColor}
        onAdd={handleAddAnnouncement}
        onEdit={handleEditAnnouncement}
        onDelete={handleDeleteAnnouncement}
      />

      {editingNotice && (
        <NoticeModal
          editing={editingNotice}
          isNew={editingNoticeIndex === -1}
          themeColor={themeColor}
          onClose={() => setEditingNotice(null)}
          onChange={setEditingNotice}
          onSave={handleSaveAnnouncement}
        />
      )}
    </>
  );
}
