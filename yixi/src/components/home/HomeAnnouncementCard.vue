<template>
  <section class="announcement-card">
    <div class="announcement-header">
      <div>
        <div class="eyebrow">NOTICE</div>
        <h3>公告</h3>
      </div>
      <span v-if="activeNotice" class="notice-count">
        {{ activeIndex + 1 }}/{{ visibleNotices.length }}
      </span>
    </div>

    <div v-if="loading" class="notice-loading">
      <n-skeleton text width="120px" />
      <n-skeleton text width="92%" />
      <n-skeleton text width="76%" />
      <n-skeleton text width="58%" />
    </div>

    <div v-else-if="activeNotice" class="notice-body">
      <div class="notice-meta">
        <span>{{ activeNotice.publisher || "PisaMusic Team" }}</span>
        <span>{{ activeNotice.time || "刚刚" }}</span>
      </div>
      <div class="notice-content" :title="previewText">{{ previewText }}</div>
      <div class="notice-actions">
        <div class="notice-switch" v-if="visibleNotices.length > 1">
          <button v-for="(_, index) in visibleNotices" :key="index" type="button" class="dot"
            :class="{ active: index === activeIndex }" :aria-label="`切换到第 ${index + 1} 条公告`"
            @click="activeIndex = index" />
        </div>
        <div class="action-buttons">
          <n-button size="small" type="primary" @click="openNoticeDetail">查看详情</n-button>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      暂无公告
    </div>

    <HomeAnnouncementDetailModal
      v-if="detailNotice"
      :show="Boolean(detailNotice)"
      :announcement="detailNotice"
      @close="detailNotice = null"
      @confirmed="handleNoticeConfirmed"
      @goto="handleNoticeGoto" />
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { NButton, NSkeleton } from "naive-ui";
import { showLimitedWarning } from "@/utils/limitedMessage";
import HomeAnnouncementDetailModal from "./HomeAnnouncementDetailModal.vue";
import {
  getAnnouncementPreview,
  normalizeAnnouncementContent,
  type Announcement,
} from "./homeAnnouncement";

defineOptions({ name: "HomeAnnouncementCard" });

type SettingRecord<T> = {
  value: T;
};

const CONFIRMED_SETTING_KEY = "home-announcement-confirmed-ids";

const loading = ref(false);
const notices = ref<Announcement[]>([]);
const confirmedIds = ref<string[]>([]);
const hiddenSessionIds = ref<string[]>([]);
const activeIndex = ref(0);
const detailNotice = ref<Announcement | null>(null);

const visibleNotices = computed(() =>
  notices.value.filter((notice) => {
    if (hiddenSessionIds.value.includes(notice.id)) return false;
    if (notice.showEveryTime) return true;
    return !confirmedIds.value.includes(notice.id);
  })
);

const activeNotice = computed(() => {
  if (!visibleNotices.value.length) return null;
  return visibleNotices.value[Math.min(activeIndex.value, visibleNotices.value.length - 1)];
});

const previewText = computed(() => activeNotice.value ? getAnnouncementPreview(activeNotice.value.content) : "");

async function fetchNotices() {
  loading.value = true;
  try {
    const [setting, list] = await Promise.all([
      window.electronAPI.getSetting<string[]>(CONFIRMED_SETTING_KEY),
      window.electronAPI.getAnnouncements(),
    ]);
    confirmedIds.value = normalizeConfirmedIds(setting);
    notices.value = Array.isArray(list)
      ? list.map((notice) => ({ ...notice, content: normalizeAnnouncementContent(notice.content) }))
      : [];
    activeIndex.value = 0;
  } catch (error) {
    showLimitedWarning("公告加载失败");
    void window.electronAPI.reportError(error, {
      scope: "home",
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

async function confirmNotice(notice: Announcement) {
  if (notice.showEveryTime) {
    hiddenSessionIds.value = [...hiddenSessionIds.value, notice.id];
  } else if (!confirmedIds.value.includes(notice.id)) {
    confirmedIds.value = [...confirmedIds.value, notice.id];
    await window.electronAPI.setSetting(CONFIRMED_SETTING_KEY, confirmedIds.value, 1);
  }
  activeIndex.value = Math.min(activeIndex.value, Math.max(visibleNotices.value.length - 1, 0));
}

function openNoticeDetail() {
  if (activeNotice.value) detailNotice.value = activeNotice.value;
}

function handleNoticeConfirmed() {
  const notice = detailNotice.value;
  detailNotice.value = null;
  if (notice) void confirmNotice(notice);
}

async function handleNoticeGoto() {
  const url = detailNotice.value?.gotoUrl?.trim();
  if (!url) return;
  detailNotice.value = null;
  try {
    await window.electronAPI.openUrl({ url, mode: "window" });
  } catch (error) {
    window.$message?.error(error instanceof Error ? error.message : "链接打开失败");
  }
}

onMounted(() => {
  void fetchNotices();
});
</script>

<style lang="scss" scoped>
.announcement-card {
  flex: 1;
  min-width: 0;
  height: 220px;
  padding: 18px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, var(--color-border-default) 80%, transparent);
  background:
    linear-gradient(160deg, color-mix(in srgb, var(--color-primary) 8%, transparent), transparent 42%),
    color-mix(in srgb, var(--color-bg-default) 88%, #ffffff 12%);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
}

.announcement-header {
  height: 42px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  h3 {
    margin: 0;
    font-size: 18px;
    line-height: 24px;
  }
}

.eyebrow {
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
}

.notice-count {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.notice-loading {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notice-body {
  height: 144px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.notice-meta {
  display: flex;
  gap: 12px;
  color: var(--color-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notice-content {
  flex: 1;
  min-height: 0;
  margin-top: 8px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  color: var(--color-text-default);
  line-height: 1.55;
  font-size: 14px;
  white-space: pre-line;
}

.notice-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.notice-switch {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 7px;
  height: 7px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-text-secondary) 45%, transparent);
  cursor: pointer;

  &.active {
    width: 18px;
    border-radius: 999px;
    background: var(--color-primary);
  }
}

.action-buttons {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.empty-state {
  height: 144px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}
</style>
