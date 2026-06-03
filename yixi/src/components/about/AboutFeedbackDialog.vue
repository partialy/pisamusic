<template>
  <n-modal
    :show="show"
    preset="card"
    title="意见反馈"
    class="about-feedback-dialog"
    :mask-closable="!submitting"
    @update:show="handleVisibleChange">
    <div class="feedback-form">
      <label class="form-field">
        <span>反馈类型</span>
        <n-select v-model:value="feedbackType" :options="feedbackOptions" />
      </label>

      <label class="form-field">
        <span>问题描述</span>
        <n-input
          v-model:value="description"
          type="textarea"
          :autosize="{ minRows: 5, maxRows: 8 }"
          maxlength="500"
          show-count
          placeholder="请详细描述遇到的问题或建议"
        />
      </label>

      <label class="form-field">
        <span>联系方式 <small>选填</small></span>
        <n-input v-model:value="contact" maxlength="120" placeholder="邮箱、手机号或其他联系方式" />
      </label>

      <div class="form-field">
        <span>图片 <small>选填，最多 3 张，单张不超过 5MB</small></span>
        <div class="image-list">
          <div v-for="item in images" :key="item.id" class="image-item">
            <img :src="item.previewUrl" :alt="item.file.name" />
            <button type="button" aria-label="移除图片" @click="removeImage(item.id)">×</button>
          </div>
          <button v-if="images.length < 3" type="button" class="pick-image" @click="pickImages">
            <span>+</span>
            上传
          </button>
        </div>
        <input
          ref="fileInput"
          class="file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          @change="handleFileChange"
        />
      </div>

      <div class="dialog-actions">
        <n-button :disabled="submitting" @click="emit('update:show', false)">取消</n-button>
        <n-button type="primary" :loading="submitting" @click="submit">提交反馈</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import { NButton, NInput, NModal, NSelect, type SelectOption } from "naive-ui";

defineOptions({ name: "AboutFeedbackDialog" });

type FeedbackType = "bug" | "suggestion" | "account" | "other";

type FeedbackImagePayloadValue = {
  name: string;
  type: string;
  size: number;
  data: ArrayBuffer;
};

type FeedbackImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

const props = defineProps<{
  show: boolean;
  appVersion: string;
}>();

const emit = defineEmits<{
  (event: "update:show", value: boolean): void;
}>();

const feedbackOptions: SelectOption[] = [
  { label: "异常/报错", value: "bug" },
  { label: "功能建议", value: "suggestion" },
  { label: "账号相关", value: "account" },
  { label: "其他问题", value: "other" },
];

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 5 * 1024 * 1024;

const feedbackType = ref<FeedbackType>("bug");
const description = ref("");
const contact = ref("");
const images = ref<FeedbackImageItem[]>([]);
const submitting = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

function handleVisibleChange(value: boolean) {
  if (submitting.value) return;
  emit("update:show", value);
}

function pickImages() {
  fileInput.value?.click();
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const selected = Array.from(input.files ?? []);
  input.value = "";
  if (!selected.length) return;

  const next: FeedbackImageItem[] = [];
  for (const file of selected) {
    if (images.value.length + next.length >= 3) {
      window.$message?.warning("最多只能上传 3 张图片");
      break;
    }
    if (!allowedTypes.has(file.type)) {
      window.$message?.warning(`${file.name} 格式不支持`);
      continue;
    }
    if (file.size > maxImageBytes) {
      window.$message?.warning(`${file.name} 超过 5MB`);
      continue;
    }
    next.push({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }
  images.value = [...images.value, ...next];
}

function removeImage(id: string) {
  const item = images.value.find((image) => image.id === id);
  if (item) URL.revokeObjectURL(item.previewUrl);
  images.value = images.value.filter((image) => image.id !== id);
}

async function submit() {
  const text = description.value.trim();
  if (!text) {
    window.$message?.warning("请填写问题描述");
    return;
  }
  submitting.value = true;
  try {
    await window.electronAPI.submitFeedback({
      feedback_type: feedbackType.value,
      description: text,
      contact: contact.value.trim(),
      device: buildDeviceMeta(),
      images: await readImages(),
    });
    window.$message?.success("反馈已提交");
    resetForm();
    emit("update:show", false);
  } catch (error) {
    window.$message?.error(error instanceof Error ? error.message : "反馈提交失败");
    void window.electronAPI.reportError(error, {
      scope: "about",
      action: "submitFeedback",
    });
  } finally {
    submitting.value = false;
  }
}

async function readImages(): Promise<FeedbackImagePayloadValue[]> {
  return Promise.all(
    images.value.map(async ({ file }) => ({
      name: file.name,
      type: file.type,
      size: file.size,
      data: await file.arrayBuffer(),
    }))
  );
}

function buildDeviceMeta() {
  return {
    platform: navigator.platform,
    userAgent: navigator.userAgent,
    appVersion: props.appVersion,
    source: "desktop",
  };
}

function resetForm() {
  feedbackType.value = "bug";
  description.value = "";
  contact.value = "";
  images.value.forEach((image) => URL.revokeObjectURL(image.previewUrl));
  images.value = [];
}

onBeforeUnmount(() => {
  images.value.forEach((image) => URL.revokeObjectURL(image.previewUrl));
});
</script>

<style scoped lang="scss">
.feedback-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;

  > span {
    color: var(--color-text);
    font-size: 13px;
    font-weight: 800;
  }

  small {
    color: var(--color-text-3);
    font-size: 12px;
    font-weight: 500;
  }
}

.image-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.image-item,
.pick-image {
  width: 82px;
  height: 82px;
  border-radius: 8px;
}

.image-item {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-bg-default);

  img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  button {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.56);
    color: #fff;
    cursor: pointer;
    line-height: 20px;
  }
}

.pick-image {
  border: 1px dashed var(--color-border);
  background: var(--color-bg-default);
  color: var(--color-text-2);
  cursor: pointer;
  font-size: 12px;

  span {
    display: block;
    font-size: 24px;
    line-height: 24px;
  }
}

.file-input {
  display: none;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 4px;
}
</style>

<style lang="scss">
.about-feedback-dialog {
  width: min(680px, calc(100vw - 48px));
  border-radius: 8px;
}
</style>
