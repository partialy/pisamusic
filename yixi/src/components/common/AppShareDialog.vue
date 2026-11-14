<template>
  <AppModal :show="show" title="分享 PisaMusic" :icon="Share2" :width="440" @update:show="emit('update:show', $event)">
    <div class="app-share-content">
      <n-spin v-if="loading" size="small" description="正在获取当前身份的推广信息" />
      <template v-if="result?.config">
        <div class="app-share-brand">
          <img v-if="result.config.iconUrl" :src="result.config.iconUrl" alt="" @error="hideBrokenIcon" />
          <div><strong>{{ result.config.appName || 'PisaMusic' }}</strong><span v-if="result.config.version"> {{ result.config.version }}</span></div>
        </div>
        <p v-if="result.config.description">{{ result.config.description }}</p>
        <p v-if="!result.verified" class="share-status" role="status">同身份缓存，当前未校验。重新获取成功前不能复制或分享。</p>
        <p v-else-if="!result.config.trackingEnabled" class="share-status" role="status">服务端未启用 PC 身份追踪，当前无法生成专属推广分享。请升级服务端或联系管理员。</p>
        <p v-else-if="!result.config.qrCodeText && !result.config.copyText" class="share-status" role="status">推广内容尚未配置，请联系管理员。</p>
        <p v-else-if="canShare" class="share-status">当前身份已校验</p>
        <div v-if="result.config.qrCodeText" class="share-code-area">
          <div class="share-code" :class="{ 'share-code-unverified': !canShare }">
            <QrcodeVue v-if="canShare" :value="result.config.qrCodeText" :size="184" level="M" />
            <span v-else>二维码待校验</span>
          </div>
          <small>{{ canShare ? '扫码获取 PisaMusic' : '重新获取成功后展示二维码' }}</small>
        </div>
        <p v-if="result.config.copyText" class="share-copy" :class="{ 'share-copy-unverified': !canShare }">{{ result.config.copyText }}</p>
      </template>
      <p v-else-if="!loading && !error" class="share-status">尚未获取推广信息</p>
      <p v-if="error" role="alert" class="share-error">{{ error }}</p>
    </div>
    <template #footer>
      <n-button round @click="emit('update:show', false)">关闭</n-button>
      <n-button round :loading="loading" @click="load">重新获取</n-button>
      <n-button round type="primary" :disabled="!canShare || !result?.config?.copyText" @click="copy">复制文案</n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { NButton, NSpin } from "naive-ui";
import { Share2 } from "lucide-vue-next";
import QrcodeVue from "qrcode.vue";
import AppModal from "./AppModal.vue";
import electronAPI from "@/utils/electron";
import type { AppShareResult } from "@/types/appShare";

const props = defineProps<{ show: boolean }>();
const emit = defineEmits<{ (event: "update:show", value: boolean): void }>();
const result = ref<AppShareResult | null>(null);
const error = ref("");
const loading = ref(false);
let generation = 0;
let revision = -1;
const canShare = computed(() => props.show && !loading.value && result.value?.verified === true && result.value.config?.trackingEnabled === true);

async function load() {
  const request = ++generation;
  result.value = null;
  error.value = "";
  loading.value = true;
  try {
    const identity = await electronAPI.getLibraryIdentity();
    if (!props.show || request !== generation) return;
    revision = identity.identityRevision;
    const response = await electronAPI.getAppShare();
    if (!props.show || request !== generation || response.identityRevision !== revision) return;
    result.value = response;
    error.value = response.error;
  } catch (cause) {
    if (props.show && request === generation) error.value = cause instanceof Error ? cause.message : "获取失败，请重新获取";
  } finally {
    if (request === generation) loading.value = false;
  }
}

function hideBrokenIcon(event: Event) { (event.target as HTMLImageElement).style.display = "none"; }

async function copy() {
  if (!canShare.value || !result.value?.config?.copyText) return;
  const request = generation;
  const text = result.value.config.copyText;
  try {
    // 操作前再查 main 权威世代，避免身份事件尚未投递时复制旧身份文案。
    const identity = await electronAPI.getLibraryIdentity();
    if (request !== generation || identity.identityRevision !== revision || !canShare.value) return;
    await navigator.clipboard.writeText(text);
    if (request === generation && props.show) window.$message.success("推广文案已复制");
  } catch {
    if (request === generation && props.show) error.value = "无法复制到剪贴板，请重试";
  }
}

const unsubscribe = electronAPI.onAccountIdentityChanged(() => {
  generation++;
  revision = -1;
  result.value = null;
  loading.value = false;
  error.value = "身份已变化，请重新获取当前身份的推广信息";
});
watch(() => props.show, (show) => {
  if (show) void load();
  else { generation++; result.value = null; error.value = ""; loading.value = false; }
}, { flush: "sync", immediate: true });
onBeforeUnmount(() => { generation++; unsubscribe(); });
</script>

<style scoped>
.app-share-content { display: grid; gap: 16px; color: var(--text-primary); }
.app-share-content p { margin: 0; overflow-wrap: anywhere; }
.app-share-brand { display: flex; align-items: center; gap: 12px; }
.app-share-brand img { width: 44px; height: 44px; object-fit: cover; border-radius: var(--radius-control); }
.app-share-brand span, .share-status, .share-code-area small { color: var(--text-secondary); font-size: 13px; }
.share-code-area { display: grid; justify-items: center; gap: 12px; }
.share-code { padding: 14px; background: white; border-radius: var(--radius-control); line-height: 0; }
.share-code-unverified { width: 184px; height: 184px; display: grid; place-items: center; background: var(--surface-card); color: var(--text-secondary); line-height: 1.5; }
.share-copy { padding: 12px; border: 1px solid var(--border-default); border-radius: var(--radius-control); white-space: pre-wrap; }
.share-copy-unverified { user-select: none; color: var(--text-secondary); }
.share-error { color: var(--n-error-color, #d03050); font-size: 13px; }
</style>
