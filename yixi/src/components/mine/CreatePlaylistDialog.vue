<template>
  <AppModal :show="show" title="新建歌单" :icon="ListPlus" :width="480" :close-disabled="submitting" @update:show="closeDialog">
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

    <template #footer>
      <n-button quaternary class="cancel-btn" @click="closeDialog">取消</n-button>
      <n-button class="confirm-btn" :loading="submitting" @click="submit">确定</n-button>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import AppModal from "@/components/common/AppModal.vue";
import { computed, reactive, ref } from "vue";
import { NButton, NInput, NTag } from "naive-ui";
import { ListPlus } from "lucide-vue-next";
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
.cover-row {
  display: grid;
  grid-template-columns: 86px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  margin-bottom: 18px;

  img {
    width: 86px;
    height: 86px;
    border-radius: var(--radius-control);
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
  border-radius: var(--radius-pill);
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

.cancel-btn,
.confirm-btn {
  min-width: 84px;
  border-radius: var(--radius-pill);
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

</style>
