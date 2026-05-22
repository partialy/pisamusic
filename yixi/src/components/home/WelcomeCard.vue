<template>
  <div class="welcome-card-container">
    <HomeAnnouncementCard />
    <HomeHotSongCard
      :songs="hotSongs"
      :loading="hotLoading"
      @show-more="emit('showMoreHotSongs')"
      @play="emit('play', $event)" />
  </div>
</template>

<script setup lang="ts">
import HomeAnnouncementCard from "./HomeAnnouncementCard.vue";
import HomeHotSongCard from "./HomeHotSongCard.vue";
import type { Song } from "@/types/song";

defineOptions({ name: "WelcomeCard" });

withDefaults(defineProps<{
  hotSongs: Song[];
  hotLoading?: boolean;
}>(), {
  hotLoading: false,
});

const emit = defineEmits<{
  showMoreHotSongs: [];
  play: [song: Song];
}>();
</script>

<style lang="scss" scoped>
.welcome-card-container {
  display: flex;
  width: 100%;
  gap: 1.5rem;
}
</style>
