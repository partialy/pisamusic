<template>
  <button
    type="button"
    class="listen-entry"
    :class="{ active: listenTogether.enabled, overlay: variant === 'overlay', disabled: serviceUnavailable }"
    :title="entryTitle"
    @click="handleEntryClick">
    <template v-if="listenTogether.enabled">
      <div class="avatar-stack">
        <n-avatar
          v-for="member in visibleMembers"
          :key="member.userId"
          round
          :size="24"
          :src="member.avatarUrl"
          :fallback-src="defaultAvatar" />
        <span v-if="hasMoreMembers" class="more-members">...</span>
      </div>
    </template>
    <Headphones v-else :size="18" />
  </button>

  <n-modal v-model:show="showPanel" transform-origin="center">
    <n-card class="listen-card" :bordered="false" role="dialog" aria-modal="true">
      <ListenTogetherRoomPanel v-if="listenTogether.enabled" @left="showPanel = false" />
      <ListenTogetherLobbyPanel
        v-else
        :initial-room-id="inviteRoomId"
        @entered="handleEntered" />
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { NAvatar, NCard, NModal } from "naive-ui";
import { Headphones } from "lucide-vue-next";
import { useListenTogetherStore, useUserStore } from "@/store";
import LoginCard from "@/components/home/LoginCard.vue";
import {
  decideListenTogetherInvite,
  type ListenTogetherInvite,
} from "@/listenTogether/listenTogetherShareLink";
import defaultAvatar from "@/assets/defaultAdminAvatar.jpg";
import ListenTogetherLobbyPanel from "./ListenTogetherLobbyPanel.vue";
import ListenTogetherRoomPanel from "./ListenTogetherRoomPanel.vue";

const props = withDefaults(defineProps<{
  variant?: "default" | "overlay";
}>(), {
  variant: "default",
});

const listenTogether = useListenTogetherStore();
const userStore = useUserStore();
const showPanel = ref(false);
const inviteRoomId = ref("");
const pendingInvite = ref<ListenTogetherInvite | null>(null);
const visibleMembers = computed(() => listenTogether.displayMembers.slice(0, 2));
const hasMoreMembers = computed(() => listenTogether.displayMembers.length > 2);
let stopInviteListener: (() => void) | null = null;
let loginModal: { destroy: () => void } | null = null;
let switchDialog: { destroy: () => void } | null = null;
let inviteSequence = 0;
// 本地模式（在线服务不可用）时禁用入口；已在房间内的状态展示不受影响
const serviceUnavailable = computed(
  () => !listenTogether.onlineServiceAvailable && !listenTogether.enabled,
);
const entryTitle = computed(() => {
  if (serviceUnavailable.value) return "在线服务不可用，一起听暂不可用";
  return listenTogether.enabled ? "查看一起听房间" : "开始一起听";
});

function handleEntryClick(): void {
  if (serviceUnavailable.value) {
    window.$message?.warning?.("在线服务不可用，一起听暂不可用");
    return;
  }
  showPanel.value = true;
}

function handleEntered(): void {
  showPanel.value = true;
}

function receiveInvite(invite: ListenTogetherInvite): void {
  inviteSequence += 1;
  pendingInvite.value = invite;
  inviteRoomId.value = invite.roomId;
  showPanel.value = true;
  switchDialog?.destroy();
  switchDialog = null;
  void processPendingInvite(inviteSequence);
}

async function processPendingInvite(sequence: number): Promise<void> {
  const invite = pendingInvite.value;
  if (!invite || sequence !== inviteSequence) return;
  const decision = decideListenTogetherInvite(invite, {
    currentRoomId: listenTogether.room?.roomId,
    isLoggedIn: userStore.isLogin,
    onlineServiceAvailable: listenTogether.onlineServiceAvailable,
  });

  if (decision === "open-current-room") {
    consumeInvite(sequence);
    return;
  }
  if (decision === "service-unavailable") {
    window.$message.warning("在线服务不可用，一起听暂不可用");
    consumeInvite(sequence);
    return;
  }
  if (decision === "request-login") {
    openInviteLogin();
    return;
  }
  if (decision === "confirm-switch-room") {
    confirmSwitchRoom(invite, sequence);
    return;
  }
  await joinInvitedRoom(invite, sequence, false);
}

function openInviteLogin(): void {
  if (loginModal) return;
  loginModal = window.$modal.create({
    preset: "dialog",
    closable: true,
    title: "登录 PisaMusic 账号",
    content: () => h(LoginCard),
    onAfterLeave: () => {
      loginModal = null;
    },
  });
}

function confirmSwitchRoom(invite: ListenTogetherInvite, sequence: number): void {
  switchDialog = window.$dialog.warning({
    title: "切换一起听房间",
    content: `当前已在其他房间，是否退出并加入房间 ${invite.roomId}？`,
    positiveText: "确认",
    negativeText: "取消",
    closable: false,
    onPositiveClick: () => {
      switchDialog = null;
      void joinInvitedRoom(invite, sequence, true);
    },
    onNegativeClick: () => {
      switchDialog = null;
      consumeInvite(sequence);
    },
  });
}

async function joinInvitedRoom(
  invite: ListenTogetherInvite,
  sequence: number,
  switchRoom: boolean,
): Promise<void> {
  const result = switchRoom
    ? await listenTogether.switchRoom(invite.roomId)
    : await listenTogether.joinRoom(invite.roomId);
  if (sequence !== inviteSequence) return;
  if (result.status === "ok") {
    window.$message.success(switchRoom ? "正在切换一起听房间" : "正在加入房间");
    consumeInvite(sequence);
    return;
  }
  if (result.status === "need-login") {
    openInviteLogin();
    return;
  }
  window.$message.error(result.message);
  consumeInvite(sequence);
}

function consumeInvite(sequence: number): void {
  if (sequence !== inviteSequence) return;
  pendingInvite.value = null;
}

watch(
  () => userStore.isLogin,
  (isLoggedIn) => {
    if (!isLoggedIn || !pendingInvite.value) return;
    loginModal = null;
    void processPendingInvite(inviteSequence);
  },
);

onMounted(() => {
  if (props.variant !== "default") return;
  stopInviteListener = window.electronAPI.onListenTogetherInvite(receiveInvite);
});

onBeforeUnmount(() => {
  stopInviteListener?.();
  loginModal?.destroy();
  switchDialog?.destroy();
});
</script>

<style scoped>
.listen-entry {
  display: inline-flex;
  min-width: 34px;
  height: 34px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 999px;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
  transition: 0.2s ease;
}

.listen-entry:hover,
.listen-entry.active {
  border-color: color-mix(in srgb, var(--color-primary) 30%, transparent);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.listen-entry.overlay {
  color: #ffffffb3;
  background: #ffffff10;
}

.listen-entry.overlay:hover,
.listen-entry.overlay.active {
  border-color: #ffffff40;
  color: #fff;
  background: #ffffff20;
}

.listen-entry.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.listen-entry.disabled:hover {
  border-color: transparent;
  color: var(--color-text-secondary);
  background: transparent;
}

.avatar-stack {
  display: flex;
  align-items: center;
}

.avatar-stack :deep(.n-avatar) {
  margin-left: -6px;
  border: 2px solid var(--color-bg-default);
}

.avatar-stack :deep(.n-avatar:first-child) {
  margin-left: 0;
}

.more-members {
  margin-left: 4px;
  color: currentColor;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
}

:global(.listen-card.n-card) {
  width: auto;
  max-width: calc(100vw - 32px);
  border-radius: 20px;
  background: color-mix(in srgb, var(--color-bg-default) 94%, transparent);
  box-shadow: 0 24px 80px #00000033;
}
</style>
