<template>
  <n-dropdown :show="show" :x="x" :y="y" trigger="manual" :options="options" @clickoutside="emit('close')" @select="select" />
</template>
<script setup lang="ts">
import { computed } from "vue";
import { NDropdown } from "naive-ui";
const props = defineProps<{ show: boolean; x: number; y: number; favorites?: boolean; removable?: boolean; queueDisabled?: boolean }>();
const emit = defineEmits<{ close: []; action: [key: string] }>();
const options = computed(() => [
  { key: 'favorite', label: '收藏所选歌曲' },
  ...(props.favorites ? [{ key: 'unfavorite', label: '取消收藏所选歌曲' }] : []),
  { key: 'download', label: '下载所选歌曲' },
  { key: 'playlist', label: '添加所选到歌单' },
  { key: 'queue', label: '添加所选到队列', disabled: props.queueDisabled },
  ...(props.removable ? [{ key: 'remove', label: '移除所选歌曲' }] : []),
]);
function select(key: string) { emit('close'); emit('action', key); }
</script>
