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
      <ListenTogetherLobbyPanel v-else @entered="handleEntered" />
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NAvatar, NCard, NModal } from "naive-ui";
import { Headphones } from "lucide-vue-next";
import { useListenTogetherStore } from "@/store";
import defaultAvatar from "@/assets/defaultAdminAvatar.jpg";
import ListenTogetherLobbyPanel from "./ListenTogetherLobbyPanel.vue";
import ListenTogetherRoomPanel from "./ListenTogetherRoomPanel.vue";

withDefaults(defineProps<{
  variant?: "default" | "overlay";
}>(), {
  variant: "default",
});

const listenTogether = useListenTogetherStore();
const showPanel = ref(false);
const visibleMembers = computed(() => listenTogether.displayMembers.slice(0, 2));
const hasMoreMembers = computed(() => listenTogether.displayMembers.length > 2);
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
