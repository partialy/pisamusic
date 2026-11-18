<template>
  <n-input
    :value="value"
    round
    class="expandable-search-input"
    :class="{ focused: searchFocused || Boolean(value) }"
    :style="inputStyle"
    :clearable="clearable"
    :placeholder="placeholder"
    @update:value="(val) => emit('update:value', val)"
    @focus="searchFocused = true"
    @blur="searchFocused = false"
  >
    <template #prefix>
      <n-icon :component="Search" />
    </template>
  </n-input>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NIcon, NInput } from "naive-ui";
import { Search } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    value: string;
    placeholder?: string;
    clearable?: boolean;
    collapsedWidth?: number;
    expandedWidth?: number;
  }>(),
  {
    placeholder: "搜索",
    clearable: true,
    collapsedWidth: 92,
    expandedWidth: 220,
  }
);

const emit = defineEmits<{
  "update:value": [value: string];
}>();

const searchFocused = ref(false);

const inputStyle = computed(() => ({
  width: `${searchFocused.value || Boolean(props.value) ? props.expandedWidth : props.collapsedWidth}px`,
}));
</script>

<style scoped lang="scss">
.expandable-search-input {
  flex-shrink: 0;
  transition: width 0.25s ease;
}
</style>
