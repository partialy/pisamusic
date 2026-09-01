<template>
  <HomeAnnouncementDetailModal
    :show="announcementVisible"
    :announcement="announcement"
    @confirmed="handleConfirmed"
    @goto="handleGoto"
    @after-leave="clearAnnouncement" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import HomeAnnouncementDetailModal from "./HomeAnnouncementDetailModal.vue";
import { normalizeAnnouncementContent, type Announcement } from "./homeAnnouncement";
import { showLimitedWarning } from "@/utils/limitedMessage";

type SettingRecord<T> = { value: T };

const CONFIRMED_SETTING_KEY = "home-announcement-confirmed-ids";
const AUTO_POPUP_SESSION_KEY = "home-announcement-auto-popup-shown";
const announcement = ref<Announcement | null>(null);
const announcementVisible = ref(false);
const confirmedIds = ref<string[]>([]);
let autoPopupTimer: ReturnType<typeof setTimeout> | undefined;

async function loadLatestAnnouncement() {
  if (sessionStorage.getItem(AUTO_POPUP_SESSION_KEY) === "1") return;
  sessionStorage.setItem(AUTO_POPUP_SESSION_KEY, "1");
  try {
    const [setting, list] = await Promise.all([
      window.electronAPI.getSetting<string[]>(CONFIRMED_SETTING_KEY),
      window.electronAPI.getAnnouncements(),
    ]);
    confirmedIds.value = normalizeConfirmedIds(setting);
    const notices = Array.isArray(list)
      ? list.map((notice) => ({ ...notice, content: normalizeAnnouncementContent(notice.content) }))
      : [];
    announcement.value = notices.find(
      (notice) => notice.showEveryTime || !confirmedIds.value.includes(notice.id),
    ) || null;
    announcementVisible.value = Boolean(announcement.value);
  } catch (error) {
    showLimitedWarning("公告加载失败");
    void window.electronAPI.reportError(error, {
      scope: "startup",
      action: "fetchLatestAnnouncement",
    });
  }
}

function normalizeConfirmedIds(setting: SettingRecord<string[]> | null) {
  if (!Array.isArray(setting?.value)) return [];
  return setting.value.filter((id) => typeof id === "string" && id.length > 0);
}

async function confirmAnnouncement(notice: Announcement) {
  if (notice.showEveryTime || confirmedIds.value.includes(notice.id)) return;
  const nextConfirmedIds = [...confirmedIds.value, notice.id];
  confirmedIds.value = nextConfirmedIds;
  await window.electronAPI.setSetting(CONFIRMED_SETTING_KEY, nextConfirmedIds, 1);
}

async function handleConfirmed() {
  const notice = announcement.value;
  announcementVisible.value = false;
  if (notice) await confirmAnnouncement(notice);
}

async function handleGoto() {
  const notice = announcement.value;
  const url = notice?.gotoUrl?.trim();
  if (!notice || !url) return;
  try {
    await window.electronAPI.openUrl({ url, mode: "window" });
    announcementVisible.value = false;
    await confirmAnnouncement(notice);
  } catch (error) {
    window.$message?.error(error instanceof Error ? error.message : "链接打开失败");
  }
}

function clearAnnouncement() {
  if (!announcementVisible.value) announcement.value = null;
}

onMounted(() => {
  autoPopupTimer = setTimeout(() => {
    void loadLatestAnnouncement();
  }, 2000);
});

onBeforeUnmount(() => {
  if (autoPopupTimer) clearTimeout(autoPopupTimer);
});
</script>
