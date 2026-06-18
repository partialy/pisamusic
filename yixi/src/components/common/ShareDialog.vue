<template>
  <Teleport to="body">
    <Transition name="share-dialog">
      <div v-if="show" class="share-overlay" @click.self="close">
        <section class="share-panel" role="dialog" aria-modal="true" @click.stop>
          <header class="share-header">
            <div>
              <div class="share-kicker">分享</div>
              <h2>{{ title }}</h2>
            </div>
            <button class="icon-button" type="button" aria-label="关闭" @click="close">
              <n-icon :component="X" />
            </button>
          </header>

          <div class="share-body">
            <div class="media-row">
              <img :src="cover" :alt="title" />
              <div class="media-copy">
                <strong :title="title">{{ title }}</strong>
                <span :title="description">{{ description || "暂无描述" }}</span>
              </div>
            </div>

            <div v-if="loading" class="share-state">正在创建分享...</div>
            <div v-else-if="error" class="share-error">
              <span>{{ error }}</span>
              <n-button secondary size="small" @click="retry">重试</n-button>
            </div>
            <div v-else-if="shareUrl" class="share-result">
              <div class="qr-box">
                <QrcodeVue :value="shareUrl" :size="180" level="M" />
              </div>
              <div class="link-row">
                <input :value="shareUrl" readonly aria-label="分享链接" @focus="selectLinkInput" />
                <n-button secondary @click="copyShareUrl">
                  <template #icon>
                    <n-icon :component="Copy" />
                  </template>
                  复制
                </n-button>
              </div>
              <n-button tertiary class="open-button" @click="openInBrowser">
                <template #icon>
                  <n-icon :component="ExternalLink" />
                </template>
                在浏览器打开
              </n-button>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NIcon } from "naive-ui";
import QrcodeVue from "qrcode.vue";
import { Copy, ExternalLink, X } from "lucide-vue-next";
import type { CommonPlaylist, Song } from "@/types/song";
import { defaultSongCover, getKgImage, getSongCover } from "@/utils/common";
import defaultPlaylistCover from "@/assets/images/default-created-playlist-cover.svg";
import { createPlaylistShare, createSongShare } from "@/share/shareApi";

type ShareTarget =
  | { type: "song"; data: Song }
  | { type: "playlist"; data: CommonPlaylist };

const show = ref(false);
const loading = ref(false);
const error = ref("");
const shareUrl = ref("");
const target = ref<ShareTarget | null>(null);

const title = computed(() => {
  if (!target.value) return "音乐分享";
  return target.value.type === "song" ? target.value.data.name : target.value.data.name;
});

const description = computed(() => {
  if (!target.value) return "";
  if (target.value.type === "song") return target.value.data.singer || "未知歌手";
  return target.value.data.desc || `${target.value.data.song_count || 0} 首`;
});

const cover = computed(() => {
  const current = target.value;
  if (!current) return defaultSongCover;
  if (current.type === "song") return getSongCover(current.data, 240);
  if (current.data.source === "kg") return getKgImage(current.data.cover, 240);
  return current.data.coverSize?.m || current.data.cover || defaultPlaylistCover;
});

function openForSong(song: Song) {
  target.value = { type: "song", data: song };
  open();
}

function openForPlaylist(playlist: CommonPlaylist) {
  target.value = { type: "playlist", data: playlist };
  open();
}

function open() {
  show.value = true;
  void createShare();
}

function close() {
  show.value = false;
}

function retry() {
  void createShare();
}

async function createShare() {
  const current = target.value;
  if (!current) return;
  loading.value = true;
  error.value = "";
  shareUrl.value = "";
  try {
    const result = current.type === "song"
      ? await createSongShare(current.data)
      : await createPlaylistShare(current.data);
    shareUrl.value = result.shareUrl;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "创建分享失败";
  } finally {
    loading.value = false;
  }
}

async function copyShareUrl() {
  if (!shareUrl.value) return;
  try {
    await navigator.clipboard.writeText(shareUrl.value);
  } catch {
    const input = document.createElement("textarea");
    input.value = shareUrl.value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    document.body.removeChild(input);
  }
  window.$message?.success("分享链接已复制");
}

function openInBrowser() {
  if (!shareUrl.value) return;
  void window.electronAPI.openUrl({ url: shareUrl.value, mode: "external" });
}

function selectLinkInput(event: FocusEvent) {
  const input = event.target;
  if (input instanceof HTMLInputElement) input.select();
}

defineExpose({ openForSong, openForPlaylist });
</script>

<style scoped lang="scss">
.share-overlay {
  position: fixed;
  inset: 0;
  z-index: 2400;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.38);
  backdrop-filter: blur(16px) saturate(118%);
}

.share-panel {
  width: min(560px, calc(100vw - 32px));
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--color-bg-default) 70%, transparent);
  border-radius: 22px;
  background: var(--color-bg-track);
  box-shadow: 0 28px 82px rgba(10, 18, 32, 0.26);
}

.share-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 14px;

  h2 {
    margin: 4px 0 0;
    color: var(--color-text-default);
    font-size: 22px;
    line-height: 1.25;
  }
}

.share-kicker {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 800;
}

.icon-button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
}

.share-body {
  padding: 0 24px 24px;
}

.media-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 12px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-primary) 7%, transparent);

  img {
    width: 72px;
    height: 72px;
    border-radius: 16px;
    object-fit: cover;
  }
}

.media-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;

  strong,
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--color-text-default);
    font-size: 17px;
  }

  span {
    color: var(--color-text-secondary);
    font-size: 13px;
  }
}

.share-state,
.share-error {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--color-text-secondary);
}

.share-error {
  color: #d03050;
}

.share-result {
  display: grid;
  gap: 16px;
  padding-top: 18px;
}

.qr-box {
  justify-self: center;
  padding: 14px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.12);
}

.link-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;

  input {
    min-width: 0;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--color-border-default);
    border-radius: 999px;
    color: var(--color-text-default);
    background: color-mix(in srgb, var(--color-bg-default) 72%, transparent);
  }
}

.open-button {
  justify-self: center;
}

.share-dialog-enter-active,
.share-dialog-leave-active {
  transition: opacity 0.18s ease;

  .share-panel {
    transition:
      transform 0.18s ease,
      opacity 0.18s ease;
  }
}

.share-dialog-enter-from,
.share-dialog-leave-to {
  opacity: 0;

  .share-panel {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}
</style>
