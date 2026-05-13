<template>
  <div class="recommend-playlist">
    <KGRecommendPlaylist
      v-for="i in playlist"
      :key="`${i.source}:${i.id}`"
      :item="i"
      @contextmenu.stop="
        contextMenu?.openContextMenu($event, {
          type: 'playlist',
          data: i,
        })
      " />
    <ContextMenu ref="contextMenu" />
  </div>
</template>

<script setup lang="ts">
import type { CommonPlaylist } from "@/types/song";
import { KGRecommendPlaylist } from "../playList";
import ContextMenu from "@/components/common/ContextMenu.vue";
import { useTemplateRef } from "vue";
defineProps<{
  playlist: CommonPlaylist[];
}>();
const contextMenu = useTemplateRef("contextMenu");


</script>

<style lang="scss" scoped>
.recommend-playlist {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(10.2rem, 1fr));
  gap: 1rem;
  width: 100%;
}
</style>
