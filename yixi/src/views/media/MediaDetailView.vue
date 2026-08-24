<template>
  <div class="media-detail-page">
    <div v-if="song || playlist" class="ambient-cover" aria-hidden="true">
      <img :src="coverUrl" alt="" />
    </div>

    <div v-if="loading" class="state-panel">
      <n-skeleton class="state-cover" />
      <div class="state-copy">
        <n-skeleton text width="120px" />
        <n-skeleton text width="68%" height="48px" />
        <n-skeleton text width="46%" />
        <n-skeleton text :repeat="3" />
      </div>
    </div>

    <n-empty v-else-if="error" class="empty-state" :description="error">
      <template #extra>
        <n-button v-if="isShareMode" type="primary" @click="loadFromRoute">重试</n-button>
      </template>
    </n-empty>

    <section v-else-if="song || playlist" class="detail-stage">
      <aside class="cover-column">
        <div class="cover-frame">
          <img class="cover" :src="coverUrl" :alt="title" />
          <span class="cover-index">PISA / {{ song ? "TRACK" : "PLAYLIST" }}</span>
        </div>
      </aside>

      <main class="detail-copy">
        <header class="detail-heading">
          <div class="type-line">
            <span class="type-icon">
              <n-icon :component="song ? Disc3 : ListMusic" size="17" />
            </span>
            <span>{{ headingKicker }}</span>
          </div>

          <div v-if="shareRecord" class="share-origin">
            <n-avatar
              round
              :size="28"
              :src="shareRecord.sharer.avatarUrl || undefined">
              {{ shareRecord.sharer.username?.slice(0, 1) || "P" }}
            </n-avatar>
            <span>{{ shareRecord.sharer.username || "PisaMusic 用户" }} 分享</span>
            <span class="share-dot" aria-hidden="true"></span>
            <n-icon :component="Eye" size="15" />
            <span>{{ shareRecord.accessCount }} 次浏览</span>
          </div>

          <h1 :title="title">{{ title }}</h1>
          <p class="subtitle" :title="subtitle">{{ subtitle || "暂无描述" }}</p>
        </header>

        <div class="meta-list">
          <div v-for="item in metaItems" :key="item.label" class="meta-row">
            <span>{{ item.label }}</span>
            <strong :title="item.value">{{ item.value || "暂无" }}</strong>
          </div>
        </div>

        <div class="action-row">
          <n-button v-if="song" type="primary" class="primary-action" @click="playSong">
            <template #icon>
              <n-icon :component="Play" />
            </template>
            立即播放
          </n-button>
          <n-button v-else type="primary" class="primary-action" @click="openPlaylistPage">
            <template #icon>
              <n-icon :component="ListMusic" />
            </template>
            打开歌单
          </n-button>
          <n-button secondary class="secondary-action" @click="toggleCollect">
            <template #icon>
              <n-icon :component="Heart" />
            </template>
            {{ collected ? "取消收藏" : "收藏" }}
          </n-button>
          <n-button secondary class="secondary-action" @click="openShareDialog">
            <template #icon>
              <n-icon :component="Share2" />
            </template>
            分享
          </n-button>
        </div>
      </main>
    </section>

    <ShareDialog ref="shareDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NAvatar, NButton, NEmpty, NIcon, NSkeleton } from "naive-ui";
import { Disc3, Eye, Heart, ListMusic, Play, Share2 } from "lucide-vue-next";
import type { CommonPlaylist, Song } from "@/types/song";
import ShareDialog from "@/components/common/ShareDialog.vue";
import { useCollectStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { defaultSongCover, formatDuration, getKgImage, getSongCover } from "@/utils/common";
import defaultPlaylistCover from "@/assets/images/default-created-playlist-cover.svg";
import { getPublicShare } from "@/share/shareApi";
import {
  decodeMediaDetailPayload,
  playlistFromSharePayload,
  songFromSharePayload,
  type PublicShareRecord,
} from "@/share/shareModels";

const route = useRoute();
const router = useRouter();
const collector = useCollectStore();
const playbackCommands = usePlaybackCommands();
const shareDialogRef = ref<InstanceType<typeof ShareDialog> | null>(null);

const loading = ref(false);
const error = ref("");
const song = ref<Song | null>(null);
const playlist = ref<CommonPlaylist | null>(null);
const shareRecord = ref<PublicShareRecord | null>(null);

const isShareMode = computed(() => route.query.kind === "share");
const title = computed(() => song.value?.name || playlist.value?.name || "音乐详情");
const subtitle = computed(() => song.value?.singer || playlist.value?.desc || "");
const sourceLabel = computed(() => labelSource(song.value?.source || playlist.value?.source || shareRecord.value?.source));
const headingKicker = computed(() => {
  if (shareRecord.value) return song.value ? "SHARED TRACK" : "SHARED PLAYLIST";
  return song.value ? `TRACK PROFILE · ${sourceLabel.value}` : `PLAYLIST PROFILE · ${sourceLabel.value}`;
});
const collected = computed(() => {
  if (song.value) return collector.containsSong(song.value);
  if (playlist.value) return collector.containsPlaylist(playlist.value);
  return false;
});
const coverUrl = computed(() => {
  if (song.value) return getSongCover(song.value, 360);
  if (!playlist.value) return defaultSongCover;
  if (playlist.value.source === "kg") return getKgImage(playlist.value.cover, 360);
  return playlist.value.coverSize?.l || playlist.value.cover || defaultPlaylistCover;
});
const metaItems = computed(() => {
  if (song.value) {
    if (shareRecord.value) {
      return [
        { label: "歌手", value: song.value.singer || shareRecord.value.description },
        { label: "歌名", value: song.value.name || shareRecord.value.title },
        { label: "专辑", value: song.value.album },
        { label: "时长", value: formatDuration(song.value.duration) },
        { label: "访问次数", value: String(shareRecord.value.accessCount) },
      ];
    }
    return [
      { label: "歌手", value: song.value.singer },
      { label: "专辑", value: song.value.album },
      { label: "时长", value: formatDuration(song.value.duration) },
      { label: "来源", value: sourceLabel.value },
    ];
  }
  if (playlist.value) {
    if (shareRecord.value) {
      return [
        { label: "描述", value: shareRecord.value.description || playlist.value.desc },
        { label: "分享人", value: shareRecord.value.sharer.username || "PisaMusic 用户" },
        { label: "访问次数", value: String(shareRecord.value.accessCount) },
      ];
    }
    return [
      { label: "来源", value: sourceLabel.value },
      { label: "歌曲数", value: String(playlist.value.song_count || 0) },
      { label: "播放量", value: String(playlist.value.play_count || "") },
      { label: "收藏量", value: String(playlist.value.collect_count || "") },
    ];
  }
  return [];
});

watch(() => route.fullPath, () => void loadFromRoute(), { immediate: true });

async function loadFromRoute() {
  resetState();
  if (route.query.kind === "share") {
    await loadShareDetail();
    return;
  }
  loadPayloadDetail();
}

function resetState() {
  loading.value = false;
  error.value = "";
  song.value = null;
  playlist.value = null;
  shareRecord.value = null;
}

function loadPayloadDetail() {
  const payload = decodeMediaDetailPayload(route.query.payload);
  if (!payload) {
    error.value = "详情数据无效";
    return;
  }
  if (payload.kind === "song") {
    song.value = songFromSharePayload(payload.song);
    return;
  }
  playlist.value = playlistFromSharePayload(payload.playlist);
}

async function loadShareDetail() {
  const uuid = Array.isArray(route.query.uuid) ? route.query.uuid[0] : route.query.uuid;
  if (!uuid) {
    error.value = "分享链接无效";
    return;
  }
  loading.value = true;
  try {
    const share = await getPublicShare(uuid);
    shareRecord.value = share;
    if (share.type === "song") {
      song.value = songFromSharePayload({ ...share.rawJson, cover: share.coverUrl });
    } else {
      playlist.value = playlistFromSharePayload({ ...share.rawJson, cover: share.coverUrl });
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "分享不存在或已失效";
  } finally {
    loading.value = false;
  }
}

function playSong() {
  if (!song.value) return;
  if (song.value.source === "local" && !song.value.filePath) {
    window.$message.warning("该本地歌曲只能在原设备播放");
    return;
  }
  playbackCommands.playSingle(song.value);
}

function openPlaylistPage() {
  if (!playlist.value) return;
  void router.push({
    path: "/playlist/detail",
    query: { id: playlist.value.id, origin: playlist.value.source },
  });
}

function toggleCollect() {
  if (song.value) {
    void collector.collectSong(song.value);
    return;
  }
  if (playlist.value) void collector.collectList(playlist.value);
}

function openShareDialog() {
  if (song.value) {
    shareDialogRef.value?.openForSong(song.value);
    return;
  }
  if (playlist.value) shareDialogRef.value?.openForPlaylist(playlist.value);
}

function labelSource(source?: string) {
  const labels: Record<string, string> = {
    kg: "KG",
    wy: "WY",
    kw: "KW",
    qq: "QQ",
    local: "本地",
  };
  return source ? labels[source] || source.toUpperCase() : "未知";
}
</script>

<style scoped lang="scss">
.media-detail-page {
  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 100%;
  overflow: hidden;
  padding: clamp(12px, 2.4vw, 34px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  box-sizing: border-box;
}

.detail-stage,
.state-panel,
.empty-state {
  position: relative;
  z-index: 1;
  width: min(1120px, 100%);
  margin: 0 auto;
}

.state-panel {
  display: grid;
  grid-template-columns: minmax(220px, 360px) minmax(0, 1fr);
  gap: clamp(32px, 5vw, 72px);
  align-items: center;
  min-height: 520px;
}

.state-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 12px;
}

.state-copy {
  display: grid;
  gap: 18px;
}

.empty-state {
  flex: 1;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ambient-cover {
  position: absolute;
  z-index: -1;
  top: 50%;
  left: 22%;
  width: min(58vw, 760px);
  aspect-ratio: 1;
  transform: translate(-50%, -50%) scale(1.16);
  opacity: 0.17;
  filter: blur(86px) saturate(1.25);
  pointer-events: none;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
}

.detail-stage {
  display: grid;
  grid-template-columns: minmax(260px, 390px) minmax(0, 1fr);
  gap: clamp(38px, 6vw, 86px);
  align-items: center;
  min-height: 560px;
}

.cover-column {
  min-width: 0;
}

.cover-frame {
  position: relative;
  width: 100%;
  padding: 10px 10px 38px;
  border: 1px solid color-mix(in srgb, var(--color-border-default) 72%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-bg-default) 72%, transparent);
  box-shadow: 0 30px 70px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(26px) saturate(1.2);
  box-sizing: border-box;
}

.cover {
  width: 100%;
  aspect-ratio: 1;
  display: block;
  border-radius: 9px;
  object-fit: cover;
  box-shadow: 0 18px 46px rgba(15, 23, 42, 0.2);
}

.cover-index {
  position: absolute;
  left: 12px;
  bottom: 12px;
  color: var(--color-text-secondary);
  font-size: 9px;
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.18em;
}

.detail-copy {
  min-width: 0;
}

.detail-heading {
  min-width: 0;
}

.type-line,
.share-origin {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.type-line {
  gap: 9px;
  color: var(--color-primary);
  font-size: 10px;
  line-height: 1;
  font-weight: 850;
  letter-spacing: 0.16em;
}

.type-icon {
  width: 30px;
  height: 30px;
  display: inline-grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 30%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-primary) 9%, transparent);
}

.share-origin {
  gap: 8px;
  margin-top: 20px;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.share-dot {
  width: 3px;
  height: 3px;
  margin: 0 2px;
  border-radius: 50%;
  background: var(--color-text-third);
}

h1 {
  margin: 20px 0 0;
  overflow-wrap: anywhere;
  color: var(--color-text-default);
  font-size: clamp(38px, 5vw, 68px);
  line-height: 1.02;
  font-weight: 720;
  letter-spacing: -0.045em;
}

.subtitle {
  max-width: 680px;
  margin: 16px 0 0;
  color: var(--color-text-secondary);
  font-size: clamp(14px, 1.6vw, 18px);
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.meta-list {
  margin-top: 34px;
  border-top: 1px solid color-mix(in srgb, var(--color-border-default) 78%, transparent);
}

.meta-row {
  min-width: 0;
  min-height: 48px;
  padding: 10px 2px;
  display: grid;
  grid-template-columns: minmax(78px, 0.28fr) minmax(0, 1fr);
  align-items: center;
  gap: 18px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-border-default) 78%, transparent);

  span {
    color: var(--color-text-secondary);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.06em;
  }

  strong {
    min-width: 0;
    overflow: hidden;
    color: var(--color-text-default);
    font-size: 14px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 28px;

  :deep(.n-button) {
    height: 40px;
    padding: 0 18px;
    border-radius: 9px;
    font-weight: 700;
  }
}

.primary-action {
  min-width: 132px;
  box-shadow: 0 12px 26px color-mix(in srgb, var(--color-primary) 24%, transparent);
}

@media (max-width: 920px) {
  .detail-stage,
  .state-panel {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .detail-stage {
    gap: 34px;
    padding: 18px 0 36px;
  }

  .cover-column {
    max-width: 380px;
    width: 100%;
    margin: 0 auto;
  }

  .state-panel {
    padding: 20px 0;
  }

  .state-cover {
    max-width: 380px;
  }

  .ambient-cover {
    top: 25%;
    left: 50%;
  }
}

@media (max-width: 560px) {
  .media-detail-page {
    padding: 10px;
  }

  h1 {
    font-size: 36px;
  }

  .meta-row {
    grid-template-columns: 70px minmax(0, 1fr);
  }

  .action-row {
    display: grid;
    grid-template-columns: 1fr 1fr;

    .primary-action {
      grid-column: 1 / -1;
    }
  }
}
</style>
