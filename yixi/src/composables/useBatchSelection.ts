import { computed, shallowRef, toValue, type MaybeRefOrGetter, type Ref } from "vue";
import type { Song } from "@/types/song";

export const batchSongKey = (song: Pick<Song, "source" | "id">) => `${song.source}:${song.id}`;

/** 选择独立于筛选视图；调用方必须先确认在线列表已经完整加载。 */
export function useBatchSelection<T extends Pick<Song, "source" | "id">>(items: MaybeRefOrGetter<T[]>, visible: MaybeRefOrGetter<T[]>, controlledKeys?: Ref<Set<string>>) {
  const selectedKeys = controlledKeys ?? shallowRef(new Set<string>());
  let anchor: string | undefined;
  const selectedSongs = computed(() => toValue(items).filter(song => selectedKeys.value.has(batchSongKey(song))));
  function toggle(song: T, event?: Pick<MouseEvent, "ctrlKey" | "metaKey" | "shiftKey">) {
    const key = batchSongKey(song);
    const next = new Set(selectedKeys.value);
    const rows = toValue(visible);
    const index = rows.findIndex(row => batchSongKey(row) === key);
    const start = rows.findIndex(row => batchSongKey(row) === anchor);
    if (event?.shiftKey && start >= 0 && index >= 0) {
      if (!event.ctrlKey && !event.metaKey) rows.forEach(row => next.delete(batchSongKey(row)));
      rows.slice(Math.min(start, index), Math.max(start, index) + 1).forEach(row => next.add(batchSongKey(row)));
    } else {
      if (event && !event.ctrlKey && !event.metaKey) { next.clear(); next.add(key); }
      else if (next.has(key)) next.delete(key); else next.add(key);
      anchor = key;
    }
    selectedKeys.value = next;
  }
  function selectVisible(selected = true) {
    const next = new Set(selectedKeys.value);
    toValue(visible).forEach(song => { const key = batchSongKey(song); if (selected) next.add(key); else next.delete(key); });
    selectedKeys.value = next;
  }
  function invertVisible() {
    const next = new Set(selectedKeys.value);
    toValue(visible).forEach(song => { const key = batchSongKey(song); if (next.has(key)) next.delete(key); else next.add(key); });
    selectedKeys.value = next;
  }
  function selectForContext(song: T) {
    const key = batchSongKey(song);
    if (!selectedKeys.value.has(key)) selectedKeys.value = new Set([key]);
    anchor = key;
  }
  function clear() { selectedKeys.value = new Set(); anchor = undefined; }
  function snapshot(): T[] { return JSON.parse(JSON.stringify(selectedSongs.value)) as T[]; }
  return { selectedKeys, selectedSongs, count: computed(() => selectedSongs.value.length), toggle, selectVisible, invertVisible, selectForContext, clear, snapshot };
}
