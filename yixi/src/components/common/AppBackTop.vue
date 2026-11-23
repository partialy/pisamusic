<template>
  <n-back-top
    v-if="visibleTargetReady"
    class="app-scroll-top-btn"
    :style="{ zIndex: 95 }"
    :right="right"
    :bottom="bottom"
    :visibility-height="visibilityHeight"
    :listen-to="resolveListenTo"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onDeactivated, onMounted, ref } from "vue";
import { NBackTop } from "naive-ui";

const props = withDefaults(
  defineProps<{
    listenTo?: () => HTMLElement | Document | null | undefined;
    right?: number;
    bottom?: number;
    visibilityHeight?: number;
  }>(),
  {
    right: 20,
    bottom: 120,
    visibilityHeight: 180,
  }
);

const isMounted = ref(false);
const isPageActive = ref(true);

const visibleTargetReady = computed(() => isMounted.value && isPageActive.value);

function resolveListenTo() {
  return props.listenTo?.() ?? document;
}

onMounted(() => {
  void nextTick(() => {
    isMounted.value = true;
  });
});

onActivated(() => {
  isPageActive.value = true;
});

onDeactivated(() => {
  isPageActive.value = false;
});
</script>

<style lang="scss">
.app-scroll-top-btn {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45);
  z-index: 95;
  background-color: var(--color-bg-default);
  border: none;
  opacity: 0.5;
  transition: opacity 0.2s ease, transform 0.2s ease;

  &:hover {
    opacity: 1;
  }
}
</style>
