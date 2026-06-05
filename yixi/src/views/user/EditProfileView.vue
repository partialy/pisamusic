<template>
  <div class="edit-profile-page">
    <section v-if="isLogin" class="edit-shell">
      <div class="page-head">
        <div>
          <h1>编辑用户资料</h1>
          <p>UUID、注册时间和账号邮箱由系统管理；邮箱请回到资料页单独修改。</p>
        </div>
        <n-button secondary round @click="goProfile">返回资料</n-button>
      </div>

      <n-form class="profile-form" label-placement="top" :model="form">
        <n-form-item label="用户 UUID">
          <n-input :value="userInfo.id" readonly />
        </n-form-item>
        <n-form-item label="注册时间">
          <n-input :value="createdAtText" readonly />
        </n-form-item>
        <n-form-item label="账号邮箱">
          <n-input :value="userInfo.email" readonly />
        </n-form-item>
        <n-form-item label="昵称">
          <n-input v-model:value="form.username" maxlength="32" show-count placeholder="请输入昵称" />
        </n-form-item>
        <n-form-item class="avatar-form-item" label="头像">
          <div class="avatar-editor">
            <n-avatar :src="avatarSrc" round :size="72" class="avatar-preview" />
            <div class="avatar-meta">
              <strong>{{ avatarKindText }}</strong>
              <span>{{ userInfo.avatarKey === "default" ? "使用内置默认头像" : "使用自定义上传头像" }}</span>
            </div>
            <div class="avatar-actions">
              <n-button secondary round :loading="avatarSaving" @click="uploadAvatar">上传头像</n-button>
              <n-button tertiary round :disabled="avatarSaving || userInfo.avatarKey === 'default'" @click="restoreDefaultAvatar">恢复默认</n-button>
            </div>
          </div>
        </n-form-item>
      </n-form>

      <div class="actions">
        <n-button secondary round @click="resetForm">重置</n-button>
        <n-button type="primary" round :loading="saving" @click="saveProfile">保存资料</n-button>
      </div>
    </section>

    <section v-else class="empty-state">
      <h1>登录后编辑资料</h1>
      <p>请先登录账号，再修改昵称和头像。</p>
      <n-button type="primary" round @click="openLogin">登录 / 注册</n-button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, h, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { NAvatar, NButton, NForm, NFormItem, NInput } from "naive-ui";
import { storeToRefs } from "pinia";
import { LoginCard } from "@/components";
import { useUserStore } from "@/store";
import avatarImg from "@/assets/defaultAdminAvatar.jpg";

defineOptions({ name: "EditUserProfileView" });

const router = useRouter();
const userStore = useUserStore();
const { isLogin, userInfo } = storeToRefs(userStore);
const saving = ref(false);
const avatarSaving = ref(false);
const form = reactive({
  username: "",
});

const createdAtText = computed(() => formatTime(userInfo.value.createdAt));
const avatarSrc = computed(() => userInfo.value.avatarUrl || userInfo.value.avatar || avatarImg);
const avatarKindText = computed(() => (userInfo.value.avatarKey === "default" ? "默认头像" : "自定义头像"));

watch(
  () => userInfo.value.id,
  () => resetForm(),
  { immediate: true },
);

function resetForm() {
  form.username = userInfo.value.username || "";
}

async function saveProfile() {
  const username = form.username.trim();
  if (!username) {
    window.$message.warning("请输入昵称");
    return;
  }

  const payload = buildPayload(username);
  if (!Object.keys(payload).length) {
    window.$message.info("资料未变化");
    return;
  }

  saving.value = true;
  try {
    await userStore.updateProfile(payload);
    window.$message.success("资料已更新");
    router.push("/user/profile");
  } catch (error) {
    window.$message.error(errorMessage(error, "资料更新失败"));
  } finally {
    saving.value = false;
  }
}

async function uploadAvatar() {
  avatarSaving.value = true;
  try {
    const result = await window.electronAPI.uploadAccountAvatar();
    if (result.canceled) return;
    userStore.setSession(result.session);
    window.$message.success("头像已更新");
  } catch (error) {
    window.$message.error(errorMessage(error, "头像上传失败"));
  } finally {
    avatarSaving.value = false;
  }
}

async function restoreDefaultAvatar() {
  if (userInfo.value.avatarKey === "default") {
    window.$message.info("当前已是默认头像");
    return;
  }
  avatarSaving.value = true;
  try {
    await userStore.updateProfile({ avatarKey: "default" });
    window.$message.success("已恢复默认头像");
  } catch (error) {
    window.$message.error(errorMessage(error, "恢复默认头像失败"));
  } finally {
    avatarSaving.value = false;
  }
}

function buildPayload(username: string) {
  const payload: Parameters<typeof userStore.updateProfile>[0] = {};
  if (username !== userInfo.value.username) payload.username = username;
  return payload;
}

function goProfile() {
  router.push("/user/profile");
}

function openLogin() {
  window.$modal.create({
    style: { borderRadius: "12px" },
    preset: "dialog",
    closable: true,
    content: () => h(LoginCard),
  });
}

function formatTime(value: number) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
</script>

<style lang="scss" scoped>
.edit-profile-page {
  min-height: 100%;
  padding: 28px;
}

.edit-shell,
.empty-state {
  width: min(780px, 100%);
  margin: 0 auto;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-bg-default) 92%, var(--color-primary) 8%);
  box-shadow: 0 18px 48px rgba(15, 74, 132, 0.12);
}

.edit-shell {
  padding: 26px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;

  h1 {
    margin: 0;
    color: var(--color-text-default);
    font-size: 24px;
    font-weight: 800;
  }

  p {
    margin: 6px 0 0;
    color: var(--color-text-muted);
    font-size: 13px;
  }
}

.profile-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}

.avatar-form-item {
  grid-column: 1 / -1;
}

.avatar-editor {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 16px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-bg-default) 76%, transparent);
}

.avatar-preview {
  box-shadow: 0 10px 24px rgba(40, 151, 255, 0.16);

  :deep(img) {
    object-fit: cover;
  }
}

.avatar-meta {
  min-width: 0;

  strong,
  span {
    display: block;
  }

  strong {
    color: var(--color-text-default);
    font-size: 15px;
  }

  span {
    margin-top: 4px;
    color: var(--color-text-muted);
    font-size: 12px;
  }
}

.avatar-actions,
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.actions {
  margin-top: 8px;
}

.empty-state {
  padding: 42px;
  text-align: center;
}

@media (max-width: 720px) {
  .profile-form {
    grid-template-columns: 1fr;
  }

  .avatar-editor,
  .page-head,
  .actions {
    align-items: stretch;
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .avatar-actions {
    justify-content: stretch;
    flex-direction: column;
  }
}
</style>
