<template>
  <div class="profile-page">
    <section v-if="isLogin" class="profile-shell">
      <div class="profile-hero">
        <n-avatar :src="avatarSrc" round :size="88" class="profile-avatar" />
        <div class="profile-title">
          <h1>{{ userInfo.username }}</h1>
          <p>{{ userInfo.email }}</p>
        </div>
        <div class="profile-actions">
          <n-button type="primary" round @click="goEdit">编辑资料</n-button>
          <n-button secondary round @click="openSecurityDialog('change-email')">修改邮箱</n-button>
          <n-button secondary round @click="openSecurityDialog('change-password')">修改密码</n-button>
          <n-button tertiary round @click="openSecurityDialog('reset-password')">重置密码</n-button>
        </div>
      </div>

      <div class="profile-grid">
        <div class="info-item">
          <span>用户 UUID</span>
          <strong>{{ userInfo.id }}</strong>
        </div>
        <div class="info-item">
          <span>注册时间</span>
          <strong>{{ createdAtText }}</strong>
        </div>
        <div class="info-item">
          <span>头像类型</span>
          <strong>{{ avatarKindText }}</strong>
        </div>
        <div class="info-item">
          <span>账号邮箱</span>
          <strong>{{ userInfo.email }}</strong>
        </div>
      </div>
    </section>

    <section v-else class="empty-state">
      <h1>登录账号后查看资料</h1>
      <p>账号资料包含 UUID、注册时间、昵称、邮箱和账号头像。</p>
      <n-button type="primary" round @click="openLogin">登录 / 注册</n-button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from "vue";
import { useRouter } from "vue-router";
import { NAvatar, NButton } from "naive-ui";
import { storeToRefs } from "pinia";
import { LoginCard } from "@/components";
import AccountSecurityDialog from "@/components/user/AccountSecurityDialog.vue";
import { useUserStore } from "@/store";
import avatarImg from "@/assets/defaultAdminAvatar.jpg";

defineOptions({ name: "UserProfileView" });

type SecurityMode = InstanceType<typeof AccountSecurityDialog>["$props"]["mode"];

const router = useRouter();
const userStore = useUserStore();
const { isLogin, userInfo } = storeToRefs(userStore);

const avatarSrc = computed(() => userInfo.value.avatarUrl || userInfo.value.avatar || avatarImg);
const createdAtText = computed(() => formatTime(userInfo.value.createdAt));
const avatarKindText = computed(() => (userInfo.value.avatarKey === "default" ? "默认头像" : "自定义头像"));

function goEdit() {
  router.push("/user/editProfile");
}

function openLogin() {
  window.$modal.create({
    style: { borderRadius: "12px" },
    preset: "dialog",
    closable: true,
    content: () => h(LoginCard),
  });
}

function openSecurityDialog(mode: SecurityMode) {
  const modal = window.$modal.create({
    style: { borderRadius: "12px" },
    preset: "dialog",
    closable: true,
    showIcon: false,
    content: () =>
      h(AccountSecurityDialog, {
        mode,
        onDone: () => modal.destroy(),
      }),
  });
}

function formatTime(value: number) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}
</script>

<style lang="scss" scoped>
.profile-page {
  min-height: 100%;
  padding: 28px;
}

.profile-shell,
.empty-state {
  width: min(980px, 100%);
  margin: 0 auto;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-bg-default) 92%, var(--color-primary) 8%);
  box-shadow: 0 18px 48px rgba(15, 74, 132, 0.12);
}

.profile-shell {
  padding: 26px;
}

.profile-hero {
  display: flex;
  align-items: center;
  gap: 18px;
  padding-bottom: 24px;
  border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
}

.profile-avatar {
  box-shadow: 0 12px 28px rgba(40, 151, 255, 0.18);

  :deep(img) {
    object-fit: cover;
  }
}

.profile-title {
  min-width: 0;
  flex: 1;

  h1 {
    margin: 0;
    color: var(--color-text-default);
    font-size: 26px;
    font-weight: 800;
  }

  p {
    margin: 6px 0 0;
    color: var(--color-text-muted);
    font-size: 14px;
  }
}

.profile-actions {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 10px;
  min-width: 470px;

  :deep(.n-button) {
    min-width: 92px;
    white-space: nowrap;
  }
}

.profile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 22px;
}

.info-item {
  min-width: 0;
  padding: 16px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--color-bg-default) 70%, transparent);

  span {
    display: block;
    color: var(--color-text-muted);
    font-size: 12px;
  }

  strong {
    display: block;
    margin-top: 8px;
    color: var(--color-text-default);
    font-size: 14px;
    word-break: break-all;
  }
}

.empty-state {
  padding: 42px;
  text-align: center;

  h1 {
    margin: 0;
    color: var(--color-text-default);
    font-size: 24px;
  }

  p {
    margin: 10px 0 22px;
    color: var(--color-text-muted);
  }
}

@media (max-width: 720px) {
  .profile-hero,
  .profile-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .profile-actions {
    min-width: 0;
    max-width: none;
  }

  .profile-grid {
    grid-template-columns: 1fr;
  }
}
</style>
