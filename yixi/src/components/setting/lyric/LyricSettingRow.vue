<template>
  <div class="lyric-setting-row" :class="{ 'wide-control': wide }">
    <div class="row-info">
      <div class="row-title">{{ title }}</div>
      <p v-if="description" class="row-description">{{ description }}</p>
    </div>
    <div class="row-control"><slot /></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; description?: string; wide?: boolean }>();
</script>

<style scoped lang="scss">
.lyric-setting-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px 20px; min-width: 0; padding: 12px 0; }
.row-info { flex: 1 1 200px; min-width: 0; }
.row-title { color: var(--text-primary); font-size: 14px; font-weight: 600; line-height: 1.5; }
.row-description { margin: 4px 0 0; color: var(--text-secondary); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.row-control { display: flex; align-items: center; justify-content: flex-end; flex: 0 1 220px; gap: 8px; min-width: 0; max-width: 100%; margin-left: auto; }
.wide-control > .row-control { flex-basis: 320px; flex-wrap: wrap; }
.row-control :deep(.n-select) { width: 100%; }
.row-control :deep(.n-input-number) { width: 126px; max-width: 100%; }
.row-control :deep(.n-color-picker) { flex: 1; min-width: 0; }
.row-control :deep(.setting-adjustment) { width: 100%; }
.row-control :deep(.n-button) { flex-shrink: 0; }
@container (max-width: 480px) { .wide-control > .row-control { flex-basis: 100%; } }
</style>
