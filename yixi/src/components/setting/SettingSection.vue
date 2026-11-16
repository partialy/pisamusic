<template>
  <section class="setting-section">
    <header v-if="title || description || $slots.actions" class="setting-section-header">
      <div v-if="title || description"><h3 v-if="title">{{ title }}</h3><p v-if="description">{{ description }}</p></div>
      <div v-if="$slots.actions" class="section-actions"><slot name="actions" /></div>
    </header>
    <slot />
  </section>
</template>
<script setup lang="ts">
defineProps<{ title?: string; description?: string }>();
</script>
<style scoped lang="scss">
.setting-section { min-width: 0; padding: 18px; border: 1px solid var(--border-subtle); border-radius: var(--radius-control); background: var(--surface-card); }
.setting-section-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
h3 { margin: 0; color: var(--text-primary); font-size: 16px; font-weight: 700; }
p { margin: 4px 0 0; color: var(--text-secondary); font-size: 12px; line-height: 1.5; }
.section-actions { flex-shrink: 0; }
</style>
