<template>
  <div class="media-detail-page">
    <!-- Loading Skeleton State -->
    <div v-if="loading" class="state-panel">
      <div class="skeleton-cover-wrap">
        <n-skeleton class="skeleton-cover" />
      </div>
      <div class="skeleton-copy">
        <n-skeleton text width="120px" height="24px" round />
        <n-skeleton text width="60%" height="32px" round />
        <n-skeleton text width="35%" height="18px" round />
        <div class="skeleton-meta-grid">
          <n-skeleton text height="52px" round />
          <n-skeleton text height="52px" round />
          <n-skeleton text height="52px" round />
          <n-skeleton text height="52px" round />
        </div>
        <div class="skeleton-actions">
          <n-skeleton text width="130px" height="42px" round />
          <n-skeleton text width="90px" height="42px" round />
          <n-skeleton text width="90px" height="42px" round />
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="empty-state">
      <div class="error-card">
        <div class="error-icon-box">
          <n-icon :component="AlertCircle" size="28" />
        </div>
        <h2 class="error-title">{{ error }}</h2>
        <p class="error-desc">该分享可能已被取消、已过期，或当前网络无法连接到服务端</p>
        <div class="error-actions">
          <n-button v-if="isShareMode" type="primary" round @click="loadFromRoute">
            重试加载
          </n-button>
          <n-button secondary round @click="router.back()">
            返回上一页
          </n-button>
        </div>
      </div>
    </div>

    <!-- Main Detail Hero Stage -->
    <section v-else-if="song || playlist" class="detail-stage">
      <!-- Left Column: Vinyl Disk & Cover Stage -->
      <aside class="cover-stage-column">
        <div class="vinyl-showcase">
          <!-- Spinning Vinyl Disk -->
          <div class="vinyl-disk" aria-hidden="true">
            <div class="vinyl-grooves"></div>
            <div class="vinyl-label" :style="{ backgroundImage: `url(${coverUrl})` }">
              <div class="vinyl-center-hole"></div>
            </div>
          </div>

          <!-- Album Art Sleeve -->
          <div class="cover-sleeve">
            <img class="cover-img" :src="coverUrl" :alt="title" />
            <div class="cover-gloss-highlight"></div>
            <div class="cover-badge">
              <span class="badge-dot"></span>
              <span>{{ song ? "PISA TRACK" : "PLAYLIST" }}</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Right Column: Info, Meta Cards & Actions -->
      <main class="info-stage-column">
        <!-- Header & Category Kicker -->
        <header class="detail-header">
          <div class="kicker-badge">
            <n-icon :component="song ? Disc3 : ListMusic" size="14" />
            <span>{{ headingKicker }}</span>
          </div>

          <!-- Sharer Information Card if in Share Mode -->
          <div v-if="shareRecord" class="sharer-card">
            <n-avatar
              round
              :size="24"
              :src="shareRecord.sharer.avatarUrl || undefined"
              class="sharer-avatar"
            >
              {{ shareRecord.sharer.username?.slice(0, 1) || "P" }}
            </n-avatar>
            <span class="sharer-name">{{ shareRecord.sharer.username || "PisaMusic 用户" }} 分享</span>
            <span class="meta-dot"></span>
            <div class="view-count">
              <n-icon :component="Eye" size="13" />
              <span>{{ shareRecord.accessCount }} 次浏览</span>
            </div>
          </div>

          <!-- Title & Artist -->
          <h1 class="media-title" :title="title">{{ title }}</h1>
          <div class="media-subtitle" :title="subtitle">
            <n-icon :component="song ? User : Layers" size="14" class="sub-icon" />
            <span>{{ subtitle || "未知艺术家" }}</span>
          </div>
        </header>

        <!-- Modern Frosted Meta Cards Grid -->
        <div class="meta-grid">
          <div v-for="item in metaItems" :key="item.label" class="meta-card">
            <div class="meta-icon-pill">
              <n-icon :component="item.icon" size="15" />
            </div>
            <div class="meta-textbox">
              <span class="meta-label">{{ item.label }}</span>
              <strong class="meta-value" :title="item.value">{{ item.value || "暂无" }}</strong>
            </div>
          </div>
        </div>

        <!-- Action Buttons Row -->
        <div class="action-buttons-row">
          <n-button
            v-if="song"
            type="primary"
            class="play-main-btn"
            round
            @click="playSong"
          >
            <template #icon>
              <n-icon :component="Play" />
            </template>
            立即播放
          </n-button>

          <n-button
            v-else
            type="primary"
            class="play-main-btn"
            round
            @click="openPlaylistPage"
          >
            <template #icon>
              <n-icon :component="ListMusic" />
            </template>
            打开歌单
          </n-button>

          <n-button
            secondary
            class="action-pill-btn collect-btn"
            :class="{ 'is-collected': collected }"
            round
            @click="toggleCollect"
          >
            <template #icon>
              <n-icon :component="Heart" :color="collected ? '#ff4d6d' : undefined" />
            </template>
            {{ collected ? "已收藏" : "收藏" }}
          </n-button>

          <n-button
            v-if="song"
            secondary
            class="action-pill-btn"
            round
            @click="openDownload"
          >
            <template #icon>
              <n-icon :component="Download" />
            </template>
            下载
          </n-button>

          <n-button
            secondary
            class="action-pill-btn"
            round
            @click="openShareDialog"
          >
            <template #icon>
              <n-icon :component="Share2" />
            </template>
            分享
          </n-button>
        </div>
      </main>
    </section>

    <!-- Share Dialog & Download Dialog -->
    <ShareDialog ref="shareDialogRef" />
    <DownloadSongDialog :ref="songDownload.downloadDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { NAvatar, NButton, NIcon, NSkeleton } from "naive-ui";
import {
  AlertCircle,
  Clock,
  Disc3,
  Download,
  Eye,
  Heart,
  Layers,
  ListMusic,
  Play,
  Radio,
  Share2,
  User,
} from "lucide-vue-next";
import type { CommonPlaylist, Song } from "@/types/song";
import ShareDialog from "@/components/common/ShareDialog.vue";
import DownloadSongDialog from "@/components/player/DownloadSongDialog.vue";
import { useCollectStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { useSongDownload } from "@/composables/useSongDownload";
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
const songDownload = useSongDownload();
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
  if (shareRecord.value) {
    return song.value ? `歌曲分享 · ${sourceLabel.value}` : `歌单分享 · ${sourceLabel.value}`;
  }
  return song.value ? `歌曲详情 · ${sourceLabel.value}` : `歌单详情 · ${sourceLabel.value}`;
});

const collected = computed(() => {
  if (song.value) return collector.containsSong(song.value);
  if (playlist.value) return collector.containsPlaylist(playlist.value);
  return false;
});

const coverUrl = computed(() => {
  if (song.value) return getSongCover(song.value, 480);
  if (!playlist.value) return defaultSongCover;
  if (playlist.value.source === "kg") return getKgImage(playlist.value.cover, 480);
  return playlist.value.coverSize?.l || playlist.value.cover || defaultPlaylistCover;
});

const metaItems = computed(() => {
  if (song.value) {
    if (shareRecord.value) {
      return [
        { label: "歌手", value: song.value.singer || shareRecord.value.description, icon: User },
        { label: "专辑", value: song.value.album || "单曲", icon: Disc3 },
        { label: "时长", value: formatDuration(song.value.duration), icon: Clock },
        { label: "来源", value: sourceLabel.value, icon: Radio },
      ];
    }
    return [
      { label: "歌手", value: song.value.singer || "未知歌手", icon: User },
      { label: "专辑", value: song.value.album || "单曲", icon: Disc3 },
      { label: "时长", value: formatDuration(song.value.duration), icon: Clock },
      { label: "来源", value: sourceLabel.value, icon: Radio },
    ];
  }
  if (playlist.value) {
    if (shareRecord.value) {
      return [
        { label: "分享人", value: shareRecord.value.sharer.username || "PisaMusic 用户", icon: User },
        { label: "歌曲数", value: `${playlist.value.song_count || 0} 首`, icon: ListMusic },
        { label: "来源", value: sourceLabel.value, icon: Radio },
        { label: "访问次数", value: `${shareRecord.value.accessCount} 次`, icon: Eye },
      ];
    }
    return [
      { label: "歌曲数量", value: `${playlist.value.song_count || 0} 首`, icon: ListMusic },
      { label: "播放量", value: String(playlist.value.play_count || "0"), icon: Play },
      { label: "收藏量", value: String(playlist.value.collect_count || "0"), icon: Heart },
      { label: "来源", value: sourceLabel.value, icon: Radio },
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
    error.value = cleanErrorMessage(err);
  } finally {
    loading.value = false;
  }
}

function cleanErrorMessage(raw: unknown): string {
  const message = raw instanceof Error ? raw.message : typeof raw === "string" ? raw : "";
  if (!message) return "分享不存在或已失效";
  const match = message.match(/(?:Error:\s*)+([^]+)$/);
  const text = (match ? match[1] : message).trim();
  return text || "分享不存在或已失效";
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

function openDownload() {
  if (!song.value) return;
  songDownload.openDownloadDialog(song.value);
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
  width: 100%;
  min-height: 100%;
  padding: clamp(24px, 4vw, 56px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
}

/* Detail Content Layout */
.detail-stage {
  position: relative;
  width: min(920px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(230px, 280px) minmax(0, 1fr);
  gap: clamp(32px, 5vw, 60px);
  align-items: center;
}

/* Left: Vinyl & Cover Stage */
.cover-stage-column {
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: center;
}

.vinyl-showcase {
  position: relative;
  width: min(250px, 100%);
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vinyl-disk {
  position: absolute;
  top: 50%;
  right: -22px;
  transform: translateY(-50%);
  width: 90%;
  height: 90%;
  border-radius: 50%;
  background: radial-gradient(circle, #1c1c1c 0%, #141414 55%, #080808 100%);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.35),
    0 0 0 2px rgba(255, 255, 255, 0.04);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: rotate-vinyl 20s linear infinite;
  z-index: 1;

  .vinyl-grooves {
    position: absolute;
    inset: 10px;
    border-radius: 50%;
    border: 1px dashed rgba(255, 255, 255, 0.14);
    box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.02) inset;
  }

  .vinyl-label {
    position: relative;
    width: 32%;
    height: 32%;
    border-radius: 50%;
    background-size: cover;
    background-position: center;
    border: 2px solid #1c1c1c;
    box-shadow: 0 0 8px rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;

    .vinyl-center-hole {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #000;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }
  }
}

.cover-sleeve {
  position: relative;
  z-index: 2;
  width: 100%;
  height: 100%;
  border-radius: 20px;
  overflow: hidden;
  box-shadow:
    0 14px 36px rgba(0, 0, 0, 0.2),
    0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--color-border-default);
  transition: transform 0.3s ease;

  &:hover {
    transform: translateY(-2px);
  }

  .cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .cover-gloss-highlight {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, transparent 55%);
    pointer-events: none;
  }

  .cover-badge {
    position: absolute;
    bottom: 10px;
    left: 10px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(8px);
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 0.06em;
    color: #fff;

    .badge-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--color-primary);
      box-shadow: 0 0 6px var(--color-primary);
    }
  }
}

/* Right: Info Stage */
.info-stage-column {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kicker-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 3px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.04em;
}

.sharer-card {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 3px 12px 3px 4px;
  border-radius: 999px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border-default);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);

  .sharer-avatar {
    background: var(--color-primary);
    color: #fff;
    font-weight: 700;
  }

  .meta-dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background: var(--color-text-third);
  }

  .view-count {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--color-text-third);
  }
}

.media-title {
  margin: 0;
  font-size: clamp(20px, 2.4vw, 28px);
  font-weight: 750;
  line-height: 1.25;
  letter-spacing: -0.015em;
  color: var(--color-text-default);
  overflow-wrap: anywhere;
}

.media-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-secondary);

  .sub-icon {
    color: var(--color-primary);
    flex-shrink: 0;
  }

  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

/* Modern Frosted Meta Cards Grid */
.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
}

.meta-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border-default);
  transition: all 0.2s ease;

  &:hover {
    background: var(--color-item-hover);
    border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border-default));
  }

  .meta-icon-pill {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .meta-textbox {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .meta-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--color-text-third);
    }

    .meta-value {
      font-size: 13px;
      font-weight: 700;
      color: var(--color-text-default);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

/* Action Buttons */
.action-buttons-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 4px;

  :deep(.n-button) {
    height: 40px;
    font-size: 13.5px;
    font-weight: 700;
    padding: 0 18px;
  }

  .play-main-btn {
    padding: 0 24px;
  }

  .action-pill-btn {
    &.is-collected {
      color: #ff4d6d;
      border-color: rgba(255, 77, 109, 0.3);
      background: rgba(255, 77, 109, 0.08);
    }
  }
}

/* Skeleton State */
.state-panel {
  width: min(920px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(230px, 280px) minmax(0, 1fr);
  gap: clamp(32px, 5vw, 60px);
  align-items: center;
}

.skeleton-cover-wrap {
  aspect-ratio: 1;
  width: 100%;
}

.skeleton-cover {
  width: 100%;
  height: 100%;
  border-radius: 20px;
}

.skeleton-copy {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.skeleton-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 6px;
}

.skeleton-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

/* Error State */
.empty-state {
  flex: 1;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 36px 32px;
  border-radius: 20px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border-default);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
  max-width: 400px;
  width: 100%;

  .error-icon-box {
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }

  .error-title {
    margin: 0 0 8px;
    font-size: 17px;
    font-weight: 700;
    color: var(--color-text-default);
  }

  .error-desc {
    margin: 0 0 20px;
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .error-actions {
    display: flex;
    gap: 10px;
  }
}

/* Animations */
@keyframes rotate-vinyl {
  0% { transform: translateY(-50%) rotate(0deg); }
  100% { transform: translateY(-50%) rotate(360deg); }
}

/* Responsive */
@media (max-width: 800px) {
  .detail-stage,
  .state-panel {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .cover-stage-column {
    max-width: 240px;
    margin: 0 auto;
  }
}

@media (max-width: 540px) {
  .media-detail-page {
    padding: 16px 12px;
  }

  .meta-grid {
    grid-template-columns: 1fr 1fr;
  }

  .action-buttons-row {
    display: grid;
    grid-template-columns: 1fr 1fr;

    .play-main-btn {
      grid-column: 1 / -1;
    }
  }
}
</style>
