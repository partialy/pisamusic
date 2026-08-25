<template>
  <Teleport to="body">
    <Transition name="share-modal">
      <div v-if="show" class="share-overlay" @click.self="close">
        <div class="share-panel" role="dialog" aria-modal="true" @click.stop>
          <!-- Ambient Glow Effect -->
          <div class="ambient-glow" :style="{ backgroundImage: `url(${cover})` }"></div>

          <!-- Header -->
          <header class="share-header">
            <div class="header-badge">
              <span class="pulse-dot"></span>
              <span class="badge-text">PISA MUSIC SHARE</span>
            </div>
            <button class="close-btn" type="button" aria-label="关闭" @click="close">
              <n-icon :component="X" size="18" />
            </button>
          </header>

          <div class="share-body">
            <!-- Hero Music Card -->
            <div class="music-hero-card">
              <div class="cover-vinyl-wrapper">
                <div class="vinyl-record" :class="{ 'is-spinning': !loading && !error }">
                  <div class="vinyl-groove"></div>
                  <div class="vinyl-center"></div>
                </div>
                <div class="cover-art">
                  <img :src="cover" :alt="title" />
                  <div class="cover-gloss"></div>
                </div>
              </div>

              <div class="music-details">
                <div class="type-tag">
                  <n-icon :component="target?.type === 'song' ? Music : ListMusic" size="13" />
                  <span>{{ target?.type === "song" ? "单曲分享" : "歌单分享" }}</span>
                </div>
                <h3 class="music-title" :title="title">{{ title }}</h3>
                <p class="music-artist" :title="description">{{ description || "未知艺术家" }}</p>

                <!-- Mini Animated Equalizer Wave -->
                <div class="equalizer-bars" aria-hidden="true">
                  <span class="bar bar-1"></span>
                  <span class="bar bar-2"></span>
                  <span class="bar bar-3"></span>
                  <span class="bar bar-4"></span>
                </div>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="state-container loading-state">
              <div class="loading-spinner">
                <div class="spinner-ring"></div>
                <n-icon :component="Sparkles" class="spinner-icon" size="20" />
              </div>
              <p class="state-text">正在生成专属分享链接与二维码...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="state-container error-state">
              <div class="error-icon-box">!</div>
              <p class="error-message">{{ error }}</p>
              <div class="error-actions">
                <n-button v-if="isLoginRequiredError" type="primary" round size="small" @click="handleLoginAndRetry">
                  登录 PisaMusic 账号
                </n-button>
                <n-button v-else type="primary" round size="small" @click="retry">重新生成</n-button>
              </div>
            </div>

            <!-- Ready Share Content -->
            <div v-else-if="shareUrl" class="share-content">
              <!-- QR Code Card -->
              <div class="qr-presentation-card">
                <div class="qr-frame">
                  <QrcodeVue :value="shareUrl" :size="160" level="H" class="qrcode-canvas" />
                </div>
                <div class="qr-footer">
                  <n-icon :component="Radio" size="14" />
                  <span>手机扫码直达 · 在移动设备收听</span>
                </div>
              </div>

              <!-- Link & Actions -->
              <div class="link-and-actions">
                <div class="link-input-box" @click="copyShareUrl">
                  <span class="link-label">链接</span>
                  <input
                    :value="shareUrl"
                    readonly
                    aria-label="分享链接"
                    @focus="selectLinkInput"
                  />
                  <button class="mini-copy-btn" type="button" :title="copied ? '已复制' : '复制链接'">
                    <n-icon :component="copied ? Check : Copy" size="15" />
                    <span>{{ copied ? "已复制" : "复制" }}</span>
                  </button>
                </div>

                <div class="action-buttons-row">
                  <n-button
                    type="primary"
                    class="main-copy-btn"
                    round
                    @click="copyShareUrl"
                  >
                    <template #icon>
                      <n-icon :component="copied ? Check : Copy" />
                    </template>
                    {{ copied ? "已复制链接" : "一键复制分享链接" }}
                  </n-button>

                  <n-button
                    secondary
                    class="browser-btn"
                    round
                    @click="openInBrowser"
                  >
                    <template #icon>
                      <n-icon :component="ExternalLink" />
                    </template>
                    浏览器打开
                  </n-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NIcon } from "naive-ui";
import QrcodeVue from "qrcode.vue";
import { Check, Copy, ExternalLink, ListMusic, Music, Radio, Sparkles, X } from "lucide-vue-next";
import type { CommonPlaylist, Song } from "@/types/song";
import { defaultSongCover, getKgImage, getSongCover } from "@/utils/common";
import defaultPlaylistCover from "@/assets/images/default-created-playlist-cover.svg";
import { createPlaylistShare, createSongShare } from "@/share/shareApi";
import { useUserStore } from "@/store";
import { useAccountLoginDialog } from "@/composables/useAccountLoginDialog";

type ShareTarget =
  | { type: "song"; data: Song }
  | { type: "playlist"; data: CommonPlaylist };

const userStore = useUserStore();
const { openAccountLogin } = useAccountLoginDialog();

const show = ref(false);
const loading = ref(false);
const error = ref("");
const shareUrl = ref("");
const copied = ref(false);
const target = ref<ShareTarget | null>(null);

let copyTimer: NodeJS.Timeout | null = null;

const isLoginRequiredError = computed(() => {
  return error.value.includes("登录") || !userStore.isLogin;
});

function handleLoginAndRetry() {
  openAccountLogin();
}

watch(
  () => userStore.isLogin,
  (loggedIn) => {
    if (loggedIn && show.value && (!shareUrl.value || error.value)) {
      void createShare();
    }
  },
);

const title = computed(() => {
  if (!target.value) return "音乐分享";
  return target.value.type === "song" ? target.value.data.name : target.value.data.name;
});

const description = computed(() => {
  if (!target.value) return "";
  if (target.value.type === "song") return target.value.data.singer || "未知歌手";
  return target.value.data.desc || `${target.value.data.song_count || 0} 首歌曲`;
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
  copied.value = false;
  show.value = true;
  void createShare();
}

function close() {
  show.value = false;
  copied.value = false;
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
  copied.value = true;
  window.$message?.success("分享链接已复制到剪贴板");
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copied.value = false;
  }, 2500);
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
  background: rgba(10, 15, 26, 0.68);
  backdrop-filter: blur(20px) saturate(140%);
}

.share-panel {
  position: relative;
  width: min(480px, calc(100vw - 32px));
  overflow: hidden;
  border-radius: 26px;
  background: var(--color-bg-track);
  border: 1px solid color-mix(in srgb, var(--color-border-default) 80%, rgba(255, 255, 255, 0.16));
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.38),
    0 0 0 1px color-mix(in srgb, var(--color-primary) 12%, transparent) inset;
  display: flex;
  flex-direction: column;
}

.ambient-glow {
  position: absolute;
  top: -80px;
  left: 50%;
  transform: translateX(-50%);
  width: 380px;
  height: 240px;
  background-size: cover;
  background-position: center;
  filter: blur(64px) saturate(180%);
  opacity: 0.28;
  pointer-events: none;
  border-radius: 50%;
}

.share-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 14px;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-primary) 28%, transparent);

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-primary);
    box-shadow: 0 0 8px var(--color-primary);
    animation: pulse-glow 2s infinite ease-in-out;
  }

  .badge-text {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--color-primary);
  }
}

.close-btn {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-bg-default) 60%, transparent);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: color-mix(in srgb, var(--color-bg-default) 95%, transparent);
    color: var(--color-text-default);
    transform: rotate(90deg);
  }
}

.share-body {
  position: relative;
  z-index: 1;
  padding: 0 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Hero Music Card */
.music-hero-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 18px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--color-bg-default) 70%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border-default) 60%, rgba(255, 255, 255, 0.08));
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.cover-vinyl-wrapper {
  position: relative;
  flex-shrink: 0;
  width: 90px;
  height: 90px;
}

.vinyl-record {
  position: absolute;
  top: 5px;
  right: -14px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: radial-gradient(circle, #1a1a1a 0%, #111 60%, #000 100%);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.4s ease;

  &.is-spinning {
    animation: rotate-vinyl 14s linear infinite;
  }

  .vinyl-groove {
    position: absolute;
    inset: 6px;
    border-radius: 50%;
    border: 1px dashed rgba(255, 255, 255, 0.15);
  }

  .vinyl-center {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--color-primary);
    border: 3px solid #111;
  }
}

.cover-art {
  position: relative;
  z-index: 2;
  width: 90px;
  height: 90px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .cover-gloss {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, transparent 60%);
    pointer-events: none;
  }
}

.music-details {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.type-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.music-title {
  margin: 0;
  font-size: 16px;
  font-weight: 750;
  line-height: 1.3;
  color: var(--color-text-default);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.music-artist {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.equalizer-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 12px;
  margin-top: 4px;

  .bar {
    width: 3px;
    border-radius: 2px;
    background: var(--color-primary);
    opacity: 0.85;
    animation: bounce-wave 1.2s ease-in-out infinite alternate;
  }
  .bar-1 { height: 40%; animation-delay: 0.1s; }
  .bar-2 { height: 90%; animation-delay: 0.35s; }
  .bar-3 { height: 60%; animation-delay: 0.2s; }
  .bar-4 { height: 80%; animation-delay: 0.45s; }
}

/* States */
.state-container {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 20px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-bg-default) 40%, transparent);
}

.loading-spinner {
  position: relative;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;

  .spinner-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid color-mix(in srgb, var(--color-primary) 15%, transparent);
    border-top-color: var(--color-primary);
    animation: spin 1s linear infinite;
  }

  .spinner-icon {
    color: var(--color-primary);
    animation: pulse-glow 1.5s infinite;
  }
}

.state-text {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary);
  font-weight: 550;
}

.error-state {
  .error-icon-box {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(224, 49, 49, 0.15);
    color: #e03131;
    font-size: 20px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .error-message {
    margin: 0;
    color: #e03131;
    font-size: 13px;
    font-weight: 600;
  }
}

/* Ready Share Content */
.share-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.qr-presentation-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--color-bg-default) 50%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-border-default) 50%, transparent);

  .qr-frame {
    padding: 12px;
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.14);
    display: flex;
    align-items: center;
    justify-content: center;

    .qrcode-canvas {
      display: block;
      border-radius: 6px;
    }
  }

  .qr-footer {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }
}

.link-and-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.link-input-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px 4px 14px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-bg-default) 80%, transparent);
  border: 1px solid var(--color-border-default);
  transition: border-color 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: var(--color-primary);
  }

  .link-label {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--color-primary);
    flex-shrink: 0;
  }

  input {
    min-width: 0;
    flex: 1;
    height: 30px;
    border: none;
    background: transparent;
    font-size: 13px;
    color: var(--color-text-default);
    outline: none;
    cursor: pointer;
  }

  .mini-copy-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 30px;
    padding: 0 10px;
    border-radius: 10px;
    border: none;
    background: color-mix(in srgb, var(--color-primary) 14%, transparent);
    color: var(--color-primary);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: color-mix(in srgb, var(--color-primary) 22%, transparent);
    }
  }
}

.action-buttons-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 10px;

  :deep(.n-button) {
    height: 40px;
    font-weight: 700;
    font-size: 13px;
  }

  .main-copy-btn {
    box-shadow: 0 8px 20px color-mix(in srgb, var(--color-primary) 28%, transparent);
  }
}

/* Animations */
@keyframes rotate-vinyl {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes bounce-wave {
  0% { height: 25%; }
  100% { height: 100%; }
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse-glow {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.9); }
}

.share-modal-enter-active,
.share-modal-leave-active {
  transition: opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1);

  .share-panel {
    transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  }
}

.share-modal-enter-from,
.share-modal-leave-to {
  opacity: 0;

  .share-panel {
    opacity: 0;
    transform: scale(0.94) translateY(14px);
  }
}
</style>
