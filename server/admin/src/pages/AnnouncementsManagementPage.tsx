import { useRef, useState } from "react";
import { Modal } from "antd";
import type { Announcement } from "../types/config";
import { announcementGotoForSave, usesAnnouncementV2, validateAnnouncementDraft } from "../utils/announcementDraft";
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
  const { announcements, setAnnouncements, appConfigServer } = useAdminConfigWorkspace();
  const [confirmModal, modalHolder] = Modal.useModal();

  const [editingNotice, setEditingNotice] = useState<Announcement | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);

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
      enabled: true,
      announcementVersion: 2,
      platform: "all",
      versionRule: { mode: "all" },
      waitSeconds: 0,
    });
    setIsNew(true);
    setSaveError(undefined);
  };

  const handleEditAnnouncement = (index: number) => {
    setEditingNotice({ ...announcements[index] });
    setIsNew(false);
    setSaveError(undefined);
  };

  const handleSaveAnnouncement = async () => {
    if (!editingNotice || saveInProgress.current) return;
    const validation = validateAnnouncementDraft(editingNotice);
    setSaveError(validation);
    if (validation) return;

    saveInProgress.current = true;
    setSaving(true);
    try {
      let announcementVersion = editingNotice.announcementVersion ?? 1;
      if (announcementVersion === 1 && usesAnnouncementV2(editingNotice)) {
        const confirmed = await confirmModal.confirm({
          title: "升级为 V2 公告？",
          content: "保存后，旧客户端将收不到这条公告。",
          okText: "升级并保存",
          cancelText: "返回编辑",
        });
        if (!confirmed) return;
        announcementVersion = 2;
      }

      const previousAction = announcements.find((item) => item.id === editingNotice.id)?.gotoAction;
      const saved = await saveAnnouncementApi({
        ...editingNotice,
        announcementVersion,
        gotoAction: announcementGotoForSave(editingNotice, announcementVersion, previousAction),
      }, isNew);
      setAnnouncements((current) => isNew
        ? [saved, ...current.filter((item) => item.id !== saved.id)]
        : current.map((item) => item.id === saved.id ? saved : item));
      setEditingNotice(null);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存公告失败");
    } finally {
      saveInProgress.current = false;
      setSaving(false);
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
      {modalHolder}
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
          isNew={isNew}
          releases={appConfigServer.releases}
          saving={saving}
          error={saveError}
          onClose={() => setEditingNotice(null)}
          onChange={(next) => {
            setSaveError(undefined);
            setEditingNotice(next);
          }}
          onContentChange={(update) => {
            setSaveError(undefined);
            setEditingNotice((current) => current && { ...current, content: update(current.content) });
          }}
          onSave={handleSaveAnnouncement}
        />
      )}
    </>
  );
}
