<template><PlaylistEditDialog ref="dialog" @saved="emit('created', $event)" /></template>
<script setup lang="ts">
import { ref } from "vue";
import PlaylistEditDialog from "./PlaylistEditDialog.vue";
import type { CommonPlaylist } from "@/types/song";
const emit = defineEmits<{ created: [playlist: CommonPlaylist] }>();
const dialog = ref<InstanceType<typeof PlaylistEditDialog> | null>(null);
defineExpose({ open: () => dialog.value?.open() });
</script>
