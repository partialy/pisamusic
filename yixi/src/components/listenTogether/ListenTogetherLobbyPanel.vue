<template>
  <div class="lobby-panel">
    <div class="lobby-heading">
      <h2>一起听</h2>
      <p>创建或加入房间，与手机端同步播放和队列。</p>
    </div>

    <n-tabs v-model:value="mode" type="segment" animated>
      <n-tab-pane name="create" tab="创建房间">
        <n-form label-placement="top" :show-require-mark="false">
          <n-form-item label="房间名称">
            <n-input v-model:value="createForm.roomName" maxlength="16" show-count placeholder="例如：今晚一起听" />
          </n-form-item>
          <n-form-item label="自定义房间号（可选）">
            <n-input v-model:value="createForm.roomId" maxlength="8" placeholder="4-8 位数字" />
          </n-form-item>
          <n-form-item label="最大人数">
            <n-input-number
              v-model:value="createForm.maxPeople"
              :min="2"
              :max="maxPeopleLimit"
              button-placement="both"
              style="width: 100%" />
          </n-form-item>
          <div class="switch-row">
            <div>
              <div class="switch-title">允许成员控制</div>
              <div class="switch-desc">成员可播放、暂停、切歌和调整进度</div>
            </div>
            <n-switch v-model:value="createForm.memberOperation" />
          </div>
          <div v-if="createDisabledReason" class="form-hint">{{ createDisabledReason }}</div>
          <n-button
            block
            round
            type="primary"
            :loading="listenTogether.joining"
            :disabled="Boolean(createDisabledReason)"
            @click="submitCreate(false)">
            创建房间
          </n-button>
        </n-form>
      </n-tab-pane>

      <n-tab-pane name="join" tab="加入房间">
        <n-form label-placement="top" :show-require-mark="false">
          <n-form-item label="房间号">
            <n-input
              v-model:value="joinRoomId"
              maxlength="8"
              placeholder="输入 4-8 位数字房间号"
              @keyup.enter="submitJoin" />
          </n-form-item>
          <n-button block round type="primary" :loading="listenTogether.joining" @click="submitJoin">
            加入房间
          </n-button>
        </n-form>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSwitch,
  NTabPane,
  NTabs,
} from "naive-ui";
import { useAudioStore, useListenTogetherStore } from "@/store";
import { useAccountLoginDialog } from "@/composables/useAccountLoginDialog";

const props = withDefaults(defineProps<{
  initialRoomId?: string;
}>(), {
  initialRoomId: "",
});

const emit = defineEmits<{
  entered: [];
}>();

const audio = useAudioStore();
const listenTogether = useListenTogetherStore();
const { openAccountLogin } = useAccountLoginDialog();
const mode = ref<"create" | "join">("create");
const joinRoomId = ref("");
const createForm = reactive({
  roomName: "",
  roomId: "",
  maxPeople: 2,
  memberOperation: false,
});

const maxPeopleLimit = computed(() => Math.max(2, listenTogether.config?.maxPeopleLimit ?? 8));
const createDisabledReason = computed(() => {
  if (!audio.currentSong) return "先播放一首在线歌曲，再创建房间";
  if (audio.currentSong.source === "local") return "本地歌曲暂不支持一起听";
  return "";
});

watch(
  () => props.initialRoomId,
  (roomId) => {
    const cleanRoomId = roomId.trim();
    if (!cleanRoomId) return;
    joinRoomId.value = cleanRoomId;
    mode.value = "join";
  },
  { immediate: true },
);

onMounted(async () => {
  const config = await listenTogether.loadConfig();
  createForm.maxPeople = config?.defaultMaxPeople ?? createForm.maxPeople;
});

function openLogin(): void {
  openAccountLogin();
}

async function submitCreate(replaceExisting: boolean): Promise<void> {
  const result = await listenTogether.createRoom({
    roomName: createForm.roomName,
    roomId: createForm.roomId,
    maxPeople: createForm.maxPeople,
    memberOperation: createForm.memberOperation,
    replaceExisting,
  });
  if (result.status === "ok") {
    window.$message.success("房间已创建，正在连接");
    emit("entered");
    return;
  }
  if (result.status === "need-login") {
    openLogin();
    return;
  }
  if (result.status === "need-replace-confirm") {
    window.$dialog.warning({
      title: "替换当前房间",
      content: result.message,
      positiveText: "继续创建",
      negativeText: "取消",
      onPositiveClick: () => submitCreate(true),
    });
    return;
  }
  window.$message.error(result.message);
}

async function submitJoin(): Promise<void> {
  const result = await listenTogether.joinRoom(joinRoomId.value);
  if (result.status === "ok") {
    window.$message.success("正在加入房间");
    emit("entered");
    return;
  }
  if (result.status === "need-login") {
    openLogin();
    return;
  }
  window.$message.error(result.message);
}
</script>

<style scoped>
.lobby-panel {
  width: min(440px, calc(100vw - 48px));
  padding: 6px 2px 2px;
}

.lobby-heading {
  margin-bottom: 18px;
}

.lobby-heading h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 22px;
}

.lobby-heading p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 13px;
}

:deep(.n-form-item-label__text) {
  color: var(--text-primary) !important;
  font-weight: 500;
}

:deep(.n-tabs.n-tabs--segment-type) {
  --n-tab-color-segment: var(--surface-control-active) !important;
  --n-tab-text-color: var(--text-secondary) !important;
  --n-tab-text-color-hover: var(--text-primary) !important;
  --n-tab-text-color-active: var(--text-primary) !important;
}

:deep(.n-tabs.n-tabs--segment-type .n-tabs-rail) {
  background-color: var(--surface-card) !important;
  border: 1px solid var(--border-subtle) !important;
  border-radius: 10px !important;
  padding: 3px !important;
}

:deep(.n-tabs.n-tabs--segment-type .n-tabs-capsule),
:deep(.n-tabs.n-tabs--segment-type .n-tabs-capsule .n-tabs-capsule__bar) {
  background-color: var(--surface-control-active) !important;
  border-radius: 8px !important;
}

:deep(.n-tabs.n-tabs--segment-type .n-tabs-tab) {
  color: var(--text-secondary) !important;

  &.n-tabs-tab--active {
    color: var(--text-primary) !important;
    font-weight: 600 !important;
  }
}

:deep(.n-input),
:deep(.n-input-number) {
  background: var(--surface-input) !important;
  border: 1px solid var(--border-subtle) !important;
  color: var(--text-primary) !important;
  border-radius: 10px !important;
}

:deep(.n-input__input-el) {
  color: var(--text-primary) !important;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin: 2px 0 18px;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--surface-card);
  border: 1px solid var(--border-subtle);
}

.switch-title {
  color: var(--text-primary);
  font-weight: 600;
}

.switch-desc,
.form-hint {
  color: var(--text-secondary);
  font-size: 12px;
}

.form-hint {
  margin: -6px 0 12px;
}
</style>
