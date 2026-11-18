<template>
  <AppModal :show="show" :title="secondConfirm ? '再次确认物理删除' : '移除歌曲与下载记录'" :icon="Trash2" :close-disabled="busy" @update:show="close">
    <p>已冻结 {{ count }} 项{{ all ? '（全部下载集合，不受搜索过滤影响）' : '' }}。</p>
    <p v-if="!secondConfirm">默认仅移除列表和下载记录，保留音频及关联文件。</p>
    <p v-else>确定永久删除这 {{ count }} 项对应的音频？此操作无法撤销。正在处理、播放占用或共享文件会分别报告结果。</p>
    <template v-if="!secondConfirm" #footer-options>
      <n-checkbox v-model:checked="deleteFiles" :disabled="busy">同时物理删除音频和可安全删除的关联文件</n-checkbox>
    </template>
    <template #footer>
      <n-button round :disabled="busy" @click="close(false)"><template #icon><n-icon :component="X" /></template>取消</n-button>
      <n-button round :type="deleteFiles ? 'error' : 'primary'" :loading="busy" :disabled="!count" @click="confirm">
        <template #icon><n-icon :component="secondConfirm ? Trash2 : deleteFiles ? ArrowRight : ListMinus" /></template>
        {{ secondConfirm ? '确认永久删除' : deleteFiles ? '下一步确认' : '仅移除记录' }}
      </n-button>
    </template>
  </AppModal>
</template>
<script setup lang="ts">
import { ref, watch } from "vue";
import { NButton, NCheckbox, NIcon } from "naive-ui";
import { ArrowRight, ListMinus, Trash2, X } from "lucide-vue-next";
import AppModal from "@/components/common/AppModal.vue";
const props = defineProps<{ show: boolean; count: number; busy: boolean; all?: boolean }>();
const emit = defineEmits<{ (event: "update:show", show: boolean): void; (event: "confirm", deleteFiles: boolean): void }>();
const deleteFiles = ref(false), secondConfirm = ref(false);
watch(() => props.show, show => { if (show) { deleteFiles.value = false; secondConfirm.value = false; } });
function close(show: boolean) { if (!props.busy) emit("update:show", show); }
function confirm() {
  if (props.busy) return;
  if (deleteFiles.value && !secondConfirm.value) { secondConfirm.value = true; return; }
  emit("confirm", deleteFiles.value);
}
</script>
