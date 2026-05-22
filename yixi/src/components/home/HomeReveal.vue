<template>
  <div ref="rootRef" class="home-reveal" :class="{ visible }">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from "vue";

defineOptions({ name: "HomeReveal" });

const rootRef = useTemplateRef<HTMLElement>("rootRef");
const visible = ref(false);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    visible.value = true;
    return;
  }

  const root = rootRef.value;
  if (!root) return;

  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry?.isIntersecting) return;
      visible.value = true;
      observer?.disconnect();
      observer = null;
    },
    {
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px",
    }
  );
  observer.observe(root);
});

onBeforeUnmount(() => {
  observer?.disconnect();
});
</script>

<style lang="scss" scoped>
.home-reveal {
  opacity: 0;
  transform: translateY(18px);
  transition:
    opacity 0.36s ease,
    transform 0.36s ease;

  &.visible {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
