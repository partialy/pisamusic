<template>
  <div class="home-section-title">
    <h2>{{ title }}</h2>
    <n-button v-if="showMore" text type="primary" class="more-btn" @click="emit('more')">
      <span>查看更多</span>
      <n-icon class="more-icon" :component="ChevronRight" />
    </n-button>
  </div>
</template>

<script setup lang="ts">
import { NButton, NIcon } from "naive-ui";
import { ChevronRight } from "lucide-vue-next";

defineOptions({ name: "HomeSectionTitle" });

withDefaults(defineProps<{
  title: string;
  showMore?: boolean;
}>(), {
  showMore: false,
});

const emit = defineEmits<{
  more: [];
}>();
</script>

<style lang="scss" scoped>
.home-section-title {
  height: 40px;
  margin: 1rem 0;
  padding: 0 0.8rem;
  border-radius: 4px;
  border-left: 5px solid var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  h2 {
    margin: 0;
    font-size: 1.3rem;
    line-height: 40px;
    font-weight: 600;
  }
}

.more-btn {
  flex-shrink: 0;
}

.more-icon {
  margin-left: 2px;
  font-size: 16px;
}
</style>
