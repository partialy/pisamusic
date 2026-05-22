<template>
  <div class="playlist-container mw1600">
    <header class="page-header">
      <div class="title-group">
        <h1>{{ currentTagName }}</h1>
        <span class="subtitle">{{ headerSubtitle }}</span>
      </div>
      <div class="header-actions">
        <n-button
          type="primary"
          class="shuffle-btn"
          :disabled="!playlists.length || initialLoading"
          :loading="playingRandom"
          @click="handleRandomPlay">
          <template #icon>
            <n-icon :component="Play" />
          </template>
          随机播放
        </n-button>
        <n-select
          v-model:value="activeSource"
          class="source-select"
          size="small"
          :options="sourceOptions"
          :consistent-menu-width="false"
          :disabled="initialLoading || tagsLoading"
          @update:value="handleSourceChange" />
      </div>
    </header>

    <div class="tags" ref="tagsRef">
      <template v-if="tagsLoading">
        <n-skeleton v-for="i in 8" :key="i" class="tag-skeleton" />
      </template>
      <template v-else>
        <template v-for="tag in tags" :key="tag.id">
          <n-popover
            v-if="tag.children.length"
            style="max-width: 640px"
            placement="bottom"
            trigger="click"
            :arrow-style="{ background: 'var(--color-card-bg)' }">
            <template #trigger>
              <n-button
                class="tag-button"
                :class="{ active: isGroupActive(tag) }">
                {{ tag.name }}
                <template #icon>
                  <n-icon :component="chooseIcon(tag.name)" />
                </template>
              </n-button>
            </template>
            <div class="tag-popover">
              <n-button
                v-for="item in tag.children"
                :key="item.id"
                quaternary
                size="small"
                round
                :class="{ active: selectedTag.id === item.id }"
                @click="handleClickTag(item)">
                {{ item.name }}
              </n-button>
            </div>
          </n-popover>
          <n-button
            v-else
            class="tag-button"
            :class="{ active: selectedTag.id === tag.id }"
            @click="handleClickTag(tag)">
            {{ tag.name }}
            <template #icon>
              <n-icon :component="chooseIcon(tag.name)" />
            </template>
          </n-button>
        </template>
      </template>
    </div>

    <PlaylistCollect
      :playlist="playlists"
      :loading="initialLoading"
      :skeleton-count="24" />

    <n-empty
      v-if="!initialLoading && !playlists.length"
      class="empty-state"
      description="暂无歌单" />

    <div class="end-line" ref="endLineRef">
      <template v-if="!initialLoading && playlists.length && hasNext">
        <n-spin :show="moreLoading">
          <template #icon>
            <n-icon
              :component="LoadingIcon"
              color="var(--color-primary)" />
          </template>
          <template #description>正在加载更多...</template>
        </n-spin>
      </template>
      <div v-else-if="!initialLoading && playlists.length" class="no-more">没有更多了~</div>
    </div>

    <n-back-top class="scroll-top-btn" :right="20" :bottom="120" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { Component } from "vue";
import {
  NBackTop,
  NButton,
  NEmpty,
  NIcon,
  NPopover,
  NSelect,
  NSkeleton,
  NSpin,
  type SelectOption,
} from "naive-ui";
import { Play } from "lucide-vue-next";
import PlaylistCollect from "@/components/list/PlaylistCollect.vue";
import {
  SceneIcon,
  EmotionIcon,
  StyleIcon,
  YearIcon,
  ThemeIcon,
  LanguageIcon,
  QuestionIcon,
} from "@/icons";
import LoadingIcon from "@/icons/common/LoadingIcon.vue";
import { useAudioStore } from "@/store";
import type { CommonPlaylist } from "@/types/song";
import { getPlaylistTags, getTopPlaylists } from "@/utils/api/musicAPI";
import { debounce } from "@/utils/common";
import { convertor } from "@/utils/convertor";
import { reportError } from "@/utils/errorReporter";
import { fetchAllPlaylistTracks } from "@/utils/playlistTracks";

type PlaylistSource = "kg" | "wy";

interface PlaylistTag {
  source: PlaylistSource;
  id: string | number;
  name: string;
  resourceCount: number;
  children: PlaylistTag[];
}

const PAGE_SIZE = 30;

const sourceOptions: SelectOption[] = [
  { label: "KG", value: "kg" },
  { label: "WY", value: "wy" },
];

const player = useAudioStore();
const activeSource = ref<PlaylistSource>("kg");
const tags = ref<PlaylistTag[]>([]);
const selectedTag = ref<PlaylistTag>(createAllTag("kg"));
const playlists = ref<CommonPlaylist[]>([]);
const tagsLoading = ref(false);
const initialLoading = ref(false);
const moreLoading = ref(false);
const playingRandom = ref(false);
const hasNext = ref(true);
const pagination = ref({
  page: 1,
  pageSize: PAGE_SIZE,
});
const endLineRef = ref<HTMLElement | null>(null);
const tagsRef = ref<HTMLElement | null>(null);
let observerEndLine: IntersectionObserver | null = null;
let observerTags: IntersectionObserver | null = null;
let requestVersion = 0;

const currentTagName = computed(() => selectedTag.value?.name || "全部");
const headerSubtitle = computed(() => {
  const count = selectedTag.value?.resourceCount || playlists.value.length;
  return `当前分类共有${count}张歌单`;
});

function chooseIcon(tagName: string): Component {
  switch (tagName) {
    case "风格":
      return StyleIcon;
    case "场景":
      return SceneIcon;
    case "主题":
      return ThemeIcon;
    case "心情":
    case "情感":
      return EmotionIcon;
    case "语种":
      return LanguageIcon;
    case "年代":
      return YearIcon;
    default:
      return QuestionIcon;
  }
}

async function handleSourceChange(value: string | number | null) {
  const source = value === "wy" ? "wy" : "kg";
  if (activeSource.value !== source) activeSource.value = source;
  await reloadSource(source);
}

async function handleClickTag(tag: PlaylistTag) {
  if (selectedTag.value.id === tag.id && selectedTag.value.source === tag.source) return;
  selectedTag.value = tag;
  await loadPlaylists(true);
}

async function reloadSource(source: PlaylistSource) {
  const version = ++requestVersion;
  tagsLoading.value = true;
  initialLoading.value = true;
  moreLoading.value = false;
  hasNext.value = true;
  playlists.value = [];
  pagination.value.page = 1;
  selectedTag.value = createAllTag(source);

  try {
    const response = await getPlaylistTags({ source });
    if (version !== requestVersion) return;
    tags.value = normalizeTags(source, response);
    selectedTag.value = tags.value[0] || createAllTag(source);
    await loadPlaylists(true, version);
  } catch (error) {
    if (version !== requestVersion) return;
    tags.value = [createAllTag(source)];
    playlists.value = [];
    hasNext.value = false;
    window.$message?.warning("歌单分类加载失败");
    void reportError(error, {
      scope: "playlist",
      action: "reloadSource",
      source,
    });
  } finally {
    if (version === requestVersion) {
      tagsLoading.value = false;
      initialLoading.value = false;
    }
  }
}

async function loadPlaylists(reset = false, version = requestVersion) {
  if (reset) {
    initialLoading.value = true;
    hasNext.value = true;
    pagination.value.page = 1;
  } else {
    if (moreLoading.value || !hasNext.value) return;
    moreLoading.value = true;
  }

  const page = reset ? 1 : pagination.value.page + 1;
  const source = activeSource.value;
  const tag = selectedTag.value;

  try {
    const response = await fetchPlaylistPage(source, tag, page);
    if (version !== requestVersion) return;
    const nextPlaylists = convertPlaylistResponse(source, response);
    playlists.value = reset ? nextPlaylists : playlists.value.concat(nextPlaylists);
    hasNext.value = getResponseHasNext(source, response, nextPlaylists.length);
    pagination.value.page = page;
  } catch (error) {
    if (version !== requestVersion) return;
    if (reset) playlists.value = [];
    hasNext.value = false;
    window.$message?.warning("歌单列表加载失败");
    void reportError(error, {
      scope: "playlist",
      action: "loadPlaylists",
      source,
      tag: tag.name,
      page,
    });
  } finally {
    if (version === requestVersion) {
      initialLoading.value = false;
      setTimeout(() => {
        moreLoading.value = false;
      }, 300);
    }
  }
}

async function fetchPlaylistPage(source: PlaylistSource, tag: PlaylistTag, page: number) {
  if (source === "wy") {
    return getTopPlaylists({
      source,
      cat: tag.name || "全部",
      order: "hot",
      page,
      pageSize: pagination.value.pageSize,
    });
  }

  return getTopPlaylists({
    source,
    categoryId: tag.id || 0,
    page,
    pageSize: pagination.value.pageSize,
  });
}

function convertPlaylistResponse(source: PlaylistSource, response: any): CommonPlaylist[] {
  if (source === "wy") {
    return (response?.playlists || []).map((item: any) => convertor.WY.convertWYTopPlaylist(item));
  }

  return (response?.data?.special_list || []).map((item: any) =>
    convertor.KG.convertKGPlaylist(item, "item")
  );
}

function getResponseHasNext(source: PlaylistSource, response: any, loadedCount: number) {
  if (source === "wy") return Boolean(response?.more);
  if (typeof response?.data?.has_next === "number") return response.data.has_next === 1;
  return loadedCount >= pagination.value.pageSize;
}

async function handleRandomPlay() {
  const playlist = playlists.value[Math.floor(Math.random() * playlists.value.length)];
  if (!playlist) return;
  playingRandom.value = true;
  try {
    const songs = await fetchAllPlaylistTracks(playlist);
    if (!songs.length) {
      window.$message?.warning("歌单暂无可播放歌曲");
      return;
    }
    await player.switchPlayList(songs, true);
  } catch (error) {
    window.$message?.warning("随机播放失败");
    void reportError(error, {
      scope: "playlist",
      action: "randomPlayPlaylist",
      playlistId: playlist.id,
      source: playlist.source,
    });
  } finally {
    playingRandom.value = false;
  }
}

function normalizeTags(source: PlaylistSource, response: any): PlaylistTag[] {
  if (source === "wy") return normalizeWyTags(response);
  return normalizeKgTags(response);
}

function normalizeKgTags(response: any): PlaylistTag[] {
  const groups = Array.isArray(response?.data) ? response.data : [];
  return [
    createAllTag("kg"),
    ...groups.map((group: any) => ({
      source: "kg" as const,
      id: group?.tag_id ?? group?.tag_name,
      name: String(group?.tag_name || "未分类"),
      resourceCount: 0,
      children: (Array.isArray(group?.son) ? group.son : []).map((item: any) => ({
        source: "kg" as const,
        id: item?.tag_id ?? 0,
        name: String(item?.tag_name || "全部"),
        resourceCount: toResourceCount(item?.resourceCount),
        children: [],
      })),
    })),
  ];
}

function normalizeWyTags(response: any): PlaylistTag[] {
  const groups = new Map<string, PlaylistTag>();
  Object.entries(response?.categories || {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([id, name]) => {
      groups.set(id, {
        source: "wy",
        id: `wy-category-${id}`,
        name: String(name),
        resourceCount: 0,
        children: [],
      });
    });

  (Array.isArray(response?.sub) ? response.sub : []).forEach((item: any) => {
    const categoryId = String(item?.category ?? "");
    const group = groups.get(categoryId);
    if (!group) return;
    group.children.push({
      source: "wy",
      id: item?.name || categoryId,
      name: String(item?.name || "全部"),
      resourceCount: toResourceCount(item?.resourceCount),
      children: [],
    });
  });

  return [
    createAllTag("wy", response?.all?.resourceCount),
    ...Array.from(groups.values()).filter((group) => group.children.length),
  ];
}

function createAllTag(source: PlaylistSource, resourceCount: unknown = 0): PlaylistTag {
  return {
    source,
    id: 0,
    name: "全部",
    resourceCount: toResourceCount(resourceCount),
    children: [],
  };
}

function toResourceCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function isGroupActive(tag: PlaylistTag) {
  return tag.children.some(
    (item) => item.id === selectedTag.value.id && item.source === selectedTag.value.source
  );
}

const loadMore = debounce(() => {
  void loadPlaylists(false);
}, 500);

function observeEndLine() {
  observerEndLine = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) loadMore();
      });
    },
    {
      root: null,
      threshold: 0.3,
    }
  );
  if (endLineRef.value) observerEndLine.observe(endLineRef.value);
}

function observeTags() {
  observerTags = new IntersectionObserver(
    () => {
      // 保留标签区域监听，后续滚动吸顶或返回顶部策略可以复用该锚点。
    },
    {
      root: null,
      threshold: 0.1,
    }
  );
  if (tagsRef.value) observerTags.observe(tagsRef.value);
}

onMounted(async () => {
  observeEndLine();
  observeTags();
  await reloadSource(activeSource.value);
});

onBeforeUnmount(() => {
  observerEndLine?.disconnect();
  observerTags?.disconnect();
});
</script>

<style lang="scss" scoped>
.playlist-container {
  width: 100%;
  min-height: 100%;
  padding-bottom: 32px;
  scroll-behavior: smooth;
  will-change: transform;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
  padding: 8px 0 0;
}

.title-group {
  min-width: 0;

  h1 {
    margin: 0;
    color: var(--color-text-default);
    font-size: 30px;
    line-height: 1.25;
    font-weight: 700;
    letter-spacing: 0;
  }
}

.subtitle {
  display: inline-block;
  margin-top: 8px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.shuffle-btn {
  height: 34px;
  border-radius: 5px;
  padding: 0 18px;
}

.source-select {
  width: 96px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 0 24px;
}

.tag-button {
  border-radius: 6px;

  &.active {
    color: var(--color-primary);
    border-color: color-mix(in srgb, var(--color-primary) 48%, transparent);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }
}

.tag-popover {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 640px;
  padding: 8px;
  background: transparent;

  :deep(.active) {
    color: var(--color-primary);
  }
}

.tag-skeleton {
  width: 82px;
  height: 34px;
  border-radius: 6px;
}

.empty-state {
  margin-top: 80px;
}

.end-line {
  height: 60px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 1rem;

  .no-more {
    font-size: 14px;
    color: var(--color-text-secondary);
  }
}

.scroll-top-btn {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  z-index: 20;
  background-color: var(--color-bg-default);
  border: none;
  opacity: 0.5;

  &:hover {
    opacity: 1;
  }
}

@media (max-width: 820px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
