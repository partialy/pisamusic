<template>
  <AppModal :show="!!mediaDetailRequest" :title="dialogTitle" :icon="Info" :width="620"
    @update:show="value => !value && closeMediaDetail()">
    <div v-if="loading" class="detail-state"><n-spin size="small" /><span>正在加载详情…</span></div>
    <div v-else-if="error" class="detail-state">
      <p>{{ error }}</p>
      <n-button v-if="isShareMode" round secondary @click="loadDetail"><template #icon><n-icon :component="RefreshCw" /></template>重试加载</n-button>
    </div>
    <div v-else-if="song || playlist" class="detail-content">
      <div class="detail-hero">
        <img :src="coverUrl" :alt="title" class="detail-cover" @error="handleCoverError" />
        <div class="detail-heading">
          <h2>{{ title }}</h2>
          <p>{{ subtitle || '暂无描述' }}</p>
          <div v-if="shareRecord" class="detail-sharer">
            <n-avatar round :size="24" :src="shareRecord.sharer.avatarUrl || undefined" />
            <span>{{ shareRecord.sharer.username || 'PisaMusic 用户' }} 分享</span>
          </div>
        </div>
      </div>
      <dl class="detail-fields">
        <div v-for="item in metaItems" :key="item.label">
          <dt>{{ item.label }}</dt><dd><button type="button" class="detail-value" title="点击复制" @click="copyField(item.value)">{{ item.value || '暂无' }}</button></dd>
        </div>
      </dl>
    </div>
    <template #footer>
      <template v-if="song || playlist">
        <n-button round type="primary" @click="song ? playSong() : openPlaylistPage()">
          <template #icon><n-icon :component="song ? Play : ListMusic" /></template>
          {{ song ? '立即播放' : '打开歌单' }}
        </n-button>
        <n-button round secondary @click="toggleCollect"><template #icon><n-icon :component="CollectIcon" :color="collected ? '#ff5d6c' : 'var(--text-secondary)'" /></template>{{ collected ? '取消收藏' : '收藏' }}</n-button>
        <n-button v-if="song" round secondary @click="openDownload"><template #icon><n-icon :component="Download" /></template>下载</n-button>
        <n-button round secondary @click="openShareDialog"><template #icon><n-icon :component="Share2" /></template>分享</n-button>
      </template>
      <n-button round @click="closeMediaDetail"><template #icon><n-icon :component="X" /></template>关闭</n-button>
    </template>
  </AppModal>
  <ShareDialog ref="shareDialogRef" />
  <DownloadSongDialog :ref="songDownload.downloadDialogRef" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { NAvatar, NButton, NIcon, NSpin } from 'naive-ui';
import { Download, Info, ListMusic, Play, RefreshCw, Share2, X } from 'lucide-vue-next';
import { CollectIcon } from '@/icons';
import AppModal from './AppModal.vue';
import ShareDialog from './ShareDialog.vue';
import DownloadSongDialog from '@/components/player/DownloadSongDialog.vue';
import type { CommonPlaylist, Song } from '@/types/song';
import { useCollectStore, useMineLibraryStore } from '@/store';
import { usePlaybackCommands } from '@/listenTogether/playbackCommands';
import { useSongDownload } from '@/composables/useSongDownload';
import { defaultSongCover, formatDuration, getSongCover } from '@/utils/common';
import { getPlaylistCover, playlistCoverFallback } from '@/playlist/playlistCover';
import defaultPlaylistCover from '@/assets/images/default-created-playlist-cover.svg';
import { getPublicShare } from '@/share/shareApi';
import { playlistFromSharePayload, songFromSharePayload, type PublicShareRecord } from '@/share/shareModels';
import { mediaDetailRequest, closeMediaDetail } from '@/share/mediaDetailRoute';

const router = useRouter();
const collector = useCollectStore();
const mineLibrary = useMineLibraryStore();
const playbackCommands = usePlaybackCommands();
const songDownload = useSongDownload();
const shareDialogRef = ref<InstanceType<typeof ShareDialog> | null>(null);
const loading = ref(false);
const error = ref('');
const song = ref<Song | null>(null);
const playlist = ref<CommonPlaylist | null>(null);
const shareRecord = ref<PublicShareRecord | null>(null);
const localCover = ref('');
let requestVersion = 0;
const isShareMode = computed(() => mediaDetailRequest.value?.kind === 'share');
const dialogTitle = computed(() => isShareMode.value ? '分享详情' : song.value ? '歌曲详情' : playlist.value ? '歌单详情' : '音乐详情');
const title = computed(() => song.value?.name || displayPlaylist.value?.name || '音乐详情');
const subtitle = computed(() => song.value?.singer || displayPlaylist.value?.desc || '');
const displayPlaylist = computed(() => playlist.value?.source === 'local' && !shareRecord.value
  ? mineLibrary.localPlaylists.find(item => item.id === playlist.value?.id) || playlist.value : playlist.value);
const collected = computed(() => song.value ? collector.containsSong(song.value)
  : displayPlaylist.value ? collector.containsPlaylist(displayPlaylist.value) : false);
const coverUrl = computed(() => {
  if (song.value) return localCover.value || getSongCover(song.value, 720);
  if (displayPlaylist.value?.source === 'local') return getPlaylistCover(displayPlaylist.value, 720);
  return displayPlaylist.value ? getSongCover(displayPlaylist.value, 720, defaultPlaylistCover) : defaultSongCover;
});
const metaItems = computed(() => {
  const fields: { label: string; value: string }[] = [];
  if (song.value) {
    fields.push({ label: '歌手', value: song.value.singer }, { label: '专辑', value: song.value.album || '单曲' },
      { label: '时长', value: formatDuration(song.value.duration) });
    if (song.value.source === 'local' && !isShareMode.value) {
      fields.push({ label: '文件路径', value: song.value.filePath || song.value.urlParam || '' },
        { label: '封面来源', value: localCover.value ? '内嵌封面' : '默认封面' });
    }
  } else if (displayPlaylist.value) {
    fields.push({ label: '歌曲数量', value: `${displayPlaylist.value.song_count || 0} 首` },
      { label: '描述', value: displayPlaylist.value.desc || '暂无描述' });
    if (!isShareMode.value) fields.push({ label: '播放量', value: String(displayPlaylist.value.play_count || 0) },
      { label: '收藏量', value: String(displayPlaylist.value.collect_count || 0) });
  }
  if (shareRecord.value) fields.push({ label: '访问次数', value: `${shareRecord.value.accessCount} 次` });
  else if (song.value || playlist.value) {
    const source = song.value?.source || playlist.value?.source || '';
    fields.push({ label: '来源', value: source === 'local' ? '本地' : source.toUpperCase() });
  }
  return fields;
});
watch(mediaDetailRequest, () => void loadDetail(), { immediate: true, flush: 'sync' });
onBeforeUnmount(() => { requestVersion += 1; });

async function loadDetail() {
  const version = ++requestVersion;
  const request = mediaDetailRequest.value;
  loading.value = false;
  error.value = '';
  song.value = null;
  playlist.value = null;
  shareRecord.value = null;
  localCover.value = '';
  if (!request) return;
  if (request.kind === 'invalid') { error.value = '详情数据无效'; return; }
  if (request.kind === 'song') song.value = request.song;
  else if (request.kind === 'playlist') playlist.value = request.playlist;
  else {
    loading.value = true;
    try {
      const share = await getPublicShare(request.uuid);
      if (version !== requestVersion) return;
      shareRecord.value = share;
      if (share.type === 'song') song.value = songFromSharePayload({ ...share.rawJson, cover: share.coverUrl });
      else playlist.value = playlistFromSharePayload({ ...share.rawJson, cover: share.coverUrl });
    } catch (err) {
      if (version === requestVersion) error.value = (err instanceof Error ? err.message.replace(/^(?:Error:\s*)+/, '') : '') || '分享不存在或已失效';
    } finally {
      if (version === requestVersion) loading.value = false;
    }
  }
  const localPath = song.value?.source === 'local' ? song.value.filePath || song.value.urlParam : '';
  if (localPath) {
    try {
      const cover = await window.electronAPI.getLocalSongCover(localPath);
      if (version === requestVersion) localCover.value = cover || '';
    } catch { /* 本地封面不可读时使用默认封面。 */ }
  }
}
function handleCoverError(event: Event) {
  if (displayPlaylist.value) playlistCoverFallback(event, displayPlaylist.value);
  else { const image = event.target as HTMLImageElement; if (image.src !== defaultSongCover) image.src = defaultSongCover; }
}
function playSong() {
  if (!song.value) return;
  if (song.value.source === 'local' && !song.value.filePath) { window.$message.warning('该本地歌曲只能在原设备播放'); return; }
  playbackCommands.playSingle(song.value);
}
function openPlaylistPage() {
  if (!displayPlaylist.value) return;
  void router.push({ path: '/playlist/detail', query: { id: displayPlaylist.value.id, origin: displayPlaylist.value.source } });
  closeMediaDetail();
}
function toggleCollect() {
  if (song.value) void collector.collectSong(song.value);
  else if (displayPlaylist.value) void collector.collectList(displayPlaylist.value);
}
function openShareDialog() {
  if (song.value) shareDialogRef.value?.openForSong(song.value);
  else if (displayPlaylist.value) shareDialogRef.value?.openForPlaylist(displayPlaylist.value);
}
function openDownload() { if (song.value) songDownload.openDownloadDialog(song.value); }
async function copyField(value: string) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    window.$message.success('已复制');
  } catch {
    window.$message.error('复制失败，请重试');
  }
}
</script>

<style scoped>
.detail-state { min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; color: var(--text-secondary); }
.detail-content { display: grid; gap: 20px; }
.detail-hero { display: flex; gap: 20px; align-items: center; }
.detail-cover { flex: 0 0 auto; width: 120px; height: 120px; object-fit: cover; border-radius: 12px; }
.detail-heading { min-width: 0; }
.detail-heading h2 { margin: 0 0 8px; font-size: 20px; line-height: 1.4; overflow-wrap: anywhere; color: var(--text-primary); }
.detail-heading p { margin: 0; color: var(--text-secondary); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 120px; overflow-y: auto; }
.detail-sharer { display: flex; gap: 8px; align-items: center; margin-top: 12px; color: var(--text-secondary); }
.detail-fields { margin: 0; display: grid; gap: 12px; }
.detail-fields > div { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 12px; }
.detail-fields dt { color: var(--text-secondary); }
.detail-fields dd { margin: 0; color: var(--text-primary); white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; }
.detail-value { padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; white-space: inherit; overflow-wrap: inherit; cursor: pointer; user-select: text; }
.detail-value:hover { color: var(--text-accent); }
@media (max-width: 480px) { .detail-cover { width: 88px; height: 88px; } .detail-hero { gap: 12px; } }
</style>
