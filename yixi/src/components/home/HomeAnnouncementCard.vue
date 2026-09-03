<template>
  <section class="announcement-card">
    <div class="announcement-header">
      <div>
        <div class="eyebrow">NOTICE</div>
        <h3>公告</h3>
      </div>
      <span v-if="latestNotices.length" class="notice-count">
        最新 {{ latestNotices.length }} 条
      </span>
    </div>

    <div v-if="loading" class="notice-loading">
      <n-skeleton text width="120px" />
      <n-skeleton text width="92%" />
      <n-skeleton text width="76%" />
      <n-skeleton text width="58%" />
    </div>

    <div v-else-if="latestNotices.length" class="notice-list">
      <div v-for="notice in latestNotices" :key="notice.id" class="notice-row">
        <div class="notice-row-content">
          <div class="notice-meta">
            <span>{{ notice.publisher || "PisaMusic Team" }}</span>
            <span>{{ notice.time || "刚刚" }}</span>
          </div>
          <div class="notice-content" :title="getAnnouncementPreview(notice.content)">
            {{ getAnnouncementPreview(notice.content) }}
          </div>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      暂无公告
    </div>

    <footer v-if="latestNotices.length" class="announcement-footer">
      <n-button
        class="announcement-detail-button"
        size="small"
        type="primary"
        @click="openNoticeDetail(latestNotices[0])">
        查看详情
      </n-button>
    </footer>

    <HomeAnnouncementDetailModal
      :show="detailVisible"
      :announcement="detailNotice"
      @confirmed="handleNoticeConfirmed"
      @goto="handleNoticeGoto"
      @after-leave="clearDetailNotice" />
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
import { reportAnnouncementRead } from "./announcementRead";

defineOptions({ name: "HomeAnnouncementCard" });

type SettingRecord<T> = {
  value: T;
};

const CONFIRMED_SETTING_KEY = "home-announcement-confirmed-ids";

const loading = ref(false);
const notices = ref<Announcement[]>([]);
const confirmedIds = ref<string[]>([]);
const detailNotice = ref<Announcement | null>(null);
const detailVisible = ref(false);

const latestNotices = computed(() => notices.value.slice(0, 3));

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
  reportAnnouncementRead(notice.id);
  if (!notice.showEveryTime && !confirmedIds.value.includes(notice.id)) {
    const nextConfirmedIds = [...confirmedIds.value, notice.id];
    confirmedIds.value = nextConfirmedIds;
    await window.electronAPI.setSetting(CONFIRMED_SETTING_KEY, nextConfirmedIds, 1);
  }
}

function openNoticeDetail(notice: Announcement) {
  detailNotice.value = notice;
  detailVisible.value = true;
}

function handleNoticeConfirmed() {
  const notice = detailNotice.value;
  detailVisible.value = false;
  if (notice) void confirmNotice(notice);
}

async function handleNoticeGoto() {
  const notice = detailNotice.value;
  const url = notice?.gotoUrl?.trim();
  if (!url) return;
  try {
    await window.electronAPI.openUrl({ url, mode: "window" });
    detailVisible.value = false;
    if (notice) await confirmNotice(notice);
  } catch (error) {
    window.$message?.error(error instanceof Error ? error.message : "链接打开失败");
  }
}

function clearDetailNotice() {
  if (!detailVisible.value) detailNotice.value = null;
}

onMounted(() => {
  void fetchNotices();
});
</script>

<style lang="scss" scoped>
.announcement-card {
  flex: 1;
  display: flex;
  flex-direction: column;
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

.notice-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.notice-row {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 4px 0;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border-default) 60%, transparent);

  &:last-child {
    border-bottom: 0;
  }
}

.notice-row-content {
  flex: 1;
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
  margin-top: 2px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  color: var(--color-text-default);
  line-height: 1.55;
  font-size: 14px;
  white-space: pre-line;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
}

.announcement-footer {
  display: flex;
  flex: 0 0 32px;
  align-items: flex-end;
  justify-content: flex-end;
}

.announcement-detail-button {
  border-radius: 8px;
}
</style>
