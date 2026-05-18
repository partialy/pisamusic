<template>
  <Teleport to="body">
    <Transition name="playlist-dialog">
      <div v-if="show" class="playlist-dialog-overlay" @click.self="closeDialog">
        <section class="playlist-dialog-panel" role="dialog" aria-modal="true" @click.stop>
          <header class="dialog-header">
            <div class="dialog-title">
              <div class="title-icon">
                <n-icon :component="ListPlus" />
              </div>
              <span>新建歌单</span>
            </div>
            <button class="close-btn" type="button" aria-label="关闭" @click="closeDialog">
              <n-icon :component="X" />
            </button>
          </header>

          <div class="dialog-body">
            <div class="cover-row">
              <img :src="coverPreview" alt="歌单封面" />
              <div class="cover-actions">
                <n-button secondary class="cover-btn" @click="chooseCover">上传封面</n-button>
                <div class="cover-tip">未上传时使用默认封面</div>
              </div>
            </div>

            <label class="form-row">
              <span>标题</span>
              <n-input v-model:value="form.name" maxlength="40" show-count placeholder="输入歌单标题" />
            </label>

            <label class="form-row">
              <span>描述</span>
              <n-input
                v-model:value="form.desc"
                type="textarea"
                maxlength="160"
                show-count
                placeholder="可选，写点这个歌单的心情" />
            </label>

            <div class="form-row">
              <span>标签</span>
              <div class="tag-box">
                <div class="tag-list" v-if="form.tags.length">
                  <n-tag
                    v-for="tag in form.tags"
                    :key="tag.id"
                    closable
                    round
                    @close="removeTag(tag.id)">
                    {{ tag.name }}
                  </n-tag>
                </div>
                <div class="tag-input-row">
                  <n-input
                    v-model:value="tagInput"
                    :disabled="form.tags.length >= 3"
                    maxlength="12"
                    placeholder="最多 3 个标签"
                    @keyup.enter="addTag" />
                  <n-button secondary :disabled="form.tags.length >= 3" @click="addTag">添加</n-button>
                </div>
              </div>
            </div>
          </div>

          <footer class="dialog-actions">
            <n-button quaternary class="cancel-btn" @click="closeDialog">取消</n-button>
            <n-button class="confirm-btn" :loading="submitting" @click="submit">确定</n-button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { NButton, NIcon, NInput, NTag } from "naive-ui";
import { ListPlus, X } from "lucide-vue-next";
import type { CommonPlaylist } from "@/types/song";
import { useMineLibraryStore } from "@/store";
import { selectPlaylistCover } from "@/utils/api/mineLibraryAPI";
import defaultCover from "@/assets/images/default-created-playlist-cover.svg";

const emit = defineEmits<{
  created: [playlist: CommonPlaylist];
}>();

const store = useMineLibraryStore();
const show = ref(false);
const submitting = ref(false);
const tagInput = ref("");
const form = reactive({
  name: "",
  desc: "",
  cover: "",
  tags: [] as CommonPlaylist["tags"],
});

const coverPreview = computed(() => form.cover || defaultCover);

function open() {
  resetForm();
  show.value = true;
}

function closeDialog() {
  if (submitting.value) return;
  show.value = false;
}

async function chooseCover() {
  const cover = await selectPlaylistCover();
  if (cover) form.cover = cover;
}

function addTag() {
  const name = tagInput.value.trim();
  if (!name) return;
  if (form.tags.length >= 3) {
    window.$message.warning("最多添加 3 个标签");
    return;
  }
  if (form.tags.some((tag) => tag.name === name)) {
    tagInput.value = "";
    return;
  }
  form.tags.push({ name, id: name });
  tagInput.value = "";
}

function removeTag(id: string) {
  form.tags = form.tags.filter((tag) => tag.id !== id);
}

async function submit() {
  const name = form.name.trim();
  if (!name) {
    window.$message.warning("请填写歌单标题");
    return;
  }

  submitting.value = true;
  try {
    const playlist = await store.createPlaylist({
      name,
      desc: form.desc.trim(),
      cover: form.cover,
      tags: form.tags,
    });
    emit("created", playlist);
    window.$message.success("歌单创建成功");
    show.value = false;
  } catch (error) {
    window.$message.error(error instanceof Error ? error.message : "歌单创建失败");
  } finally {
    submitting.value = false;
  }
}

function resetForm() {
  form.name = "";
  form.desc = "";
  form.cover = "";
  form.tags = [];
  tagInput.value = "";
}

defineExpose({ open });
</script>

<style scoped lang="scss">
.playlist-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.34);
  backdrop-filter: blur(14px) saturate(118%);
}

.playlist-dialog-panel {
  width: min(480px, calc(100vw - 32px));
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--color-bg-default) 74%, transparent);
  background: var(--color-bg-track);
  box-shadow:
    0 30px 86px rgba(10, 18, 32, 0.25),
    0 12px 34px rgba(10, 18, 32, 0.16);
  backdrop-filter: blur(28px) saturate(138%);
}

:global(:root[data-theme="dark"]) .playlist-dialog-panel {
  border-color: color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.dialog-header,
.dialog-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 10px;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--color-text-default);
  font-size: 20px;
  font-weight: 800;
}

.title-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
}

.dialog-body {
  padding: 14px 24px 8px;
}

.cover-row {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;

  img {
    width: 86px;
    height: 86px;
    border-radius: 18px;
    object-fit: cover;
    box-shadow: 0 12px 28px rgba(10, 18, 32, 0.16);
  }
}

.cover-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.cover-btn {
  border-radius: 12px;
}

.cover-tip {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.form-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: flex-start;
  gap: 12px;
  margin-top: 14px;

  > span {
    padding-top: 8px;
    color: var(--color-text-secondary);
    font-size: 13px;
    font-weight: 650;
  }
}

.tag-box,
.tag-input-row,
.tag-list {
  min-width: 0;
  display: flex;
  gap: 8px;
}

.tag-box {
  flex-direction: column;
}

.tag-list {
  flex-wrap: wrap;
}

.dialog-actions {
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 24px;
}

.cancel-btn,
.confirm-btn {
  min-width: 84px;
  height: 40px;
  border-radius: 14px;
}

.confirm-btn {
  color: #fff;
  background: var(--color-primary);
  box-shadow: 0 12px 26px color-mix(in srgb, var(--color-primary) 34%, transparent);

  &:hover {
    color: #fff;
    background: var(--color-primary-hover);
  }
}

.playlist-dialog-enter-active,
.playlist-dialog-leave-active {
  transition: opacity 0.18s ease;

  .playlist-dialog-panel {
    transition:
      transform 0.18s ease,
      opacity 0.18s ease;
  }
}

.playlist-dialog-enter-from,
.playlist-dialog-leave-to {
  opacity: 0;

  .playlist-dialog-panel {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}
</style>
