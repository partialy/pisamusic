<template>
  <DirectMessageDialog
    :show="visible"
    :message="presentedMessage"
    :unlock-at="unlockAt"
    @confirmed="dismissCurrentMessage"
    @after-leave="handleAfterLeave" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useUserStore } from "@/store";
import type { DirectMessageItem } from "@/types/directMessage";
import { useStartupPopupGate } from "@/composables/useStartupPopupGate";
import DirectMessageDialog from "./DirectMessageDialog.vue";

defineOptions({ name: "AppDirectMessagePopup" });

const props = defineProps<{
  ready: boolean;
  online: boolean;
}>();

const userStore = useUserStore();
const {
  announcementVisible,
  canPresentDirectMessages,
  setDirectMessagesSettled,
} = useStartupPopupGate();
const accountId = computed(() => userStore.userInfo.id || "");
const queue = ref<DirectMessageItem[]>([]);
const presentedMessage = ref<DirectMessageItem | null>(null);
const visible = ref(false);
const unlockAt = ref<number | null>(null);
let fetchGeneration = 0;
let isLeaving = false;

function resetQueue() {
  queue.value = [];
  unlockAt.value = null;
}

function setSettled() {
  setDirectMessagesSettled(true);
}

function hideCurrentMessage() {
  if (!presentedMessage.value || !visible.value) return false;
  isLeaving = true;
  visible.value = false;
  return true;
}

function presentNextMessage() {
  if (isLeaving || visible.value || !canPresentDirectMessages()) return;
  const nextMessage = queue.value.shift() || null;
  if (!nextMessage) {
    presentedMessage.value = null;
    unlockAt.value = null;
    setSettled();
    return;
  }
  presentedMessage.value = nextMessage;
  if (unlockAt.value === null) unlockAt.value = performance.now() + 3000;
  visible.value = true;
}

async function fetchUnreadMessages() {
  const generation = ++fetchGeneration;
  const requestedAccountId = accountId.value;
  setDirectMessagesSettled(false);

  try {
    const page = await window.electronAPI.listUnreadDirectMessages();
    if (generation !== fetchGeneration || requestedAccountId !== accountId.value) return;
    resetQueue();
    queue.value = Array.isArray(page.items) ? [...page.items] : [];
    presentNextMessage();
  } catch (error) {
    if (generation !== fetchGeneration || requestedAccountId !== accountId.value) return;
    resetQueue();
    if (!isLeaving) setSettled();
    void window.electronAPI.reportError(error, {
      scope: "startup",
      action: "fetchDirectMessages",
    });
  }
}

function refreshForCurrentIdentity() {
  if (!props.ready) return;
  if (!props.online) {
    fetchGeneration += 1;
    resetQueue();
    if (!hideCurrentMessage()) setSettled();
    return;
  }

  resetQueue();
  hideCurrentMessage();
  void fetchUnreadMessages();
}

function dismissCurrentMessage() {
  const message = presentedMessage.value;
  if (!message || !visible.value || performance.now() < (unlockAt.value ?? Infinity)) return;
  // 先切换 UI，再让 main 侧异步回执；网络慢或失败不能阻塞用户继续阅读。
  window.electronAPI.dismissDirectMessage(message.id);
  hideCurrentMessage();
}

function handleAfterLeave() {
  isLeaving = false;
  presentedMessage.value = null;
  presentNextMessage();
}

watch(
  () => [props.ready, props.online, accountId.value] as const,
  ([ready]) => {
    if (ready) refreshForCurrentIdentity();
  },
  { immediate: true },
);

watch(announcementVisible, (visible) => {
  if (!visible) presentNextMessage();
});

onBeforeUnmount(() => {
  fetchGeneration += 1;
});
</script>
