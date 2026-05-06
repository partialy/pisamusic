<template>
  <n-popover placement="right" trigger="hover">
    <template #trigger>
      <div
        class="item-container"
        :style="{ backgroundColor: active ? 'var(--color-bg-hover)' : '' }">
        <div class="img">
          <n-image preview-disabled :src="list.cover || s" />
        </div>
        <div class="name text-line-1" v-if="!hideText">
          {{ list.name }}
        </div>
      </div>
    </template>
    <div>{{ list.name }}</div>
  </n-popover>
</template>

<script setup lang="ts">
import s from "@/assets/images/song.jpg";

defineProps<{
  list: {
    id: string;
    name: string;
    cover: string;
  };
  hideText?: boolean;
  active?: boolean;
}>();
</script>

<style lang="scss" scoped>
.item-container {
  width: 100%;
  height: 46px;
  display: flex;
  gap: 10px;
  border-radius: 4px;
  align-items: center;

  .img {
    margin: 0 8px;
    width: 32px;
    height: 32px;
    object-fit: cover;
    border-radius: 4px;
    overflow: hidden;
  }

  .name {
    line-height: 32px;
    flex: 1;
  }

  &:hover {
    background-color: var(--color-bg-hover);
    cursor: pointer;
  }
}
</style>
