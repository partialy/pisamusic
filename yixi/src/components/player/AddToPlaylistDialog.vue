<template>
  <Teleport to="body">
    <Transition name="add-playlist-dialog">
      <div v-if="show" class="add-dialog-overlay" @click.self="closeDialog">
        <section class="add-dialog-panel" role="dialog" aria-modal="true" @click.stop>
          <header class="dialog-header">
            <div class="dialog-title">
              <div class="title-icon">
                <n-icon :component="PlaylistAdd" />
              </div>
              <span>添加到歌单</span>
            </div>
            <button class="close-btn" type="button" aria-label="关闭" @click="closeDialog">
              <n-icon :component="X" />
            </button>
          </header>

          <div class="dialog-body">
            <div class="song-line">
              <img :src="coverUrl" :alt="song?.name || ''" />
              <div class="song-info">
                <div class="song-name" :title="song?.name || ''">{{ song?.name || "未知歌曲" }}</div>
                <div class="song-meta" :title="song?.singer || ''">{{ song?.singer || "未知歌手" }}</div>
              </div>
            </div>

            <div v-if="playlistOptions.length" class="form-row">
              <div class="label">歌单</div>
              <n-select
                v-model:value="playlistId"
                class="field-control"
                :to="false"
                :options="playlistOptions"
                placeholder="选择自建歌单" />
            </div>
            <div v-else class="empty-playlist">
              <div class="empty-title">还没有自建歌单</div>
              <div class="empty-desc">先新建一个歌单，再把这首歌放进去。</div>
              <n-button secondary class="create-empty-btn" @click="openCreateDialog">新建歌单</n-button>
            </div>
          </div>

          <footer class="dialog-actions">
            <n-button quaternary class="cancel-btn" @click="closeDialog">取消</n-button>
            <n-button
              class="confirm-btn"
              :disabled="!playlistOptions.length"
              :loading="submitting"
              @click="confirmAdd">
              确定
            </n-button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
  <CreatePlaylistDialog ref="createDialogRef" @created="handleCreated" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NButton, NIcon, NSelect } from "naive-ui";
import { X } from "lucide-vue-next";
import { PlaylistAdd } from "@/icons";
import CreatePlaylistDialog from "@/components/mine/CreatePlaylistDialog.vue";
import type { CommonPlaylist, Song } from "@/types/song";
import { defaultSongCover, getSongCover } from "@/utils/common";
import { useMineLibraryStore } from "@/store";

const store = useMineLibraryStore();
const show = ref(false);
const submitting = ref(false);
const song = ref<Song | null>(null);
const playlistId = ref("");
const createDialogRef = ref<InstanceType<typeof CreatePlaylistDialog> | null>(null);

const localPlaylists = computed(() => store.localPlaylists);
const playlistOptions = computed(() =>
  localPlaylists.value.map((playlist) => ({
    label: playlist.name,
    value: playlist.id,
  }))
);
const coverUrl = computed(() => song.value ? getSongCover(song.value) : defaultSongCover);

watch(
  playlistOptions,
  (options) => {
    if (!options.length) {
      playlistId.value = "";
      return;
    }
    if (!options.some((option) => option.value === playlistId.value)) {
      playlistId.value = options[0].value;
    }
  },
  { immediate: true }
);

async function open(target: Song | null | undefined) {
  if (!target) {
    window.$message.warning("当前没有可添加的歌曲");
    return;
  }
  await store.init();
  song.value = target;
  playlistId.value = playlistOptions.value[0]?.value || "";
  show.value = true;
}

function closeDialog() {
  if (submitting.value) return;
  show.value = false;
}

function openCreateDialog() {
  createDialogRef.value?.open();
}

async function handleCreated(playlist: CommonPlaylist) {
  playlistId.value = playlist.id;
}

async function confirmAdd() {
  if (!song.value || !playlistId.value) return;
  submitting.value = true;
  try {
    await store.addSongToPlaylist(playlistId.value, song.value);
    window.$message.success("已添加到歌单");
    show.value = false;
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : "添加到歌单失败");
  } finally {
    submitting.value = false;
  }
}

defineExpose({ open });
</script>

<style scoped lang="scss">
.add-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2250;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(14px) saturate(118%);
}

.add-dialog-panel {
  width: min(440px, calc(100vw - 32px));
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--color-bg-default) 74%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-bg-default) 94%, #fff 6%), color-mix(in srgb, var(--color-bg-secondary) 88%, #fff 12%));
  box-shadow:
    0 30px 86px rgba(10, 18, 32, 0.25),
    0 12px 34px rgba(10, 18, 32, 0.16);
  backdrop-filter: blur(28px) saturate(138%);
}

:global(:root[data-theme="dark"]) .add-dialog-panel {
  border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-bg-default) 90%, #2a3548 10%), color-mix(in srgb, var(--color-bg-secondary) 92%, #23304a 8%));
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 10px;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--color-text-default);
  font-size: 20px;
  font-weight: 800;
}

.title-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
}

.dialog-body {
  padding: 14px 24px 8px;
}

.song-line {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 12px;
  margin-bottom: 18px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-primary) 7%, transparent);

  img {
    width: 58px;
    height: 58px;
    object-fit: cover;
    border-radius: 14px;
    box-shadow: 0 10px 24px rgba(10, 18, 32, 0.16);
  }
}

.song-info {
  min-width: 0;
}

.song-name,
.song-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-name {
  color: var(--color-text-default);
  font-size: 15px;
  font-weight: 750;
}

.song-meta {
  margin-top: 5px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.form-row {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  margin-top: 14px;

  .label {
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 650;
  }
}

.field-control {
  min-width: 0;
}

.empty-playlist {
  padding: 18px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}

.empty-title {
  color: var(--color-text-default);
  font-weight: 750;
}

.empty-desc {
  margin-top: 6px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.create-empty-btn {
  margin-top: 14px;
  border-radius: 12px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 24px;
}

.cancel-btn,
.confirm-btn {
  min-width: 84px;
  height: 40px;
  border-radius: 14px;
}

.confirm-btn {
  color: #fff;
  background: var(--color-primary);
  box-shadow: 0 12px 26px color-mix(in srgb, var(--color-primary) 34%, transparent);

  &:hover {
    color: #fff;
    background: var(--color-primary-hover);
  }
}

.add-playlist-dialog-enter-active,
.add-playlist-dialog-leave-active {
  transition: opacity 0.18s ease;

  .add-dialog-panel {
    transition:
      transform 0.18s ease,
      opacity 0.18s ease;
  }
}

.add-playlist-dialog-enter-from,
.add-playlist-dialog-leave-to {
  opacity: 0;

  .add-dialog-panel {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}
</style>
