<template>
  <HomeAnnouncementDetailModal
    :show="announcementVisible"
    :announcement="announcement"
    @confirmed="handleConfirmed"
    @goto="handleGoto"
    @after-leave="clearAnnouncement" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import HomeAnnouncementDetailModal from "./HomeAnnouncementDetailModal.vue";
import { normalizeAnnouncementContent, type Announcement } from "./homeAnnouncement";
import { showLimitedWarning } from "@/utils/limitedMessage";
import { useStartupPopupGate } from "@/composables/useStartupPopupGate";
import { AnnouncementAutoPopupScheduler } from "@/composables/startupPopupArbitration";

type SettingRecord<T> = { value: T };

const CONFIRMED_SETTING_KEY = "home-announcement-confirmed-ids";
const AUTO_POPUP_SESSION_KEY = "home-announcement-auto-popup-shown";
const announcement = ref<Announcement | null>(null);
const announcementVisible = ref(false);
const confirmedIds = ref<string[]>([]);
const {
  directMessagesSettled,
  canScheduleAnnouncement,
  setAnnouncementVisible,
} = useStartupPopupGate();

const autoPopupScheduler = new AnnouncementAutoPopupScheduler({
  delayMs: 2000,
  isEligible: () => (
    canScheduleAnnouncement()
    && sessionStorage.getItem(AUTO_POPUP_SESSION_KEY) !== "1"
  ),
  load: loadLatestAnnouncement,
  onError: (error) => {
    // 与原有行为一致：本次会话的自动公告只尝试一次。
    sessionStorage.setItem(AUTO_POPUP_SESSION_KEY, "1");
    showLimitedWarning("公告加载失败");
    void window.electronAPI.reportError(error, {
      scope: "startup",
      action: "fetchLatestAnnouncement",
    });
  },
});

async function loadLatestAnnouncement(): Promise<(() => void) | null> {
  const [setting, list] = await Promise.all([
    window.electronAPI.getSetting<string[]>(CONFIRMED_SETTING_KEY),
    window.electronAPI.getAnnouncements(),
  ]);
  const nextConfirmedIds = normalizeConfirmedIds(setting);
  const notices = Array.isArray(list)
    ? list.map((notice) => ({ ...notice, content: normalizeAnnouncementContent(notice.content) }))
    : [];
  const nextAnnouncement = notices.find(
    (notice) => notice.showEveryTime || !nextConfirmedIds.includes(notice.id),
  ) || null;

  return () => {
    confirmedIds.value = nextConfirmedIds;
    sessionStorage.setItem(AUTO_POPUP_SESSION_KEY, "1");
    announcement.value = nextAnnouncement;
    announcementVisible.value = Boolean(nextAnnouncement);
    setAnnouncementVisible(Boolean(nextAnnouncement));
  };
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
  if (announcementVisible.value) return;
  announcement.value = null;
  setAnnouncementVisible(false);
}

watch(directMessagesSettled, () => {
  autoPopupScheduler.reconcile();
}, { immediate: true });

onBeforeUnmount(() => {
  autoPopupScheduler.stop();
  setAnnouncementVisible(false);
});
</script>
