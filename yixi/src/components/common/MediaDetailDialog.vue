<template>
  <Teleport to="body">
    <Transition name="media-detail-dialog">
      <div v-if="show" class="detail-overlay" @click.self="closeDialog">
        <section class="detail-panel" role="dialog" aria-modal="true" @click.stop>
          <header class="detail-header">
            <div class="detail-title">
              <div class="title-icon">
                <n-icon :component="Info" />
              </div>
              <span>{{ dialogTitle }}</span>
            </div>
            <button class="close-btn" type="button" aria-label="关闭" @click="closeDialog">
              <n-icon :component="X" />
            </button>
          </header>

          <div v-if="song" class="detail-body">
            <div class="hero-row">
              <img class="cover-img" :src="songCover" :alt="song.name" />
              <div class="hero-info">
                <div class="hero-name" :title="song.name">{{ song.name || "未知歌曲" }}</div>
                <div class="hero-sub" :title="song.singer">{{ song.singer || "未知歌手" }}</div>
                <div class="hero-tags">
                  <span>{{ sourceLabel(song.source) }}</span>
                  <span>{{ collector.containsSong(song) ? "已收藏" : "未收藏" }}</span>
                  <span v-if="song.vip">VIP</span>
                </div>
              </div>
            </div>

            <div class="description-block">
              <div class="description-title">信息</div>
              <button
                class="description-content"
                type="button"
                :title="songDescription"
                @click="copyFieldValue(songDescription)">
                {{ songDescription }}
              </button>
            </div>
          </div>

          <div v-else-if="playlist" class="detail-body">
            <div class="hero-row">
              <img class="cover-img" :src="playlistCover" :alt="playlist.name" />
              <div class="hero-info">
                <div class="hero-name" :title="playlist.name">{{ playlist.name || "未知歌单" }}</div>
                <div class="hero-sub" :title="playlist.desc">{{ playlist.desc || "暂无描述" }}</div>
                <div class="hero-tags">
                  <span>{{ sourceLabel(playlist.source) }}</span>
                  <span>{{ collector.containsPlaylist(playlist) ? "已收藏" : "未收藏" }}</span>
                  <span>{{ playlist.song_count || 0 }} 首</span>
                </div>
              </div>
            </div>

            <div class="description-block">
              <div class="description-title">描述</div>
              <button
                class="description-content"
                type="button"
                :title="playlist.desc || '暂无描述'"
                @click="copyFieldValue(playlist.desc || '暂无描述')">
                {{ playlist.desc || "暂无描述" }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NIcon } from "naive-ui";
import { Info, X } from "lucide-vue-next";
import type { CommonPlaylist, Song } from "@/types/song";
import { useCollectStore } from "@/store";
import { defaultSongCover, getKgImage, getSongCover } from "@/utils/common";
import defaultPlaylistCover from "@/assets/images/default-created-playlist-cover.svg";

type DetailFieldItem = {
  label: string;
  value: string | number | boolean | null | undefined;
};

const collector = useCollectStore();
const show = ref(false);
const song = ref<Song | null>(null);
const playlist = ref<CommonPlaylist | null>(null);
const localCover = ref("");
const localCoverLoading = ref(false);

const dialogTitle = computed(() => (song.value ? "歌曲详情" : "歌单详情"));
const songCover = computed(() => {
  if (!song.value) return defaultSongCover;
  if (song.value.source === "local" && localCover.value) return localCover.value;
  return getSongCover(song.value, 240);
});
const playlistCover = computed(() => {
  const target = playlist.value;
  if (!target) return defaultPlaylistCover;
  if (target.source === "kg") return getKgImage(target.cover, 240);
  return target.coverSize?.m || target.cover || defaultPlaylistCover;
});
const songPath = computed(() => {
  const target = song.value;
  if (!target) return "";
  if (target.source === "local") return target.filePath || target.urlParam || "暂无";
  return "在线音源";
});
const songCoverSource = computed(() => {
  const target = song.value;
  if (!target) return "";
  if (target.source !== "local") {
    return target.cover || target.coverSize ? "在线封面" : "默认封面";
  }
  if (localCoverLoading.value) return "正在读取内嵌封面";
  if (localCover.value) return "来自内嵌封面";
  return "无内嵌封面，使用默认封面";
});
const songDescription = computed(() => [
  `音源：${sourceLabel(song.value?.source)}`,
  `路径：${songPath.value}`,
  `封面来源：${songCoverSource.value}`,
].join("\n"));

function openSong(target: Song) {
  song.value = target;
  playlist.value = null;
  localCover.value = "";
  show.value = true;
  void loadLocalCover(target);
}

function openPlaylist(target: CommonPlaylist) {
  playlist.value = target;
  song.value = null;
  localCover.value = "";
  show.value = true;
}

function closeDialog() {
  show.value = false;
}

async function loadLocalCover(target: Song) {
  if (target.source !== "local") return;
  const filePath = target.filePath || target.urlParam;
  if (!filePath) return;
  localCoverLoading.value = true;
  try {
    const cover = await window.electronAPI.getLocalSongCover(filePath);
    if (song.value?.id === target.id) localCover.value = cover || "";
  } finally {
    localCoverLoading.value = false;
  }
}

function sourceLabel(source?: Song["source"] | CommonPlaylist["source"]) {
  const labels: Record<string, string> = {
    kg: "KG",
    wy: "WY",
    kw: "KW",
    qq: "QQ",
    local: "本地",
  };
  return source ? labels[source] || source.toUpperCase() : "未知";
}

function stringifyValue(value: DetailFieldItem["value"]) {
  if (value === undefined || value === null || value === "") return "暂无";
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

async function copyFieldValue(value: DetailFieldItem["value"]) {
  const text = stringifyValue(value);
  if (!text || text === "暂无") return;
  try {
    await navigator.clipboard.writeText(text);
    window.$message?.success("已复制");
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
    window.$message?.success("已复制");
  }
}

defineExpose({ openSong, openPlaylist });
</script>

<style scoped lang="scss">
.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 2350;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(14px) saturate(118%);
}

.detail-panel {
  width: min(620px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow: hidden;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--color-bg-default) 74%, transparent);
  background: var(--color-bg-track);
  box-shadow:
    0 30px 86px rgba(10, 18, 32, 0.25),
    0 12px 34px rgba(10, 18, 32, 0.16);
  backdrop-filter: blur(28px) saturate(138%);
}

:global(:root[data-theme="dark"]) .detail-panel {
  border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
  box-shadow:
    0 34px 96px rgba(0, 0, 0, 0.46),
    0 14px 38px rgba(0, 0, 0, 0.3);
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 12px;
}

.detail-title {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--color-text-default);
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0;
}

.title-icon {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.close-btn {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background-color 0.18s ease;

  &:hover {
    color: var(--color-text-default);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
  }
}

.detail-body {
  max-height: calc(100vh - 132px);
  overflow: auto;
  padding: 10px 24px 24px;
}

.hero-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  padding: 12px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-primary) 7%, transparent);
}

.cover-img {
  width: 92px;
  height: 92px;
  border-radius: 18px;
  object-fit: cover;
  box-shadow: 0 12px 28px rgba(10, 18, 32, 0.16);
}

.hero-info {
  min-width: 0;
}

.hero-name {
  overflow: hidden;
  color: var(--color-text-default);
  font-size: 19px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-sub {
  margin-top: 6px;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;

  span {
    min-width: 0;
    max-width: 160px;
    height: 24px;
    padding: 0 9px;
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    font-size: 12px;
    font-weight: 700;
  }
}

.field-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;

  &.compact {
    margin-top: 10px;
  }
}

.detail-field {
  min-width: 0;
  max-width: 100%;
  height: 45px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--color-border-default) 82%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-bg-default) 44%, transparent);
  overflow: hidden;

  &.wide {
    grid-column: 1 / -1;
  }
}

.field-label {
  width: 120px;
  flex: 0 0 120px;
  overflow: hidden;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-value {
  flex: 1 1 auto;
  width: calc(100% - 120px);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
  color: var(--color-text-default);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.field-value-button {
  display: block;
  padding: 0;
  border: 0;
  text-align: left;
  background: transparent;
  cursor: copy;
}

.field-value-button:hover {
  color: var(--color-primary);
}

.description-block {
  min-width: 0;
  margin-top: 16px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, var(--color-border-default) 82%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-bg-default) 44%, transparent);
}

.description-title {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.description-content {
  width: 100%;
  max-height: 260px;
  margin-top: 8px;
  padding: 0;
  overflow: auto;
  border: 0;
  color: var(--color-text-default);
  background: transparent;
  cursor: copy;
  font-size: 13px;
  line-height: 1.65;
  text-align: left;
  white-space: pre-wrap;
  word-break: break-word;
}

.media-detail-dialog-enter-active,
.media-detail-dialog-leave-active {
  transition: opacity 0.18s ease;

  .detail-panel {
    transition:
      transform 0.18s ease,
      opacity 0.18s ease;
  }
}

.media-detail-dialog-enter-from,
.media-detail-dialog-leave-to {
  opacity: 0;

  .detail-panel {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}
</style>
