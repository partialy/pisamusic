<template>
  <AppModal :show="show" :title="includeQueue ? '添加到' : '添加到歌单'" :icon="ListPlus" :close-disabled="submitting" @update:show="closeDialog">
    <div class="song-line">
      <img :src="coverUrl" :alt="song?.name || ''" />
      <div class="song-info">
        <div class="song-name">{{ targets.length > 1 ? `已选择 ${targets.length} 首歌曲` : song?.name || '未知歌曲' }}</div>
        <div class="song-meta">重复歌曲将自动跳过，请选择添加目标</div>
      </div>
    </div>
    <div class="target-list">
      <button v-if="includeQueue" type="button" class="target-row" :disabled="submitting || listenTogether.enabled" @click="addToQueue">
        <n-icon :component="ListMusic" :size="20" />
        <span class="target-info"><strong>当前播放队列</strong><small>{{ listenTogether.enabled ? '一起听中暂不支持仅添加到队列' : `${audio.playlist.length} 首歌曲` }}</small></span>
        <n-icon :component="ChevronRight" />
      </button>
      <button v-for="playlist in store.localPlaylists" :key="playlist.id" type="button" class="target-row" :disabled="submitting" @click="addToPlaylist(playlist.id)">
        <n-icon :component="Folder" :size="20" />
        <span class="target-info"><strong>{{ playlist.name }}</strong><small>{{ playlist.song_count || 0 }} 首歌曲</small></span>
        <n-icon :component="ChevronRight" />
      </button>
      <button type="button" class="target-row" :disabled="submitting" @click="openCreateDialog">
        <n-icon :component="Plus" :size="20" /><span class="target-info"><strong>新建歌单</strong><small>创建后添加所选歌曲</small></span><n-icon :component="ChevronRight" />
      </button>
    </div>
    <template #footer>
      <n-button round :disabled="submitting" @click="closeDialog"><template #icon><n-icon :component="X" /></template>取消</n-button>
    </template>
  </AppModal>
  <CreatePlaylistDialog ref="createDialogRef" @created="handleCreated" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRaw } from "vue";
import { NButton, NIcon } from "naive-ui";
import { ChevronRight, Folder, ListMusic, ListPlus, Plus, X } from "lucide-vue-next";
import AppModal from "@/components/common/AppModal.vue";
import CreatePlaylistDialog from "@/components/mine/CreatePlaylistDialog.vue";
import type { CommonPlaylist, Song } from "@/types/song";
import { defaultSongCover, getSongCover } from "@/utils/common";
import { useAudioStore, useListenTogetherStore, useMineLibraryStore } from "@/store";
import { usePlaybackCommands } from "@/listenTogether/playbackCommands";
import { normalizeSong } from "@/utils/song";
import { captureLibraryRevision, isCurrentLibraryRevision, onLibraryIdentityChanged } from "@/utils/libraryIdentity";

const store = useMineLibraryStore(), audio = useAudioStore(), listenTogether = useListenTogetherStore();
const commands = usePlaybackCommands();
const show = ref(false), submitting = ref(false), includeQueue = ref(false);
const song = ref<Song | null>(null), targets = ref<Song[]>([]);
const createDialogRef = ref<InstanceType<typeof CreatePlaylistDialog> | null>(null);
let revision = -1, openGeneration = 0, creatingGeneration = -1;
const coverUrl = computed(() => song.value ? getSongCover(song.value, 480) : defaultSongCover);
const stopIdentity = onLibraryIdentityChanged(() => { openGeneration++; show.value = false; targets.value = []; song.value = null; });
onBeforeUnmount(() => { openGeneration++; stopIdentity(); });

async function open(target: Song | null | undefined, options?: { includeQueue?: boolean }) {
  if (!target) { window.$message.warning("当前没有可添加的歌曲"); return; }
  await openMany([target], options);
}
async function openMany(songs: Song[], options?: { includeQueue?: boolean }) {
  if (!songs.length || submitting.value) return;
  const generation = ++openGeneration;
  const currentRevision = await captureLibraryRevision();
  await store.init();
  if (generation !== openGeneration || !isCurrentLibraryRevision(currentRevision)) return;
  revision = currentRevision;
  targets.value = JSON.parse(JSON.stringify(songs.map(item => normalizeSong(toRaw(item))))) as Song[];
  song.value = targets.value[0];
  includeQueue.value = !!options?.includeQueue;
  show.value = true;
}
function closeDialog() {
  if (submitting.value) return;
  openGeneration++;
  show.value = false;
}
function openCreateDialog() {
  if (submitting.value) return;
  creatingGeneration = openGeneration;
  createDialogRef.value?.open();
}
async function handleCreated(playlist: CommonPlaylist) {
  if (creatingGeneration !== openGeneration || !show.value || !isCurrentLibraryRevision(revision)) return;
  await addToPlaylist(playlist.id);
}
async function addToPlaylist(playlistId: string) {
  if (!targets.value.length || submitting.value) return;
  const generation = openGeneration;
  submitting.value = true;
  try {
    if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，请重新选择歌单");
    const payload = { playlistId, tracks: JSON.parse(JSON.stringify(targets.value)), identityRevision: revision };
    const result = await window.electronAPI.bulkAddUserPlaylistTracks(payload);
    if (generation !== openGeneration || !isCurrentLibraryRevision(revision)) return;
    await store.loadCache();
    if (generation !== openGeneration || !isCurrentLibraryRevision(revision)) return;
    window.$message.success(`已添加 ${result.added.length} 首，跳过已存在 ${result.existing.length} 首`);
    show.value = false;
  } catch (error) {
    if (generation === openGeneration && isCurrentLibraryRevision(revision)) window.$message.error(error instanceof Error ? error.message : "添加到歌单失败");
  } finally { submitting.value = false; }
}
async function addToQueue() {
  if (submitting.value || listenTogether.enabled || !targets.value.length) return;
  const generation = openGeneration;
  submitting.value = true;
  try {
    if (!isCurrentLibraryRevision(revision)) throw new Error("账号已变化，请重新选择歌曲");
    const result = await commands.appendUniqueToPlaylist(targets.value, () => generation === openGeneration && isCurrentLibraryRevision(revision));
    if (generation !== openGeneration || !isCurrentLibraryRevision(revision)) return;
    if (result.cancelled) { window.$message.info("队列状态已变化，请重新选择添加目标"); return; }
    window.$message[result.unavailable.length ? 'warning' : 'success'](`已添加 ${result.added.length} 首，跳过重复 ${result.existing.length} 首${result.unavailable.length ? `，不可添加 ${result.unavailable.length} 首` : ''}`);
    show.value = false;
  } catch (error) {
    if (generation === openGeneration && isCurrentLibraryRevision(revision)) window.$message.error(error instanceof Error ? error.message : "添加到队列失败");
  } finally { submitting.value = false; }
}
defineExpose({ open, openMany });
</script>

<style scoped>
.song-line { display: grid; grid-template-columns: 58px minmax(0, 1fr); align-items: center; gap: 14px; padding: 12px; margin-bottom: 16px; border-radius: 12px; background: var(--surface-card); border: 1px solid var(--border-subtle); }
.song-line img { width: 58px; height: 58px; object-fit: cover; border-radius: 12px; }
.song-info { min-width: 0; }
.song-name { color: var(--text-primary); font-size: 15px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.song-meta { margin-top: 6px; color: var(--text-secondary); font-size: 12px; }
.target-list { display: flex; flex-direction: column; gap: 8px; }
.target-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--border-subtle); border-radius: 12px; color: var(--text-primary); background: var(--surface-card); text-align: left; cursor: pointer; transition: background .18s; }
.target-row:hover:not(:disabled), .target-row:focus-visible { background: var(--surface-control-hover); }
.target-row:disabled { opacity: .5; cursor: not-allowed; }
.target-info { display: flex; flex-direction: column; flex: 1; min-width: 0; gap: 4px; }
.target-info strong { font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.target-info small { color: var(--text-secondary); font-size: 12px; }
</style>
