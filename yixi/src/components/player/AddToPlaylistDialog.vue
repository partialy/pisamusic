<template>
  <AppModal :show="show" title="添加到歌单" :icon="PlaylistAdd" :close-disabled="submitting" @update:show="closeDialog">
    <div class="dialog-body">
      <div class="song-line">
        <img :src="coverUrl" :alt="song?.name || ''" />
        <div class="song-info">
          <div class="song-name" :title="song?.name || ''">{{ targets.length > 1 ? `已选择 ${targets.length} 首歌曲` : song?.name || "未知歌曲" }}</div>
          <div class="song-meta" :title="song?.singer || ''">{{ targets.length > 1 ? '重复曲目将自动跳过' : song?.singer || "未知歌手" }}</div>
        </div>
      </div>

      <div v-if="playlistOptions.length" class="form-row">
        <div class="label">歌单</div>
        <n-select
          v-model:value="playlistId"
          class="field-control"
          to="body"
          :options="playlistOptions"
          placeholder="选择自建歌单" />
      </div>
      <div v-else class="empty-playlist">
        <div class="empty-title">还没有自建歌单</div>
        <div class="empty-desc">先新建一个歌单，再把这首歌放进去。</div>
        <n-button secondary class="create-empty-btn" @click="openCreateDialog">新建歌单</n-button>
      </div>
    </div>

    <template #footer>
      <n-button round secondary :disabled="submitting" @click="openCreateDialog">新建歌单</n-button>
      <n-button quaternary class="cancel-btn" @click="closeDialog">取消</n-button>
      <n-button
        class="confirm-btn"
        :disabled="!playlistOptions.length"
        :loading="submitting"
        @click="confirmAdd">
        确定
      </n-button>
    </template>
  </AppModal>
  <CreatePlaylistDialog ref="createDialogRef" @created="handleCreated" />
</template>

<script setup lang="ts">
import AppModal from "@/components/common/AppModal.vue";
import { computed, onBeforeUnmount, ref, toRaw, watch } from "vue";
import { NButton, NSelect } from "naive-ui";
import { PlaylistAdd } from "@/icons";
import CreatePlaylistDialog from "@/components/mine/CreatePlaylistDialog.vue";
import type { CommonPlaylist, Song } from "@/types/song";
import { defaultSongCover, getSongCover } from "@/utils/common";
import { useMineLibraryStore } from "@/store";
import { normalizeSong } from "@/utils/song";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";

const store = useMineLibraryStore();
const show = ref(false);
const submitting = ref(false);
const song = ref<Song | null>(null);
const targets = ref<Song[]>([]);
let revision = -1;
let openGeneration = 0;
const stopIdentity = onLibraryIdentityChanged(() => { openGeneration++; show.value = false; targets.value = []; song.value = null; });
onBeforeUnmount(() => { openGeneration++; stopIdentity(); });
const playlistId = ref("");
const createDialogRef = ref<InstanceType<typeof CreatePlaylistDialog> | null>(null);

const localPlaylists = computed(() => store.localPlaylists);
const playlistOptions = computed(() =>
  localPlaylists.value.map((playlist) => ({
    label: playlist.name,
    value: playlist.id,
  }))
);
const coverUrl = computed(() => song.value ? getSongCover(song.value, 480) : defaultSongCover);

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
  await openMany([target]);
}

async function openMany(songs: Song[]) {
  if (!songs.length || submitting.value) return;
  const generation = ++openGeneration;
  const currentRevision = await captureLibraryRevision();
  await store.init();
  if (generation !== openGeneration || !isCurrentLibraryRevision(currentRevision)) return;
  revision = currentRevision;
  targets.value = JSON.parse(JSON.stringify(songs.map(item => normalizeSong(toRaw(item))))) as Song[];
  song.value = targets.value[0];
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
  if (!targets.value.length || !playlistId.value || submitting.value) return;
  submitting.value = true;
  try {
    if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，请重新选择歌单");
    const payload = { playlistId: playlistId.value, tracks: JSON.parse(JSON.stringify(targets.value)), identityRevision: revision };
    const result = await window.electronAPI.bulkAddUserPlaylistTracks(payload);
    if (!isCurrentLibraryRevision(revision)) return;
    await store.loadCache();
    if (!isCurrentLibraryRevision(revision)) return;
    window.$message.success(`已添加 ${result.added.length} 首，跳过已存在 ${result.existing.length} 首`);
    show.value = false;
  } catch (error) {
    if (!isCurrentLibraryRevision(revision)) return;
    window.$message.error(error instanceof Error ? error.message : "添加到歌单失败");
  } finally {
    submitting.value = false;
  }
}

defineExpose({ open, openMany });
</script>

<style scoped lang="scss">
.dialog-body { min-width: 0; }

.song-line {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  padding: 12px;
  margin-bottom: 18px;
  border-radius: var(--radius-control);
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);

  img {
    width: 58px;
    height: 58px;
    object-fit: cover;
    border-radius: var(--radius-control);
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
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 750;
}

.song-meta {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 13px;
}

.form-row {
  margin-bottom: 16px;

  .label {
    display: block;
    margin-bottom: 8px;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 650;
  }
}

.field-control {
  min-width: 0;
}

.empty-playlist {
  padding: 18px;
  border-radius: var(--radius-control);
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
}

.empty-title {
  color: var(--text-primary);
  font-weight: 750;
}

.empty-desc {
  margin-top: 6px;
  color: var(--text-secondary);
  font-size: 13px;
}

.create-empty-btn {
  margin-top: 14px;
  border-radius: var(--radius-pill);
}

.cancel-btn,
.confirm-btn {
  min-width: 84px;
  border-radius: var(--radius-pill);
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

</style>
