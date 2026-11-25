<template>
  <section class="announcement-setting">
    <div class="setting-heading">
      <div>
        <div class="eyebrow">NOTICE</div>
        <h2>系统公告</h2>
      </div>
      <n-button secondary round size="small" :loading="loading" @click="fetchAnnouncements">刷新</n-button>
    </div>

    <div v-if="loading && !announcements.length" class="announcement-loading">
      <n-skeleton v-for="index in 3" :key="index" text :repeat="3" :sharp="false" />
    </div>

    <div v-else-if="announcements.length" class="announcement-list">
      <article v-for="notice in announcements" :key="notice.id" class="announcement-item">
        <div class="announcement-item-main">
          <div class="announcement-item-meta">
            <span>{{ notice.publisher || "PisaMusic Team" }}</span>
            <span>{{ notice.time || "刚刚" }}</span>
          </div>
          <div class="announcement-item-preview">
            {{ getAnnouncementPreview(notice.content) }}
          </div>
        </div>
        <n-button size="small" round type="primary" @click="openDetail(notice)">查看详情</n-button>
      </article>
    </div>

    <div v-else class="announcement-empty">暂无公告</div>

    <HomeAnnouncementDetailModal
      :show="detailVisible"
      :announcement="selectedAnnouncement"
      :confirm="handleConfirmed"
      @after-leave="clearSelectedAnnouncement" />
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { NButton, NSkeleton } from "naive-ui";
import { showLimitedWarning } from "@/utils/limitedMessage";
import HomeAnnouncementDetailModal from "@/components/home/HomeAnnouncementDetailModal.vue";
import {
  getAnnouncementPreview,
  normalizeAnnouncementContent,
  type Announcement,
} from "@/components/home/homeAnnouncement";
import { reportAnnouncementRead } from "@/components/home/announcementRead";

type SettingRecord<T> = { value: T };

const CONFIRMED_SETTING_KEY = "home-announcement-confirmed-ids";
const loading = ref(false);
const announcements = ref<Announcement[]>([]);
const selectedAnnouncement = ref<Announcement | null>(null);
const detailVisible = ref(false);
const confirmedIds = ref<string[]>([]);

async function fetchAnnouncements() {
  loading.value = true;
  try {
    const [setting, list] = await Promise.all([
      window.electronAPI.getSetting<string[]>(CONFIRMED_SETTING_KEY),
      window.electronAPI.getAnnouncements({ forceRefresh: true }),
    ]);
    confirmedIds.value = normalizeConfirmedIds(setting);
    announcements.value = Array.isArray(list)
      ? list.map((notice) => ({ ...notice, content: normalizeAnnouncementContent(notice.content) }))
      : [];
  } catch (error) {
    showLimitedWarning("公告加载失败");
    void window.electronAPI.reportError(error, {
      scope: "setting",
      action: "fetchAnnouncements",
    });
  } finally {
    loading.value = false;
  }
}

function normalizeConfirmedIds(setting: SettingRecord<string[]> | null) {
  if (!Array.isArray(setting?.value)) return [];
  return setting.value.filter((id) => typeof id === "string" && id.length > 0);
}

async function confirmAnnouncement(notice: Announcement) {
  reportAnnouncementRead(notice.id);
  if (notice.showEveryTime || confirmedIds.value.includes(notice.id)) return;
  const nextConfirmedIds = [...confirmedIds.value, notice.id];
  confirmedIds.value = nextConfirmedIds;
  await window.electronAPI.setSetting(CONFIRMED_SETTING_KEY, nextConfirmedIds, 1);
}

function openDetail(notice: Announcement) {
  selectedAnnouncement.value = notice;
  detailVisible.value = true;
}

async function handleConfirmed(notice: Announcement) {
  if (selectedAnnouncement.value?.id === notice.id) detailVisible.value = false;
  await confirmAnnouncement(notice);
}

function clearSelectedAnnouncement() {
  if (!detailVisible.value) selectedAnnouncement.value = null;
}

onMounted(() => {
  void fetchAnnouncements();
});
</script>

<style lang="scss" scoped>
.announcement-setting {
  display: flex;
  min-height: 100%;
  flex-direction: column;
  gap: 16px;
}

.setting-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 16px;
    line-height: 1.3;
  }
}

.eyebrow {
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.announcement-loading {
  display: grid;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-control);
  background: var(--surface-card);
}

.announcement-list {
  display: grid;
  gap: 10px;
}

.announcement-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex-wrap: wrap;
  padding: 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-control);
  background: var(--surface-card);
}

.announcement-item-main {
  min-width: 0;
}

.announcement-item-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 6px;
  color: var(--text-secondary);
  font-size: 12px;
}

.announcement-item-preview {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.55;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.announcement-empty {
  display: grid;
  min-height: 180px;
  place-items: center;
  color: var(--text-secondary);
}
</style>
