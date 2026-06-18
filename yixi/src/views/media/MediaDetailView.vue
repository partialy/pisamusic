<template>
  <div class="media-detail-page">
    <n-button quaternary class="back-button" @click="goBack">
      <template #icon>
        <n-icon :component="ArrowLeft" />
      </template>
      返回
    </n-button>

    <div v-if="loading" class="state-panel">
      <n-skeleton height="280px" width="280px" />
      <div class="state-copy">
        <n-skeleton text width="240px" />
        <n-skeleton text width="360px" />
        <n-skeleton text :repeat="4" />
      </div>
    </div>

    <n-empty v-else-if="error" class="empty-state" :description="error">
      <template #extra>
        <n-button v-if="isShareMode" type="primary" @click="loadFromRoute">重试</n-button>
      </template>
    </n-empty>

    <section v-else-if="song || playlist" class="detail-shell">
      <aside class="cover-panel">
        <img class="cover" :src="coverUrl" :alt="title" />
        <div class="action-stack">
          <n-button v-if="song" type="primary" round block @click="playSong">
            <template #icon>
              <n-icon :component="Play" />
            </template>
            播放
          </n-button>
          <n-button v-else type="primary" round block @click="openPlaylistPage">
            <template #icon>
              <n-icon :component="ListMusic" />
            </template>
            打开歌单
          </n-button>
          <n-button secondary round block @click="toggleCollect">
            <template #icon>
              <n-icon :component="Heart" />
            </template>
            {{ collected ? "取消收藏" : "收藏" }}
          </n-button>
          <n-button secondary round block @click="openShareDialog">
            <template #icon>
              <n-icon :component="Share2" />
            </template>
            分享
          </n-button>
        </div>
      </aside>

      <main class="info-panel">
        <div class="type-row">
          <span>{{ song ? "歌曲详情" : "歌单详情" }}</span>
          <span>{{ sourceLabel }}</span>
          <span v-if="shareRecord">来自分享</span>
        </div>
        <h1 :title="title">{{ title }}</h1>
        <p class="subtitle" :title="subtitle">{{ subtitle || "暂无描述" }}</p>

        <div class="meta-grid">
          <div v-for="item in metaItems" :key="item.label" class="meta-item">
            <span>{{ item.label }}</span>
            <strong :title="item.value">{{ item.value || "暂无" }}</strong>
          </div>
        </div>

        <div v-if="shareRecord" class="share-card">
          <div>
            <span>分享人</span>
            <strong>{{ shareRecord.sharer.username || "PisaMusic 用户" }}</strong>
          </div>
          <div>
            <span>分享时间</span>
            <strong>{{ formatTime(shareRecord.createdAt) }}</strong>
          </div>
          <div>
            <span>访问次数</span>
            <strong>{{ shareRecord.accessCount }}</strong>
          </div>
        </div>
      </main>
    </section>

    <ShareDialog ref="shareDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NButton, NEmpty, NIcon, NSkeleton } from "naive-ui";
import { ArrowLeft, Heart, ListMusic, Play, Share2 } from "lucide-vue-next";
import type { CommonPlaylist, Song } from "@/types/song";
import ShareDialog from "@/components/common/ShareDialog.vue";
import { useCollectStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { defaultSongCover, formatDuration, formatTime, getKgImage, getSongCover } from "@/utils/common";
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
    return [
      { label: "歌手", value: song.value.singer },
      { label: "专辑", value: song.value.album },
      { label: "时长", value: formatDuration(song.value.duration) },
      { label: "来源", value: sourceLabel.value },
    ];
  }
  if (playlist.value) {
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

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    void router.push("/");
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
  width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.back-button {
  align-self: flex-start;
}

.state-panel,
.detail-shell {
  width: min(1180px, 100%);
  margin: 0 auto;
}

.state-panel {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 32px;
  align-items: center;
  padding: 24px;
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

.detail-shell {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  gap: 28px;
  align-items: stretch;
}

.cover-panel,
.info-panel {
  border: 1px solid color-mix(in srgb, var(--color-border-default) 82%, transparent);
  border-radius: 24px;
  background: color-mix(in srgb, var(--color-bg-default) 58%, transparent);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(24px) saturate(128%);
}

.cover-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px;
}

.cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 22px;
  object-fit: cover;
  box-shadow: 0 18px 38px rgba(15, 23, 42, 0.18);
}

.action-stack {
  display: grid;
  gap: 10px;
}

.info-panel {
  min-width: 0;
  padding: 30px;
}

.type-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  span {
    height: 26px;
    padding: 0 10px;
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    font-size: 12px;
    font-weight: 800;
  }
}

h1 {
  margin: 18px 0 0;
  overflow-wrap: anywhere;
  color: var(--color-text-default);
  font-size: clamp(28px, 4vw, 46px);
  line-height: 1.12;
  letter-spacing: 0;
}

.subtitle {
  margin: 14px 0 0;
  color: var(--color-text-secondary);
  font-size: 16px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 30px;
}

.meta-item,
.share-card > div {
  min-width: 0;
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--color-border-default) 82%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-bg-default) 52%, transparent);

  span {
    color: var(--color-text-secondary);
    font-size: 12px;
    font-weight: 700;
  }

  strong {
    min-width: 0;
    overflow: hidden;
    color: var(--color-text-default);
    font-size: 15px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.share-card {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

@media (max-width: 900px) {
  .detail-shell,
  .state-panel {
    grid-template-columns: 1fr;
  }

  .cover-panel {
    max-width: 420px;
    width: 100%;
    margin: 0 auto;
  }

  .meta-grid,
  .share-card {
    grid-template-columns: 1fr;
  }
}
</style>
