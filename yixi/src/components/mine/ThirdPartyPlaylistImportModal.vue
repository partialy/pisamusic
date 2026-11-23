<template>
  <AppModal
    v-model:show="visible"
    title="导入三方歌单"
    :icon="Download"
    :width="760"
    :close-disabled="busy"
    @after-leave="handleAfterLeave"
  >
    <div class="import-modal-body">
      <div class="import-toolbar">
        <div class="toolbar-left">
          <BatchSegmentedActions
            always-show-label
            aria-label="歌单音源筛选"
            :actions="sourceActions"
            @action="handleSourceChange"
          />
          <BatchSegmentedActions
            aria-label="歌单操作"
            :actions="selectActions"
            @action="handleSelectAction"
          />
        </div>

        <div class="toolbar-right">
          <ExpandableSearchInput v-model:value="searchKey" placeholder="搜索歌单" />
        </div>
      </div>

      <div class="candidate-list-container">
        <div v-if="store.candidatePulling && !filteredCandidates.length" class="empty-wrap">
          <n-spin size="medium" description="正在拉取三方账号歌单..." />
        </div>

        <n-empty
          v-else-if="!hasAnyThirdPartyLogin && !store.candidatePlaylists.length"
          class="empty-wrap"
          description="请先登录酷狗或网易云账号后再拉取歌单"
        >
          <template #extra>
            <n-button type="primary" round @click="handleGoAccount">
              <template #icon>
                <n-icon :component="LogIn" />
              </template>
              去登录
            </n-button>
          </template>
        </n-empty>

        <div v-else-if="filteredCandidates.length" class="candidate-list">
          <div
            v-for="item in filteredCandidates"
            :key="playlistKey(item)"
            class="candidate-row"
            :class="{
              'is-selected': isSelected(item),
              'is-imported': isImported(item),
            }"
            @click="toggleRow(item)"
          >
            <n-checkbox
              :checked="isImported(item) || isSelected(item)"
              :disabled="isImported(item) || busy"
              @click.stop
              @update:checked="toggleRow(item)"
            />

            <img
              class="candidate-cover"
              :src="getCover(item)"
              alt=""
              loading="lazy"
            />

            <div class="candidate-info">
              <div class="candidate-title-row">
                <span class="source-pill" :class="`source-${item.source}`">
                  {{ item.source.toUpperCase() }}
                </span>
                <span class="candidate-name" :title="item.name">{{ item.name }}</span>
              </div>
              <div class="candidate-meta">
                <span>{{ item.song_count ?? 0 }} 首</span>
                <span v-if="item.desc" class="meta-divider">·</span>
                <span v-if="item.desc" class="candidate-desc" :title="item.desc">
                  {{ item.desc }}
                </span>
              </div>
            </div>

            <div class="candidate-status">
              <span v-if="isImported(item)" class="status-tag imported">已导入</span>
              <span v-else-if="isSelected(item)" class="status-tag selected">已选</span>
            </div>
          </div>
        </div>

        <n-empty
          v-else
          class="empty-wrap"
          :description="
            searchKey.trim()
              ? '未找到匹配的歌单'
              : '暂无可用歌单，可点击「刷新数据」重新拉取'
          "
        />
      </div>
    </div>

    <template #footer-options>
      <span class="footer-summary">
        当前显示 {{ filteredCandidates.length }} 个歌单，可导入
        {{ importableFilteredCandidates.length }} 个，已选 {{ selectedCount }} 个
      </span>
    </template>

    <template #footer>
      <n-button round :disabled="busy" @click="visible = false">
        <template #icon>
          <n-icon :component="X" />
        </template>
        取消
      </n-button>
      <n-button
        secondary
        type="primary"
        round
        :loading="importingMode === 'all'"
        :disabled="busy || !importableFilteredCandidates.length"
        @click="handleImportAll"
      >
        <template #icon>
          <n-icon :component="Download" />
        </template>
        全部导入 ({{ importableFilteredCandidates.length }})
      </n-button>
      <n-button
        type="primary"
        round
        :loading="importingMode === 'selected'"
        :disabled="busy || !selectedCount"
        @click="handleImportSelected"
      >
        <template #icon>
          <n-icon :component="Check" />
        </template>
        导入所选 ({{ selectedCount }})
      </n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NCheckbox, NEmpty, NIcon, NSpin } from "naive-ui";
import {
  ArrowLeftRight,
  Check,
  Download,
  ListChecks,
  LogIn,
  RefreshCw,
  X,
} from "lucide-vue-next";
import AppModal from "@/components/common/AppModal.vue";
import BatchSegmentedActions, {
  type SegmentedActionItem,
} from "@/components/batch/BatchSegmentedActions.vue";
import ExpandableSearchInput from "@/components/common/ExpandableSearchInput.vue";
import { KGIcon, ListUnorderedIcon, NeteaseIcon } from "@/icons";
import { useMineLibraryStore } from "@/store";
import { useCookieAccountStatus } from "@/composables/useCookieAccountStatus";
import { getSongCover } from "@/utils/common";
import defaultPlaylistCover from "@/assets/images/default-created-playlist-cover.svg";
import type { CommonPlaylist } from "@/types/song";

type SourceFilter = "all" | "kg" | "wy";

const emit = defineEmits<{
  goAccount: [];
}>();

const store = useMineLibraryStore();
const { accounts } = useCookieAccountStatus();

const visible = ref(false);
const activeSource = ref<SourceFilter>("all");
const searchKey = ref("");
const selectedKeys = ref<Set<string>>(new Set());
const importingMode = ref<"" | "selected" | "all">("");

const busy = computed(() => store.candidatePulling || Boolean(importingMode.value));
const hasAnyThirdPartyLogin = computed(
  () => accounts.kg.loggedIn || accounts.wy.loggedIn
);

const sourceCandidates = computed(() => {
  if (activeSource.value === "kg") return store.candidateCache.kg;
  if (activeSource.value === "wy") return store.candidateCache.wy;
  return store.candidatePlaylists;
});

const normalizedSearch = computed(() => searchKey.value.trim().toLowerCase());

const filteredCandidates = computed(() => {
  const keyword = normalizedSearch.value;
  if (!keyword) return sourceCandidates.value;
  return sourceCandidates.value.filter((item) =>
    [item.name, item.desc, item.source]
      .filter(Boolean)
      .some((text) => String(text).toLowerCase().includes(keyword))
  );
});

const importableFilteredCandidates = computed(() =>
  filteredCandidates.value.filter((item) => !isImported(item))
);

const selectedTargets = computed(() =>
  store.candidatePlaylists.filter(
    (item) => !isImported(item) && selectedKeys.value.has(playlistKey(item))
  )
);

const selectedCount = computed(() => selectedTargets.value.length);

const sourceActions = computed<SegmentedActionItem[]>(() => [
  {
    key: "all",
    label: `全部 (${store.candidatePlaylists.length})`,
    icon: ListUnorderedIcon,
    active: activeSource.value === "all",
    primary: activeSource.value === "all",
    disabled: busy.value,
  },
  {
    key: "kg",
    label: `KG (${store.candidateCache.kg.length})`,
    icon: KGIcon,
    iconColor: "#1296DB",
    active: activeSource.value === "kg",
    primary: activeSource.value === "kg",
    disabled: busy.value,
  },
  {
    key: "wy",
    label: `WY (${store.candidateCache.wy.length})`,
    icon: NeteaseIcon,
    iconColor: "#d71920",
    active: activeSource.value === "wy",
    primary: activeSource.value === "wy",
    disabled: busy.value,
  },
]);

const selectActions = computed<SegmentedActionItem[]>(() => [
  {
    key: "refresh",
    label: "刷新数据",
    icon: RefreshCw,
    loading: store.candidatePulling,
    spinIcon: true,
    disabled: busy.value,
  },
  {
    key: "selectAll",
    label: "全选",
    icon: ListChecks,
    disabled: busy.value || !importableFilteredCandidates.value.length,
  },
  {
    key: "invert",
    label: "反选",
    icon: ArrowLeftRight,
    disabled: busy.value || !importableFilteredCandidates.value.length,
  },
]);

watch(
  () => [store.candidatePlaylists, store.importedPlaylistKeySet],
  () => {
    const validImportable = new Set(
      store.candidatePlaylists
        .filter((item) => !isImported(item))
        .map((item) => playlistKey(item))
    );
    selectedKeys.value = new Set(
      [...selectedKeys.value].filter((key) => validImportable.has(key))
    );
  }
);

function playlistKey(item: Pick<CommonPlaylist, "source" | "id">) {
  return `${item.source}:${item.id}`;
}

function isImported(item: Pick<CommonPlaylist, "source" | "id">) {
  return store.isPlaylistImported(item);
}

function isSelected(item: Pick<CommonPlaylist, "source" | "id">) {
  return selectedKeys.value.has(playlistKey(item));
}

function getCover(item: CommonPlaylist) {
  return getSongCover(item, 240, defaultPlaylistCover);
}

function toggleRow(item: CommonPlaylist) {
  if (busy.value || isImported(item)) return;
  const key = playlistKey(item);
  const next = new Set(selectedKeys.value);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }
  selectedKeys.value = next;
}

function handleSourceChange(key: string) {
  if (busy.value) return;
  activeSource.value = key as SourceFilter;
}

function handleSelectAction(key: string) {
  if (busy.value) return;
  if (key === "refresh") {
    void handleRefreshAction();
    return;
  }
  const next = new Set(selectedKeys.value);
  if (key === "selectAll") {
    importableFilteredCandidates.value.forEach((item) => next.add(playlistKey(item)));
  } else if (key === "invert") {
    importableFilteredCandidates.value.forEach((item) => {
      const k = playlistKey(item);
      if (next.has(k)) next.delete(k);
      else next.add(k);
    });
  }
  selectedKeys.value = next;
}

async function handleRefreshAction() {
  if (busy.value) return;
  if (!hasAnyThirdPartyLogin.value) {
    window.$message.warning("请先登录酷狗或网易云账号后再刷新");
    return;
  }
  try {
    await store.pullCandidatePlaylists();
    window.$message.success(`已刷新三方歌单，共 ${store.candidatePlaylists.length} 个`);
  } catch (error) {
    window.$message.error(
      error instanceof Error ? error.message : "刷新三方歌单失败"
    );
  }
}

async function handleImportSelected() {
  if (busy.value || !selectedTargets.value.length) return;
  await executeImport(selectedTargets.value, "selected");
}

async function handleImportAll() {
  if (busy.value || !importableFilteredCandidates.value.length) return;
  await executeImport(importableFilteredCandidates.value, "all");
}

async function executeImport(
  targets: CommonPlaylist[],
  mode: "selected" | "all"
) {
  importingMode.value = mode;
  try {
    const result = await store.importCandidatePlaylists(targets);
    const next = new Set(selectedKeys.value);
    targets.forEach((item) => next.delete(playlistKey(item)));
    selectedKeys.value = next;
    window.$message.success(
      `导入完成：新增 ${result.added} 个，跳过已存在 ${result.skipped} 个`
    );
  } catch (error) {
    window.$message.error(
      error instanceof Error ? error.message : "导入歌单失败"
    );
  } finally {
    importingMode.value = "";
  }
}

function handleGoAccount() {
  visible.value = false;
  emit("goAccount");
}

function handleAfterLeave() {
  searchKey.value = "";
  selectedKeys.value = new Set();
  importingMode.value = "";
}

function open() {
  visible.value = true;
}

function close() {
  if (!busy.value) {
    visible.value = false;
  }
}

defineExpose({ open, close });
</script>

<style scoped lang="scss">
.import-modal-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.import-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.candidate-list-container {
  min-height: 300px;
  max-height: 430px;
  overflow-y: auto;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-control);
  background: var(--surface-card);
  padding: 8px;
}

.empty-wrap {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.candidate-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;

  &:hover:not(.is-imported) {
    background: var(--surface-hover);
  }

  &.is-selected {
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    border-color: color-mix(in srgb, var(--color-primary) 30%, var(--border-subtle));
  }

  &.is-imported {
    opacity: 0.65;
    cursor: default;
  }
}

.candidate-cover {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--surface-input);
}

.candidate-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.candidate-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.source-pill {
  flex-shrink: 0;
  height: 20px;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &.source-kg {
    color: #1296db;
    background: rgba(18, 150, 219, 0.14);
  }

  &.source-wy {
    color: #d71920;
    background: rgba(215, 25, 32, 0.14);
  }
}

.candidate-name {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: 12px;
  min-width: 0;
}

.meta-divider {
  opacity: 0.6;
}

.candidate-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate-status {
  flex-shrink: 0;
}

.status-tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;

  &.imported {
    color: var(--text-secondary);
    background: var(--surface-input);
  }

  &.selected {
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  }
}

.footer-summary {
  color: var(--text-secondary);
  font-size: 12px;
}
</style>
