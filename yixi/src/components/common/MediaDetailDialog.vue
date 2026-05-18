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

            <div class="field-grid">
              <DetailField label="歌名" :value="song.name" />
              <DetailField label="歌手" :value="song.singer" />
              <DetailField label="专辑" :value="song.album" />
              <DetailField label="音源" :value="sourceLabel(song.source)" />
              <DetailField label="歌曲 ID" :value="song.id" />
              <DetailField label="播放参数" :value="song.urlParam" />
              <DetailField label="时长" :value="formatDuration(song.duration)" />
              <DetailField label="是否收藏" :value="collector.containsSong(song) ? '是' : '否'" />
              <DetailField v-if="song.source === 'local'" label="歌曲路径" :value="song.filePath || song.urlParam" wide />
              <DetailField v-if="song.source === 'local'" label="封面来源" :value="localCoverSource" wide />
              <DetailField v-else label="封面地址" :value="song.cover" wide />
              <DetailField v-if="song.d_cover" label="动态封面" :value="song.d_cover" wide />
              <DetailField v-if="song.lyric" label="歌词" :value="song.lyric" wide />
              <DetailField v-if="song.krc" label="KRC 歌词" :value="song.krc" wide />
            </div>

            <div v-if="song.coverSize || song.size" class="extra-section">
              <div class="section-title">其他字段</div>
              <div class="field-grid compact">
                <DetailField
                  v-for="item in songExtraFields"
                  :key="item.label"
                  :label="item.label"
                  :value="item.value ?? ''" />
              </div>
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

            <div class="field-grid">
              <DetailField label="歌单名" :value="playlist.name" />
              <DetailField label="来源" :value="sourceLabel(playlist.source)" />
              <DetailField label="歌单 ID" :value="playlist.id" />
              <DetailField label="歌曲数" :value="playlist.song_count || 0" />
              <DetailField label="播放数" :value="playlist.play_count || '暂无'" />
              <DetailField label="收藏数" :value="playlist.collect_count || '暂无'" />
              <DetailField label="是否收藏" :value="collector.containsPlaylist(playlist) ? '是' : '否'" />
              <DetailField label="封面地址" :value="playlist.cover || '默认封面'" wide />
              <DetailField label="描述" :value="playlist.desc || '暂无描述'" wide />
              <DetailField label="标签" :value="playlistTags" wide />
            </div>

            <div v-if="playlist.coverSize" class="extra-section">
              <div class="section-title">封面尺寸</div>
              <div class="field-grid compact">
                <DetailField
                  v-for="item in playlistCoverFields"
                  :key="item.label"
                  :label="item.label"
                  :value="item.value ?? ''" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from "vue";
import { NIcon } from "naive-ui";
import { Info, X } from "lucide-vue-next";
import type { CommonPlaylist, Song } from "@/types/song";
import { useCollectStore } from "@/store";
import { defaultSongCover, formatDuration, formatSize, getKgImage, getSongCover } from "@/utils/common";
import defaultPlaylistCover from "@/assets/images/default-created-playlist-cover.svg";

type DetailFieldItem = {
  label: string;
  value: string | number | boolean | null | undefined;
};

const DetailField = defineComponent({
  name: "DetailField",
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number, Boolean], default: "" },
    wide: { type: Boolean, default: false },
  },
  setup(props) {
    return () =>
      h("div", { class: ["detail-field", props.wide ? "wide" : ""] }, [
        h("div", { class: "field-label" }, props.label),
        h("div", { class: "field-value", title: stringifyValue(props.value) }, stringifyValue(props.value)),
      ]);
  },
});

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
const localCoverSource = computed(() => {
  if (localCoverLoading.value) return "正在读取内嵌封面";
  if (localCover.value) return "来自内嵌封面";
  if (song.value?.cover) return song.value.cover;
  return "无内嵌封面，使用默认封面";
});
const playlistTags = computed(() => {
  const tags = playlist.value?.tags || [];
  return tags.length ? tags.map((tag) => tag.name).join(" / ") : "暂无";
});
const songExtraFields = computed<DetailFieldItem[]>(() => {
  const target = song.value;
  if (!target) return [];
  const fields: DetailFieldItem[] = [];
  if (target.coverSize) {
    fields.push(
      { label: "封面 S", value: target.coverSize.s },
      { label: "封面 M", value: target.coverSize.m },
      { label: "封面 L", value: target.coverSize.l },
      { label: "封面 XL", value: target.coverSize.xl }
    );
  }
  if (target.size) {
    Object.entries(target.size).forEach(([key, value]) => {
      fields.push({ label: `大小 ${key}`, value: formatSize(value) });
    });
  }
  return fields.filter((item) => stringifyValue(item.value));
});
const playlistCoverFields = computed<DetailFieldItem[]>(() => {
  const coverSize = playlist.value?.coverSize;
  if (!coverSize) return [];
  return [
    { label: "封面 S", value: coverSize.s },
    { label: "封面 M", value: coverSize.m },
    { label: "封面 L", value: coverSize.l },
    { label: "封面 XL", value: coverSize.xl },
  ].filter((item) => stringifyValue(item.value));
});

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
    kg: "酷狗",
    wy: "网易云",
    kw: "酷我",
    qq: "QQ 音乐",
    local: "本地",
  };
  return source ? labels[source] || source.toUpperCase() : "未知";
}

function stringifyValue(value: DetailFieldItem["value"]) {
  if (value === undefined || value === null || value === "") return "暂无";
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
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
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--color-border-default) 82%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-bg-default) 44%, transparent);

  &.wide {
    grid-column: 1 / -1;
  }
}

.field-label {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

.field-value {
  margin-top: 5px;
  overflow: hidden;
  color: var(--color-text-default);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extra-section {
  margin-top: 18px;
}

.section-title {
  color: var(--color-text-default);
  font-size: 14px;
  font-weight: 800;
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
