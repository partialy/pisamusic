<template>
  <div class="search-history-popover" :class="{ open: show }" :style="{ height: show ? `${contentHeight}px` : '0px' }" :inert="!show" :aria-hidden="!show">
    <div ref="content" class="history-natural-content">
      <TipsHistory :tips="tips" :keywords="keywords" @search="emit('search', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import TipsHistory from "./TipsHistory.vue";

defineProps<{ show: boolean; tips: { key: string; name: string; singer: string }[]; keywords: string }>();
const emit = defineEmits<{ search: [text: string] }>();
const content = ref<HTMLElement | null>(null);
const contentHeight = ref(0);
let observer: ResizeObserver | undefined;
onMounted(() => {
  if (!content.value) return;
  const measure = () => { contentHeight.value = Math.min(500, Math.ceil(content.value?.getBoundingClientRect().height || 0)); };
  observer = new ResizeObserver(measure);
  observer.observe(content.value);
  measure();
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<style scoped>
.search-history-popover {
  position: absolute;
  top: 40px;
  left: 0;
  width: 100%;
  overflow: hidden;
  z-index: 100;
  border-radius: var(--radius-control);
  background: var(--surface-solid);
  box-shadow: var(--shadow-elevated);
  opacity: 0;
  transform: translateY(-6px);
  visibility: hidden;
  pointer-events: none;
  -webkit-app-region: no-drag;
  transition: height 300ms ease, opacity 300ms ease, transform 300ms ease, visibility 0s 300ms;
}
.search-history-popover.open {
  opacity: 1;
  transform: translateY(0);
  visibility: visible;
  pointer-events: auto;
  transition-delay: 0s;
}
.history-natural-content { width: 100%; }
.history-natural-content :deep(.tips-history) {
  width: 100%;
  min-height: 100px;
  max-height: 500px;
  overflow-y: auto;
  background: var(--surface-solid);
}
@media (prefers-reduced-motion: reduce) {
  .search-history-popover { transition: none; transform: none; }
}
</style>
