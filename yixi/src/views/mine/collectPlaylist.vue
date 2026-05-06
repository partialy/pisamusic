<template>
  <div class="list-container">
    <PlaylistCollect :playlist="playlists" />
  </div>
</template>

<script setup lang="ts">
import { PlaylistCollect } from "@/components";
import { useCollectStore } from "@/store";
import { storeToRefs } from "pinia";
const collect = useCollectStore();
const { playlists } = storeToRefs(collect);
</script>

<style lang="scss" scoped>
.list-container {
  width: 100%;
  height: 100%;
}
</style>
