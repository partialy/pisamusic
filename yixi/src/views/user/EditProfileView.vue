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
        <n-form-item label="头像">
          <div class="avatar-options">
            <button
              v-for="item in avatarOptions"
              :key="item.key"
              type="button"
              class="avatar-option"
              :class="{ active: form.avatarKey === item.key }"
              @click="form.avatarKey = item.key">
              <img :src="item.url" alt="" />
              <span>{{ item.label }}</span>
            </button>
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
import { computed, h, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { NButton, NForm, NFormItem, NInput } from "naive-ui";
import { storeToRefs } from "pinia";
import { LoginCard } from "@/components";
import { useUserStore } from "@/store";

defineOptions({ name: "EditUserProfileView" });

type AvatarOption = Awaited<ReturnType<typeof window.electronAPI.getAccountAvatarOptions>>[number];

const router = useRouter();
const userStore = useUserStore();
const { isLogin, userInfo } = storeToRefs(userStore);
const avatarOptions = ref<AvatarOption[]>([]);
const saving = ref(false);
const form = reactive({
  username: "",
  avatarKey: "default",
});

const createdAtText = computed(() => formatTime(userInfo.value.createdAt));

onMounted(async () => {
  resetForm();
  avatarOptions.value = await window.electronAPI.getAccountAvatarOptions();
});

watch(
  () => userInfo.value.id,
  () => resetForm(),
);

function resetForm() {
  form.username = userInfo.value.username || "";
  form.avatarKey = userInfo.value.avatarKey || "default";
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

function buildPayload(username: string) {
  const payload: Parameters<typeof userStore.updateProfile>[0] = {};
  if (username !== userInfo.value.username) payload.username = username;
  if (form.avatarKey !== (userInfo.value.avatarKey || "default")) payload.avatarKey = form.avatarKey;
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

.avatar-options {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(6, minmax(84px, 1fr));
  gap: 12px;
  width: 100%;
}

.avatar-option {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 10px 8px;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-bg-default) 76%, transparent);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease;

  img {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    object-fit: cover;
  }

  span {
    font-size: 12px;
  }

  &.active {
    border-color: var(--color-primary);
    color: var(--color-text-default);
    transform: translateY(-2px);
  }
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.empty-state {
  padding: 42px;
  text-align: center;
}

@media (max-width: 720px) {
  .profile-form,
  .avatar-options {
    grid-template-columns: 1fr;
  }

  .page-head,
  .actions {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
