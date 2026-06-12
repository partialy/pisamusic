<template>
  <div v-if="room" class="room-panel">
    <div class="room-heading">
      <div>
        <div class="room-title-row">
          <h2>{{ room.roomName }}</h2>
          <n-tag size="small" round :type="listenTogether.isHost ? 'warning' : 'info'">
            {{ listenTogether.isHost ? "房主" : "成员" }}
          </n-tag>
        </div>
        <button class="room-id" type="button" @click="copyRoomId">
          房间号 {{ room.roomId }}
          <Copy :size="14" />
        </button>
      </div>
      <div class="connection" :class="{ offline: !listenTogether.socketConnected }">
        <span class="connection-dot"></span>
        {{ connectionText }}
      </div>
    </div>

    <div class="now-playing">
      <n-avatar rounded :size="68" :src="songCover" />
      <div class="song-info">
        <span class="song-state">{{ statusText }}</span>
        <strong>{{ room.song?.name || "等待播放" }}</strong>
        <span>{{ room.song?.singer || "房主尚未选择歌曲" }}</span>
      </div>
    </div>

    <div class="room-stats">
      <div><strong>{{ room.currentPeople }}</strong><span>在线</span></div>
      <div><strong>{{ room.maxPeople }}</strong><span>上限</span></div>
      <div><strong>{{ latencyText }}</strong><span>延迟</span></div>
      <div><strong>{{ room.memberOperation ? "允许" : "关闭" }}</strong><span>成员控制</span></div>
    </div>

    <div v-if="listenTogether.isHost" class="member-operation-row">
      <div>
        <div class="operation-title">允许成员控制</div>
        <div class="operation-desc">开启后成员可播放、暂停、切歌、点歌和调整进度</div>
      </div>
      <n-switch
        :value="room.memberOperation"
        :loading="memberOperationUpdating"
        @update:value="handleMemberOperation" />
    </div>

    <div class="members-header">
      <span>房间成员</span>
      <span>{{ room.currentPeople }}/{{ room.maxPeople }}</span>
    </div>
    <div class="members">
      <div v-for="member in listenTogether.displayMembers" :key="member.userId" class="member-row">
        <n-avatar round :size="36" :src="member.avatarUrl">
          {{ displayName(member).slice(0, 1) }}
        </n-avatar>
        <div class="member-name">
          <strong>{{ displayName(member) }}</strong>
          <span v-if="member.userId === listenTogether.currentUserId">我</span>
        </div>
        <template
          v-if="listenTogether.isHost && member.userId !== listenTogether.currentUserId">
          <n-button text class="member-action" title="转让房主" @click="confirmTransfer(member)">
            <Crown :size="16" />
          </n-button>
          <n-button text class="member-action danger" title="移出房间" @click="confirmKick(member)">
            <UserX :size="16" />
          </n-button>
        </template>
        <n-tag v-if="member.userId === room.hostUserId" round size="small" type="warning">房主</n-tag>
        <span v-else class="online-label">{{ member.online ? "在线" : "离线" }}</span>
      </div>
    </div>

    <div class="room-actions">
      <n-button secondary round @click="copyInvite">复制邀请文案</n-button>
      <n-button secondary round type="error" @click="confirmLeave">
        <template #icon><LogOut :size="16" /></template>
        退出房间
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NAvatar, NButton, NSwitch, NTag } from "naive-ui";
import { Copy, Crown, LogOut, UserX } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useListenTogetherStore } from "@/store";
import type { ListenTogetherMember } from "@/types/listenTogether";
import { fromListenTogetherSong } from "@/listenTogether/listenTogetherSong";
import { defaultSongCover, getSongCover } from "@/utils/common";

const emit = defineEmits<{
  left: [];
}>();

const listenTogether = useListenTogetherStore();
const { room } = storeToRefs(listenTogether);
const connectionText = computed(() =>
  listenTogether.socketConnected ? "已连接" : "正在重连",
);
const latencyText = computed(() =>
  listenTogether.latencyMs == null ? "--" : `${Math.round(listenTogether.latencyMs)}ms`,
);
const statusText = computed(() => {
  if (!room.value?.song) return "等待房主";
  if (room.value.status === "playing") return "正在播放";
  if (room.value.status === "paused") return "已暂停";
  return "播放结束";
});
const songCover = computed(() =>
  room.value?.song
    ? getSongCover(fromListenTogetherSong(room.value.song), 240)
    : defaultSongCover,
);

function displayName(member: ListenTogetherMember): string {
  return member.nickname || member.username || "成员";
}

async function copyText(text: string, success: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    window.$message.success(success);
  } catch {
    window.$message.error("复制失败，请手动复制");
  }
}

function copyRoomId(): void {
  if (room.value) void copyText(room.value.roomId, "房间号已复制");
}

function copyInvite(): void {
  if (!room.value) return;
  void copyText(
    `来 PisaMusic 一起听「${room.value.roomName}」，房间号：${room.value.roomId}`,
    "邀请文案已复制",
  );
}

function confirmLeave(): void {
  window.$dialog.warning({
    title: "退出一起听",
    content: listenTogether.isHost
      ? "退出后房主将转让给其他在线成员；没有其他成员时房间会关闭。"
      : "确定退出当前一起听房间吗？",
    positiveText: "退出",
    negativeText: "取消",
    onPositiveClick: async () => {
      await listenTogether.leaveRoom();
      emit("left");
    },
  });
}

// 房主管理：成员控制开关、踢人、转让（均二次确认/ACK 失败自动回到 room 实际状态）
const memberOperationUpdating = ref(false);

async function handleMemberOperation(enabled: boolean): Promise<void> {
  if (memberOperationUpdating.value) return;
  memberOperationUpdating.value = true;
  try {
    await listenTogether.updateMemberOperation(enabled);
  } finally {
    memberOperationUpdating.value = false;
  }
}

function confirmKick(member: ListenTogetherMember): void {
  window.$dialog.warning({
    title: "移出成员",
    content: `确定把「${displayName(member)}」移出房间吗？`,
    positiveText: "移出",
    negativeText: "取消",
    onPositiveClick: async () => {
      const ok = await listenTogether.kickMember(member.userId);
      if (ok) window.$message.success(`已移出 ${displayName(member)}`);
    },
  });
}

function confirmTransfer(member: ListenTogetherMember): void {
  window.$dialog.warning({
    title: "转让房主",
    content: `确定把房主转让给「${displayName(member)}」吗？转让后你将成为普通成员。`,
    positiveText: "转让",
    negativeText: "取消",
    onPositiveClick: async () => {
      const ok = await listenTogether.transferHost(member.userId);
      if (ok) window.$message.success(`已将房主转让给 ${displayName(member)}`);
    },
  });
}
</script>

<style scoped>
.room-panel {
  width: min(480px, calc(100vw - 48px));
}

.room-heading,
.room-title-row,
.room-id,
.connection,
.now-playing,
.members-header,
.member-row,
.room-actions {
  display: flex;
  align-items: center;
}

.room-heading {
  justify-content: space-between;
  gap: 20px;
}

.room-title-row {
  gap: 10px;
}

.room-title-row h2 {
  margin: 0;
  color: var(--color-text-primary);
  font-size: 22px;
}

.room-id {
  gap: 5px;
  margin-top: 6px;
  padding: 0;
  border: 0;
  color: var(--color-text-secondary);
  background: transparent;
  cursor: pointer;
}

.connection {
  gap: 7px;
  color: var(--color-primary);
  font-size: 12px;
}

.connection.offline {
  color: #f0a020;
}

.connection-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 16%, transparent);
}

.now-playing {
  gap: 14px;
  margin: 20px 0;
  padding: 14px;
  border: 1px solid var(--color-border-default);
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-primary) 7%, var(--color-bg-default));
}

.song-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.song-info strong,
.song-info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-info strong {
  color: var(--color-text-primary);
}

.song-info span {
  color: var(--color-text-secondary);
}

.song-info .song-state {
  color: var(--color-primary);
  font-size: 12px;
}

.room-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.room-stats div {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 10px;
  border-radius: 12px;
  /* 项目无 --color-bg-soft 变量，用文本色弱混合出浅色卡片底 */
  background: color-mix(in srgb, var(--color-text-secondary) 8%, var(--color-bg-default));
  text-align: center;
}

.room-stats strong {
  color: var(--color-text-primary);
}

.room-stats span,
.members-header,
.online-label {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.member-operation-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--color-border-default);
  border-radius: 12px;
}

.operation-title {
  color: var(--color-text-primary);
  font-size: 13px;
  font-weight: 600;
}

.operation-desc {
  margin-top: 2px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.member-action {
  color: var(--color-text-secondary);
}

.member-action:hover {
  color: var(--color-primary);
}

.member-action.danger:hover {
  color: #e88080;
}

.members-header {
  justify-content: space-between;
  margin: 20px 0 8px;
}

.members {
  max-height: 220px;
  overflow: auto;
}

.member-row {
  gap: 10px;
  padding: 8px 2px;
}

.member-name {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 7px;
}

.member-name strong {
  overflow: hidden;
  color: var(--color-text-primary);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-name span {
  color: var(--color-primary);
  font-size: 12px;
}

.room-actions {
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
</style>
