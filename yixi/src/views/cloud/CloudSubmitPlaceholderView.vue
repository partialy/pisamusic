<template>
  <div class="cloud-submit-page">
    <!-- 顶部标题区（不带返回按钮，直接利用全局 Header 返回） -->
    <div class="page-header">
      <h1 class="page-title">我要投稿</h1>
      <p class="page-desc">上传音乐至公共共享云盘，审核通过后将面向所有用户开放搜索与播放。</p>
    </div>

    <!-- 未登录状态卡片 -->
    <div v-if="!isLogin" class="unlogin-card">
      <div class="unlogin-icon-box">
        <n-icon :component="UploadCloud" :size="48" />
      </div>
      <h3 class="unlogin-title">需要登录账号</h3>
      <p class="unlogin-desc">投稿音乐文件需要与您的 PisaMusic 账号进行关联，请先登录。</p>
      <n-button type="primary" round class="login-btn" @click="openLogin">
        立即登录 / 注册
      </n-button>
    </div>

    <!-- 已登录状态下的投稿流程 -->
    <div v-else class="submit-content">
      <!-- 阶段 1：选择文件与上传 -->
      <section v-if="stage === 'select'" class="stage-section">
        <div
          class="drop-zone"
          :class="{ active: isDragging, 'has-file': Boolean(audioFile) }"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="handleAudioDrop"
          @click="triggerAudioSelect"
        >
          <input
            ref="audioInputRef"
            type="file"
            accept=".mp3,.flac,.wav,.ogg,.m4a,.aac,audio/*"
            class="hidden-input"
            @change="handleAudioSelect"
          />

          <div class="drop-zone-content">
            <div class="drop-icon-box">
              <n-icon :component="audioFile ? Music : UploadCloud" :size="36" />
            </div>
            <div v-if="!audioFile" class="drop-text-group">
              <span class="drop-main-text">点击选择或拖拽音频文件到这里</span>
              <span class="drop-sub-text">支持 MP3, FLAC, WAV, OGG, M4A, AAC 等常见音频格式</span>
            </div>
            <div v-else class="drop-file-info">
              <span class="file-name">{{ audioFile.name }}</span>
              <span class="file-size">{{ formatFileSize(audioFile.size) }}</span>
              <n-button quaternary size="tiny" class="reselect-btn" @click.stop="triggerAudioSelect">
                重新选择
              </n-button>
            </div>
          </div>
        </div>

        <!-- 附加文件（封面与歌词，选填） -->
        <div class="attachments-grid">
          <div class="attachment-card" @click="triggerCoverSelect">
            <input
              ref="coverInputRef"
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/*"
              class="hidden-input"
              @change="handleCoverSelect"
            />
            <div class="attach-icon-box">
              <n-icon :component="Image" :size="20" />
            </div>
            <div class="attach-info">
              <span class="attach-label">封面图片（选填）</span>
              <span class="attach-value">{{ coverFile ? coverFile.name : "默认从音频提取或使用内置封面" }}</span>
            </div>
            <n-button v-if="coverFile" quaternary circle size="small" @click.stop="coverFile = null">
              <template #icon><n-icon :component="X" /></template>
            </n-button>
          </div>

          <div class="attachment-card" @click="triggerLyricsSelect">
            <input
              ref="lyricsInputRef"
              type="file"
              accept=".lrc,.txt"
              class="hidden-input"
              @change="handleLyricsSelect"
            />
            <div class="attach-icon-box">
              <n-icon :component="FileText" :size="20" />
            </div>
            <div class="attach-info">
              <span class="attach-label">歌词文件（选填）</span>
              <span class="attach-value">{{ lyricsFile ? lyricsFile.name : "支持 .lrc 或 .txt 格式" }}</span>
            </div>
            <n-button v-if="lyricsFile" quaternary circle size="small" @click.stop="lyricsFile = null">
              <template #icon><n-icon :component="X" /></template>
            </n-button>
          </div>
        </div>

        <!-- 开始上传与解析按钮 -->
        <div class="action-footer">
          <n-button
            type="primary"
            round
            size="large"
            class="submit-action-btn"
            :disabled="!audioFile || isUploading"
            :loading="isUploading"
            @click="startUploadAndExtract"
          >
            <template #icon>
              <n-icon :component="UploadCloud" />
            </template>
            {{ isUploading ? uploadPhaseText : "上传并解析歌曲元数据" }}
          </n-button>
        </div>

        <!-- 上传进度条 -->
        <div v-if="isUploading" class="upload-progress-box">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" :style="{ width: `${uploadPercent}%` }"></div>
          </div>
          <span class="progress-label">{{ uploadPhaseText }} ({{ uploadPercent }}%)</span>
        </div>
      </section>

      <!-- 阶段 2：元数据确认与编辑 -->
      <section v-else-if="stage === 'edit'" class="stage-section edit-stage">
        <div class="meta-card">
          <!-- 封面管理区 -->
          <div class="cover-wrapper">
            <div class="cover-box">
              <img :src="currentCoverUrl || defaultCoverImg" alt="封面" class="cover-img" />
            </div>
            <div class="cover-actions">
              <input
                ref="replaceCoverInputRef"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/*"
                class="hidden-input"
                @change="handleReplaceCoverSelect"
              />
              <n-button size="small" quaternary class="cover-btn" :loading="isUpdatingCover" @click="triggerReplaceCoverSelect">
                更换封面
              </n-button>
              <n-button
                v-if="currentTrack?.cover.source === 'uploaded'"
                size="small"
                quaternary
                class="cover-btn"
                :loading="isUpdatingCover"
                @click="handleRemoveCover"
              >
                移除封面
              </n-button>
            </div>
          </div>

          <!-- 字段编辑表单 -->
          <div class="form-wrapper">
            <div class="form-grid">
              <div class="form-item">
                <label class="form-label required">歌曲名称</label>
                <n-input
                  v-model:value="editForm.title"
                  placeholder="请输入歌名"
                  maxlength="200"
                  clearable
                />
              </div>

              <div class="form-item">
                <label class="form-label required">歌手 / 艺术家</label>
                <n-input
                  v-model:value="editForm.artist"
                  placeholder="请输入歌手名称"
                  maxlength="300"
                  clearable
                />
              </div>

              <div class="form-item">
                <label class="form-label">专辑名称</label>
                <n-input
                  v-model:value="editForm.album"
                  placeholder="选填"
                  maxlength="200"
                  clearable
                />
              </div>

              <div class="form-item">
                <label class="form-label required">歌曲时长 (分:秒)</label>
                <n-input
                  v-model:value="editForm.durationStr"
                  placeholder="例如 03:45"
                  clearable
                />
              </div>
            </div>

            <!-- 歌词与音频参数展示 -->
            <div class="meta-bottom-row">
              <div class="lyrics-status-chip">
                <n-icon :component="FileText" :size="16" />
                <span>歌词：{{ currentTrack?.lyrics ? `已解析 (${currentTrack.lyrics.format.toUpperCase()})` : "暂无歌词" }}</span>
                <input
                  ref="replaceLyricsInputRef"
                  type="file"
                  accept=".lrc,.txt"
                  class="hidden-input"
                  @change="handleReplaceLyricsSelect"
                />
                <n-button size="tiny" quaternary class="change-lyrics-btn" :loading="isUpdatingLyrics" @click="triggerReplaceLyricsSelect">
                  {{ currentTrack?.lyrics ? "替换歌词" : "上传歌词" }}
                </n-button>
              </div>

              <div v-if="currentTrack?.format" class="audio-tag-chip">
                <span>{{ currentTrack.format.toUpperCase() }}</span>
                <span v-if="currentTrack.durationMs">· {{ formatMsToTime(currentTrack.durationMs) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 提交审核按钮栏 -->
        <div class="edit-actions-footer">
          <n-button quaternary round @click="resetToSelect">
            重新上传文件
          </n-button>
          <n-button
            type="primary"
            round
            size="large"
            class="submit-action-btn"
            :loading="isSaving"
            @click="handleSubmit"
          >
            <template #icon>
              <n-icon :component="CheckCircle2" />
            </template>
            确认并提交审核
          </n-button>
        </div>
      </section>

      <!-- 阶段 3：提交成功 -->
      <section v-else-if="stage === 'success'" class="stage-section success-stage">
        <div class="success-icon-box">
          <n-icon :component="CheckCircle2" :size="64" />
        </div>
        <h2 class="success-title">投稿已提交成功！</h2>
        <div class="status-badge">
          <span class="badge-dot"></span>
          <span>待管理员审核</span>
        </div>
        <p class="success-desc">
          您的音乐投稿《{{ submittedTrack?.title }} - {{ submittedTrack?.artist }}》已成功提交。<br />
          后台审核通过后，将自动上线至共享云盘曲库供所有用户收听与搜索。
        </p>

        <div class="success-actions">
          <n-button type="primary" round size="medium" @click="resetToSelect">
            继续投稿新歌曲
          </n-button>
          <n-button quaternary round size="medium" @click="goToCloud">
            返回共享云盘
          </n-button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { NButton, NIcon, NInput, useMessage } from "naive-ui";
import {
  CheckCircle2,
  FileText,
  Image,
  Music,
  UploadCloud,
  X,
} from "lucide-vue-next";
import { useUserStore } from "@/store/user";
import { useAccountLoginDialog } from "@/composables/useAccountLoginDialog";
import {
  createSubmitSession,
  removeSubmitCover,
  replaceSubmitCover,
  replaceSubmitLyrics,
  saveSubmitTrack,
  uploadAndExtractSession,
} from "@/utils/api/cloudSubmitAPI";
import type { CloudMusicTrackDto } from "@/types/cloudMusic";
import defaultCoverImg from "@/assets/images/default-cover.png";

const router = useRouter();
const message = useMessage();
const userStore = useUserStore();
const { isLogin } = storeToRefs(userStore);
const { openAccountLogin: openLogin } = useAccountLoginDialog();

// 流程阶段：'select' | 'edit' | 'success'
const stage = ref<"select" | "edit" | "success">("select");

// 文件选择
const audioFile = ref<File | null>(null);
const coverFile = ref<File | null>(null);
const lyricsFile = ref<File | null>(null);
const isDragging = ref(false);

const audioInputRef = ref<HTMLInputElement | null>(null);
const coverInputRef = ref<HTMLInputElement | null>(null);
const lyricsInputRef = ref<HTMLInputElement | null>(null);
const replaceCoverInputRef = ref<HTMLInputElement | null>(null);
const replaceLyricsInputRef = ref<HTMLInputElement | null>(null);

// 上传进度
const isUploading = ref(false);
const uploadPercent = ref(0);
const uploadPhase = ref<"audio" | "cover" | "lyrics" | "processing" | "">("");

const uploadPhaseText = computed(() => {
  switch (uploadPhase.value) {
    case "audio":
      return `正在上传音频文件 (${uploadPercent.value}%)`;
    case "cover":
      return `正在上传封面 (${uploadPercent.value}%)`;
    case "lyrics":
      return `正在上传歌词 (${uploadPercent.value}%)`;
    case "processing":
      return "正在解析音频元数据与提取封面...";
    default:
      return "正在准备上传...";
  }
});

// 编辑中的 Track
const currentTrack = ref<CloudMusicTrackDto | null>(null);
const submittedTrack = ref<CloudMusicTrackDto | null>(null);
const isUpdatingCover = ref(false);
const isUpdatingLyrics = ref(false);
const isSaving = ref(false);

const editForm = reactive({
  title: "",
  artist: "",
  album: "",
  durationStr: "00:00",
});

const currentCoverUrl = computed(() => {
  return currentTrack.value?.cover?.url || "";
});

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMsToTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parseTimeToMs(str: string): number {
  const parts = str.trim().split(":");
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s) && m >= 0 && s >= 0 && s < 60) {
      return (m * 60 + s) * 1000;
    }
  }
  const num = parseInt(str, 10);
  return !isNaN(num) && num > 0 ? num : 0;
}

// 触发选择
function triggerAudioSelect() {
  audioInputRef.value?.click();
}
function triggerCoverSelect() {
  coverInputRef.value?.click();
}
function triggerLyricsSelect() {
  lyricsInputRef.value?.click();
}
function triggerReplaceCoverSelect() {
  replaceCoverInputRef.value?.click();
}
function triggerReplaceLyricsSelect() {
  replaceLyricsInputRef.value?.click();
}

function handleAudioSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files[0]) {
    audioFile.value = files[0];
  }
}

function handleAudioDrop(e: DragEvent) {
  isDragging.value = false;
  const files = e.dataTransfer?.files;
  if (files && files[0]) {
    audioFile.value = files[0];
  }
}

function handleCoverSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files[0]) {
    coverFile.value = files[0];
  }
}

function handleLyricsSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (files && files[0]) {
    lyricsFile.value = files[0];
  }
}

// 开始上传
async function startUploadAndExtract() {
  if (!audioFile.value) {
    message.warning("请选择音频文件");
    return;
  }

  isUploading.value = true;
  uploadPercent.value = 0;
  uploadPhase.value = "audio";

  try {
    const session = await createSubmitSession({
      audio: audioFile.value,
      cover: coverFile.value,
      lyrics: lyricsFile.value,
    });

    const track = await uploadAndExtractSession(
      session,
      {
        audio: audioFile.value,
        cover: coverFile.value,
        lyrics: lyricsFile.value,
      },
      (phase, percent) => {
        uploadPhase.value = phase;
        uploadPercent.value = percent;
      }
    );

    currentTrack.value = track;
    editForm.title = track.title || audioFile.value.name.replace(/\.[^/.]+$/, "");
    editForm.artist = track.artist || "未知歌手";
    editForm.album = track.album || "";
    editForm.durationStr = formatMsToTime(track.durationMs || 0);

    stage.value = "edit";
    message.success("音频解析完成，请核对并完善歌曲信息");
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "上传或解析失败";
    message.error(errMsg);
  } finally {
    isUploading.value = false;
    uploadPhase.value = "";
  }
}

// 更换封面
async function handleReplaceCoverSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files || !files[0] || !currentTrack.value) return;
  const file = files[0];
  isUpdatingCover.value = true;
  try {
    const updated = await replaceSubmitCover(currentTrack.value.uuid, file);
    currentTrack.value = updated;
    message.success("封面替换成功");
  } catch (err) {
    message.error(err instanceof Error ? err.message : "更换封面失败");
  } finally {
    isUpdatingCover.value = false;
  }
}

// 移除封面
async function handleRemoveCover() {
  if (!currentTrack.value) return;
  isUpdatingCover.value = true;
  try {
    const updated = await removeSubmitCover(currentTrack.value.uuid);
    currentTrack.value = updated;
    message.success("已移除自定义封面");
  } catch (err) {
    message.error(err instanceof Error ? err.message : "移除封面失败");
  } finally {
    isUpdatingCover.value = false;
  }
}

// 替换歌词
async function handleReplaceLyricsSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files || !files[0] || !currentTrack.value) return;
  const file = files[0];
  isUpdatingLyrics.value = true;
  try {
    const updated = await replaceSubmitLyrics(currentTrack.value.uuid, file);
    currentTrack.value = updated;
    message.success("歌词上传成功");
  } catch (err) {
    message.error(err instanceof Error ? err.message : "上传歌词失败");
  } finally {
    isUpdatingLyrics.value = false;
  }
}

// 提交审核
async function handleSubmit() {
  if (!currentTrack.value) return;
  if (!editForm.title.trim()) {
    message.warning("请输入歌曲名称");
    return;
  }
  if (!editForm.artist.trim()) {
    message.warning("请输入歌手名称");
    return;
  }
  const durationMs = parseTimeToMs(editForm.durationStr);
  if (durationMs <= 0) {
    message.warning("时长格式不正确 (例如 03:45)");
    return;
  }

  isSaving.value = true;
  try {
    const res = await saveSubmitTrack(currentTrack.value.uuid, {
      title: editForm.title.trim(),
      artist: editForm.artist.trim(),
      album: editForm.album.trim(),
      durationMs,
    });
    submittedTrack.value = res;
    stage.value = "success";
    message.success("投稿已提交，正在等待管理员审核");
  } catch (err) {
    message.error(err instanceof Error ? err.message : "提交投稿失败");
  } finally {
    isSaving.value = false;
  }
}

function resetToSelect() {
  audioFile.value = null;
  coverFile.value = null;
  lyricsFile.value = null;
  currentTrack.value = null;
  stage.value = "select";
}

function goToCloud() {
  router.push("/cloud");
}
</script>

<style scoped lang="scss">
.cloud-submit-page {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  overflow-y: auto;
  padding-bottom: 24px;
}

.page-header {
  margin-bottom: 20px;

  .page-title {
    font-size: 26px;
    font-weight: 800;
    color: var(--color-text-default);
    margin: 0 0 6px;
  }

  .page-desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    margin: 0;
  }
}

/* 未登录卡片 */
.unlogin-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 60px 20px;
  border-radius: 16px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border-default);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  max-width: 520px;
  margin: 40px auto 0;
}

.unlogin-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--color-source-cloud) 12%, var(--color-bg-default));
  color: var(--color-source-cloud);
  margin-bottom: 20px;
}

.unlogin-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-default);
  margin: 0 0 8px;
}

.unlogin-desc {
  font-size: 14px;
  color: var(--color-text-secondary);
  max-width: 360px;
  line-height: 1.6;
  margin: 0 0 24px;
}

.login-btn {
  padding: 0 28px;
  font-weight: 600;
}

/* 流程区域 */
.submit-content {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

.stage-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 拖拽区域 */
.drop-zone {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px 20px;
  border-radius: 16px;
  border: 2px dashed var(--color-border-default);
  background: var(--color-card-bg);
  cursor: pointer;
  transition: all 0.25s ease;

  &:hover,
  &.active {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-primary) 4%, var(--color-card-bg));
  }

  &.has-file {
    border-color: var(--color-source-cloud);
    background: color-mix(in srgb, var(--color-source-cloud) 4%, var(--color-card-bg));
  }
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
}

.drop-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-source-cloud) 12%, var(--color-bg-default));
  color: var(--color-source-cloud);
}

.drop-text-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drop-main-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-default);
}

.drop-sub-text {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.drop-file-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;

  .file-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-text-default);
  }

  .file-size {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .reselect-btn {
    color: var(--color-primary);
    margin-top: 4px;
  }
}

/* 附加附件行 */
.attachments-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.attachment-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border-default);
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
  }
}

.attach-icon-box {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.attach-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  .attach-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-default);
  }

  .attach-value {
    font-size: 12px;
    color: var(--color-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.action-footer {
  display: flex;
  justify-content: center;
  margin-top: 10px;
}

.submit-action-btn {
  padding: 0 36px;
  font-weight: 600;
}

.upload-progress-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;

  .progress-bar-bg {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--color-border-default);
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    background: var(--color-primary);
    transition: width 0.2s ease;
  }

  .progress-label {
    font-size: 12px;
    color: var(--color-text-secondary);
  }
}

/* 编辑阶段 */
.meta-card {
  display: flex;
  gap: 24px;
  padding: 24px;
  border-radius: 16px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border-default);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.cover-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;

  .cover-box {
    width: 130px;
    height: 130px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);

    .cover-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  .cover-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
  }

  .cover-btn {
    width: 100%;
    font-size: 12px;
  }
}

.form-wrapper {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;

  .form-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-default);

    &.required::after {
      content: " *";
      color: #ef4444;
    }
  }
}

.meta-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--color-border-default);
}

.lyrics-status-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);

  .change-lyrics-btn {
    color: var(--color-primary);
  }
}

.audio-tag-chip {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
  font-family: monospace;
}

.edit-actions-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}

/* 成功阶段 */
.success-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 20px;
  border-radius: 16px;
  background: var(--color-card-bg);
  border: 1px solid var(--color-border-default);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.success-icon-box {
  color: #10b981;
  margin-bottom: 16px;
}

.success-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--color-text-default);
  margin: 0 0 10px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  background: rgba(245, 158, 11, 0.12);
  color: #d97706;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 16px;

  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
  }
}

.success-desc {
  font-size: 14px;
  line-height: 1.8;
  color: var(--color-text-secondary);
  max-width: 480px;
  margin: 0 0 28px;
}

.success-actions {
  display: flex;
  gap: 16px;
}

.hidden-input {
  display: none;
}
</style>
