<template>
  <div class="list-end-state" :class="{ 'is-compact': compact }" role="status">
    <template v-if="loading">
      <n-spin v-if="showSpin" :show="true" size="small">
        <template #icon>
          <n-icon :component="LoadingIcon" color="var(--color-primary)" />
        </template>
      </n-spin>
      <span>{{ loadingText }}</span>
    </template>
    <span v-else>{{ noMoreText }}</span>
  </div>
</template>

<script setup lang="ts">
import { NIcon, NSpin } from "naive-ui";
import { LoadingIcon } from "@/icons";

withDefaults(
  defineProps<{
    loading?: boolean;
    showSpin?: boolean;
    loadingText?: string;
    noMoreText?: string;
    compact?: boolean;
  }>(),
  {
    loading: false,
    showSpin: false,
    loadingText: "正在加载中...",
    noMoreText: "没有更多了~",
    compact: false,
  }
);
</script>

<style scoped lang="scss">
.list-end-state {
  width: 100%;
  min-height: 48px;
  padding: 12px 0 16px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  user-select: none;

  &.is-compact {
    min-height: 40px;
    height: 40px;
    padding: 0;
  }
}
</style>
