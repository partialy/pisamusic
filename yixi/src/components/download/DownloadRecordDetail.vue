<template>
  <AppModal :show="show" title="下载详情" :width="640" :close-disabled="repairing" @update:show="emit('update:show', $event)">
    <n-spin :show="loading">
      <n-alert v-if="error" type="error" :bordered="false">{{ error }}</n-alert>
      <template v-if="detail">
        <div class="detail-heading">
          <n-image :src="String(detail.file?.payload.cover || detail.task.cover || defaultCover)" :fallback-src="defaultCover" :width="76" :height="76" object-fit="cover" />
          <div class="heading-main"><h3>{{ detail.task.name || detail.task.songId }}</h3><p>{{ detail.file?.payload.singer || detail.task.singer || '未知歌手' }}</p><n-tag size="small" :type="detail.task.source === 'wy' ? 'error' : detail.task.source === 'kw' ? 'warning' : 'info'">{{ sourceLabel(detail.task.source) }}</n-tag> · {{ statusLabel(detail.task.status) }}</div>
        </div>
        <n-alert v-if="detail.file && !detail.stat.exists" type="warning" :bordered="false">文件不存在或不可读取：{{ detail.stat.error }}</n-alert>
        <dl class="detail-fields"><template v-for="field in fields" :key="field.label"><dt>{{ field.label }}</dt><dd><button class="copy-field" :title="'点击复制' + field.label" @click="copy(field.value)">{{ field.value }}</button></dd></template></dl>
        <p class="detail-note">点击有效字段可复制。修复仅补缺，保留已有有效内容；播放占用时无法修复。</p>
        <n-alert v-if="repairMessage" :type="repairFailed ? 'error' : 'info'" :bordered="false">{{ repairMessage }}</n-alert>
      </template>
      <n-empty v-else-if="!loading && !error" description="暂无下载详情" />
    </n-spin>
    <template #footer>
      <n-button round :disabled="loading || repairing" @click="load">刷新详情</n-button>
      <n-button round :disabled="!detail || loading || repairing" @click="locate">{{ detail?.file ? '定位文件' : '打开下载目录' }}</n-button>
      <n-button round :disabled="!detail?.file || !detail?.stat.exists || loading" :loading="repairing" @click="repair">修复信息</n-button>
    </template>
  </AppModal>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from "vue";
import { NAlert, NButton, NEmpty, NImage, NSpin, NTag } from "naive-ui";
import defaultCover from "@/assets/images/default-cover.png";
import AppModal from "@/components/common/AppModal.vue";
import type { DownloadFileDetail, DownloadFileTarget } from "@/types/download";
import { getDownloadFileDetail, openDownloadDirectory, repairDownloadFile, revealDownloadFile } from "@/utils/api/downloadAPI";
import { formatBytes, formatDate, metadataLabel, qualityLabel, sourceLabel, statusLabel } from "./downloadPresentation";
const props = defineProps<{ show: boolean; target: DownloadFileTarget | null }>();
const emit = defineEmits<{ (event: "update:show", show: boolean): void; (event: "changed"): void }>();
const detail = ref<DownloadFileDetail | null>(null), loading = ref(false), repairing = ref(false), error = ref("");
const repairMessage = ref(""), repairFailed = ref(false);
let generation = 0;
const fields = computed(() => {
  const value = detail.value; if (!value) return [];
  const file = value.file;
  const fields = [
    ["歌曲", value.task.name], ["歌手", file?.payload.singer || value.task.singer], ["专辑", file?.payload.album || value.task.album],
    ["音质", qualityLabel(value.task.qualityKey)], ["可信时长", file && file.durationMs > 0 ? `${(file.durationMs / 1000).toFixed(1)} 秒` : ""],
    ["文件大小", file ? formatBytes(value.stat.exists ? value.stat.size : file.size) : ""],
    ["完整路径", file?.filePath], ["下载目录", value.task.directory], ["创建时间", formatDate(value.task.createdAt)],
    ["完成时间", file ? formatDate(file.completedAt) : ""], ["更新时间", formatDate(value.task.updatedAt)],
    ["元数据状态", metadataLabel(file?.metadataStatus)], ["元数据说明", file?.message], ["错误", value.task.error], ["恢复提示", value.task.pauseReason],
    ["歌词文件", file?.lyricPaths.join("\n")], ["标签侧车", file?.metadataJsonPath],
  ];
  return fields.filter((entry): entry is [string, string] => typeof entry[1] === "string" && !!entry[1].trim()).map(([label, value]) => ({ label, value }));
});
watch(() => [props.show, props.target] as const, () => { generation++; detail.value = null; error.value = ""; repairMessage.value = ""; repairFailed.value = false; loading.value = false; if (props.show && props.target) void load(); });
async function load() {
  if (!props.target || !props.show || repairing.value) return;
  const current = ++generation, target = { ...props.target }; loading.value = true; error.value = "";
  try { const result = await getDownloadFileDetail(target); if (current === generation) detail.value = result; }
  catch (cause) { if (current === generation) error.value = cause instanceof Error ? cause.message : "读取详情失败"; }
  finally { if (current === generation) loading.value = false; }
}
async function locate() {
  if (!detail.value || !props.target) return;
  try { if (detail.value.file) await revealDownloadFile({ ...props.target }); else await openDownloadDirectory({ ...props.target }); }
  catch (cause) { window.$message.error(cause instanceof Error ? cause.message : "打开失败"); }
}
async function repair() {
  const fileId = detail.value?.file?.fileId; if (!fileId || repairing.value) return;
  const current = generation; repairing.value = true; repairMessage.value = "";
  try { const result = await repairDownloadFile({ fileId }); if (current !== generation) return; detail.value = result; repairFailed.value = result.file?.metadataStatus === "failed"; repairMessage.value = result.file?.message || (repairFailed.value ? "修复未完成，请查看错误后重试" : "信息补缺已完成"); emit("changed"); }
  catch (cause) { if (current === generation) { repairFailed.value = true; repairMessage.value = cause instanceof Error ? cause.message : "修复失败，原文件保留"; } }
  finally { repairing.value = false; }
}
async function copy(value: string) { try { await navigator.clipboard.writeText(value); window.$message.success("已复制"); } catch { window.$message.error("复制失败"); } }
onBeforeUnmount(() => { generation++; });
</script>
<style scoped>
.detail-heading { display: flex; gap: 14px; align-items: center; margin-bottom: 16px; }
.heading-main { min-width: 0; overflow-wrap: anywhere; }
h3, p { margin: 0 0 8px; }
.detail-fields { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 10px 12px; max-height: 45vh; overflow: auto; }
dt, .detail-note { color: var(--text-secondary); font-size: 12px; }
dd { margin: 0; }
.copy-field { border: 0; background: transparent; color: var(--text-primary); padding: 0; text-align: left; white-space: pre-wrap; overflow-wrap: anywhere; cursor: copy; font: inherit; }
.copy-field:hover { color: var(--text-accent); }
</style>
