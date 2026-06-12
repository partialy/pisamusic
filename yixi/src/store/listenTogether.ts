// 一起听 renderer 状态机：房间生命周期、远端播放同步（竞态保护）、切歌防抖与房主心跳。
// 房主权威队列协议由 listenTogetherQueueEngine 承载，本 store 注入上下文创建引擎。
// 所有 HTTP/Socket 通信经 preload typed IPC 完成，本文件不接触服务端地址与 token。

import { defineStore } from "pinia";
import { computed, ref, watch } from "vue";
import type { Song } from "@/types/song";
import type {
  ListenTogetherAck,
  ListenTogetherBroadcast,
  ListenTogetherConfig,
  ListenTogetherErrorCode,
  ListenTogetherHostTransferredData,
  ListenTogetherJoinAckData,
  ListenTogetherMember,
  ListenTogetherMemberJoinedData,
  ListenTogetherMemberKickedData,
  ListenTogetherMemberLeftData,
  ListenTogetherQueueEventData,
  ListenTogetherQueueItem,
  ListenTogetherRoom,
  ListenTogetherRoomAckData,
  ListenTogetherRoomUpdatedData,
  ListenTogetherSocketCommand,
  ListenTogetherStateChangedData,
} from "@/types/listenTogether";
import {
  HOST_HEARTBEAT_INTERVAL_MS,
  REMOTE_SYNC_RELEASE_DELAY_MS,
  TRANSITION_DEBOUNCE_MS,
  clampPositionMs,
  needsSeek,
  playerSecondsToProtocolMs,
  protocolMsToPlayerSeconds,
  shouldApplyAckRoom,
  shouldApplyBroadcastVersion,
  shouldCompleteTransition,
  targetPositionMs,
} from "@/listenTogether/listenTogetherRules";
import { emptyQueueState, uniqueQueueItemIdForSong } from "@/listenTogether/listenTogetherQueue";
import { createListenTogetherQueueEngine } from "@/listenTogether/listenTogetherQueueEngine";
import { toSerializableListenTogetherCommand } from "@/listenTogether/listenTogetherIpcPayload";
import { createListenTogetherRoomActions } from "@/listenTogether/listenTogetherRoomActions";
import {
  canShareSong,
  fromListenTogetherSong,
  sameSongRef,
  songRefOf,
  toListenTogetherSong,
} from "@/listenTogether/listenTogetherSong";
import { getPlayableUrlByMusicApi } from "@/utils/api/musicAPI";
import electronAPI from "@/utils/electron";
import { reportError } from "@/utils/errorReporter";
import { useAudioStore } from "./audio";
import { useUserStore } from "./user";

/** 创建/加入动作的结构化结果，UI 据此弹登录、二次确认或错误提示 */
export type ListenTogetherActionResult =
  | { status: "ok" }
  | { status: "need-login" }
  | { status: "need-replace-confirm"; message: string }
  | { status: "error"; message: string };

export type CreateRoomOptions = {
  roomName?: string;
  roomId?: string;
  maxPeople?: number;
  memberOperation?: boolean;
  replaceExisting?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toast(message: string): void {
  window.$message?.warning?.(message);
}

function toastError(message: string): void {
  window.$message?.error?.(message);
}

function toastSuccess(message: string): void {
  window.$message?.success?.(message);
}

export const useListenTogetherStore = defineStore("listenTogether", () => {
  const audio = useAudioStore();
  const userStore = useUserStore();

  // ------------------------------------------------------------------
  // 状态
  // ------------------------------------------------------------------
  const room = ref<ListenTogetherRoom | null>(null);
  const queue = ref(emptyQueueState());
  const socketConnected = ref(false);
  const latencyMs = ref<number | null>(null);
  const joining = ref(false);
  const syncingFromRemote = ref(false);
  const lastVersion = ref(-1);
  const currentUserId = ref(userStore.userInfo.id || "");
  const pendingTransitionId = ref<string | null>(null);
  const config = ref<ListenTogetherConfig | null>(null);
  /** 启动本地模式（外层服务不可用）时一起听入口禁用 */
  const onlineServiceAvailable = ref(true);

  void electronAPI.getStartupServiceState?.().then((state) => {
    onlineServiceAvailable.value = !state?.localMode;
  });

  // 非响应式内部状态
  let listenersReady = false;
  let ipcUnsubscribers: Array<() => void> = [];
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let transitionResetTimer: ReturnType<typeof setTimeout> | null = null;
  /** 远端同步串行化令牌：旧协程在每个 await 后核对，过期立即退出且不得清抑制标记 */
  let syncSeq = 0;
  /** 歌曲加载“仅最新请求生效”门：旧 URL 晚返回直接丢弃 */
  let loadSeq = 0;
  /** 房主切歌执行中标记（心跳跳过 + 旧任务不覆盖新任务），与队列引擎共享 */
  const hostPlayback: { activeTransitionId: string | null } = { activeTransitionId: null };
  let hasJoinedOnce = false;

  // ------------------------------------------------------------------
  // 派生状态
  // ------------------------------------------------------------------
  const enabled = computed(() => room.value !== null);
  const isHost = computed(
    () =>
      !!room.value &&
      !!currentUserId.value &&
      room.value.hostUserId === currentUserId.value,
  );
  const canControl = computed(
    () => isHost.value || room.value?.memberOperation === true,
  );
  const pendingTransition = computed(() => pendingTransitionId.value !== null);
  /** 成员展示排序：房主 → 当前用户 → 其他成员按加入时间 */
  const displayMembers = computed<ListenTogetherMember[]>(() => {
    const members = room.value?.members ?? [];
    return [...members].sort((a, b) => {
      const rank = (member: ListenTogetherMember) => {
        if (member.userId === room.value?.hostUserId) return 0;
        if (member.userId === currentUserId.value) return 1;
        return 2;
      };
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
      return a.userId.localeCompare(b.userId);
    });
  });
  /** 一起听模式下队列 UI 的数据源 */
  const effectiveQueue = computed<ListenTogetherQueueItem[]>(() => queue.value.items);

  // ------------------------------------------------------------------
  // IPC 通信
  // ------------------------------------------------------------------
  async function emitCommand<T = unknown>(
    command: ListenTogetherSocketCommand,
  ): Promise<ListenTogetherAck<T>> {
    try {
      const serializableCommand = toSerializableListenTogetherCommand(command);
      const result = await electronAPI.emitListenTogetherCommand<T>(serializableCommand);
      if (result.rttMs !== null) latencyMs.value = result.rttMs;
      return result.ack;
    } catch (error) {
      void reportError(error, {
        scope: "listenTogether",
        action: "emitCommand",
        commandType: command.type,
        roomId: command.roomId,
      });
      return {
        success: false,
        code: -1,
        msg: "一起听操作失败",
        errorMsg: "INTERNAL_ERROR",
        data: null,
      };
    }
  }

  function ensureListeners(): void {
    if (listenersReady) return;
    listenersReady = true;
    const offConnection = electronAPI.onListenTogetherConnectionState((event) => {
      if (event.type === "connected") {
        socketConnected.value = true;
        onSocketConnected();
        return;
      }
      if (event.type === "disconnected") {
        // 保留 room/queue，给服务端 30 秒宽限期内的重连留机会
        socketConnected.value = false;
        latencyMs.value = null;
        stopHeartbeat();
        return;
      }
      if (event.type === "connect-error") {
        socketConnected.value = false;
        latencyMs.value = null;
        stopHeartbeat();
        if (joining.value) {
          joining.value = false;
          toastError(
            event.message === "UNAUTHORIZED"
              ? "登录已失效，请重新登录"
              : event.message || "一起听连接失败",
          );
          clearState();
        }
      }
    });
    const offBroadcast = electronAPI.onListenTogetherBroadcast((message) => {
      handleBroadcast(message);
    });
    ipcUnsubscribers = [offConnection, offBroadcast];
  }

  /** 仅测试/极端场景使用：解除 IPC 订阅 */
  function teardownListeners(): void {
    ipcUnsubscribers.forEach((off) => off());
    ipcUnsubscribers = [];
    listenersReady = false;
  }

  // ------------------------------------------------------------------
  // 创建 / 加入 / 离开
  // ------------------------------------------------------------------
  async function loadConfig(): Promise<ListenTogetherConfig | null> {
    const result = await electronAPI.getListenTogetherConfig();
    if (result.ok) {
      config.value = result.data;
      return result.data;
    }
    return null;
  }

  async function createRoom(options: CreateRoomOptions = {}): Promise<ListenTogetherActionResult> {
    ensureListeners();
    if (!onlineServiceAvailable.value) {
      return { status: "error", message: "在线服务不可用，一起听暂不可用" };
    }
    if (!userStore.isLogin) return { status: "need-login" };
    const currentSong = audio.currentSong;
    if (!currentSong) {
      return { status: "error", message: "先播放一首在线歌曲，再创建一起听房间" };
    }
    if (!canShareSong(currentSong)) {
      return { status: "error", message: "本地歌曲暂不支持一起听" };
    }
    const trimmedName = options.roomName?.trim();
    if (trimmedName && (trimmedName.length < 2 || trimmedName.length > 16)) {
      return { status: "error", message: "房间名需为 2-16 个字" };
    }
    const trimmedRoomId = options.roomId?.trim();
    if (trimmedRoomId && !/^\d{4,8}$/.test(trimmedRoomId)) {
      return { status: "error", message: "房间号需为 4-8 位数字" };
    }

    joining.value = true;
    currentUserId.value = userStore.userInfo.id;
    try {
      const remoteConfig = (await loadConfig()) ?? config.value;
      const limit = Math.max(2, remoteConfig?.maxPeopleLimit ?? 8);
      const defaultName = `${userStore.userInfo.username || "我"}的音乐房`.slice(0, 16);
      const maxPeople = Math.min(
        limit,
        Math.max(2, options.maxPeople ?? remoteConfig?.defaultMaxPeople ?? 2),
      );
      const result = await electronAPI.createListenTogetherRoom({
        roomName: trimmedName || defaultName,
        ...(trimmedRoomId ? { roomId: trimmedRoomId } : {}),
        maxPeople,
        memberOperation: options.memberOperation === true,
        replaceExisting: options.replaceExisting === true,
      });
      if (!result.ok) {
        joining.value = false;
        if (result.error.errorMsg === "USER_ALREADY_HAS_ROOM" && !options.replaceExisting) {
          return {
            status: "need-replace-confirm",
            message: "当前已加入房间，继续创建将退出之前房间",
          };
        }
        if (result.error.errorMsg === "UNAUTHORIZED") return { status: "need-login" };
        return {
          status: "error",
          message: mapApiErrorMessage(result.error.errorMsg, result.error.msg, "创建房间失败"),
        };
      }
      enterRoom(result.data);
      return { status: "ok" };
    } catch (error) {
      joining.value = false;
      void reportError(error, { scope: "listenTogether", action: "createRoom" });
      return { status: "error", message: "创建房间失败" };
    }
  }

  async function joinRoom(roomId: string): Promise<ListenTogetherActionResult> {
    ensureListeners();
    if (!onlineServiceAvailable.value) {
      return { status: "error", message: "在线服务不可用，一起听暂不可用" };
    }
    if (!userStore.isLogin) return { status: "need-login" };
    const cleanRoomId = roomId.trim();
    if (!/^\d{4,8}$/.test(cleanRoomId)) {
      return { status: "error", message: "请输入 4-8 位数字房间号" };
    }
    joining.value = true;
    currentUserId.value = userStore.userInfo.id;
    try {
      const result = await electronAPI.getListenTogetherRoom(cleanRoomId);
      if (!result.ok) {
        joining.value = false;
        if (result.error.errorMsg === "UNAUTHORIZED") return { status: "need-login" };
        return {
          status: "error",
          message: mapApiErrorMessage(result.error.errorMsg, result.error.msg, "加入房间失败"),
        };
      }
      enterRoom(result.data);
      return { status: "ok" };
    } catch (error) {
      joining.value = false;
      void reportError(error, { scope: "listenTogether", action: "joinRoom", roomId: cleanRoomId });
      return { status: "error", message: "加入房间失败" };
    }
  }

  /** HTTP 拿到房间后进入：设初始状态并打开 socket；join 由 connected 事件驱动 */
  function enterRoom(initialRoom: ListenTogetherRoom): void {
    room.value = initialRoom;
    lastVersion.value = initialRoom.version;
    queue.value = emptyQueueState();
    queueEngine.resetProtocol();
    hasJoinedOnce = false;
    joining.value = true;
    void electronAPI.connectListenTogetherSocket().then((result) => {
      if (!result.ok) {
        joining.value = false;
        toastError(result.msg || "一起听连接失败");
        clearState();
      }
    });
  }

  function onSocketConnected(): void {
    const roomId = room.value?.roomId;
    if (!roomId) return;
    if (!hasJoinedOnce) {
      void emitJoin(roomId);
    } else {
      void emitSync(roomId);
    }
  }

  async function emitJoin(roomId: string): Promise<void> {
    const ack = await emitCommand<ListenTogetherJoinAckData>({ type: "join", roomId });
    if (!ack.success) {
      joining.value = false;
      const fatalJoin = !hasJoinedOnce;
      handleAckFailure(ack.errorMsg, ack.msg || "加入房间失败");
      // 首次加入失败且错误未触发清理时，不保留半挂起房间
      if (fatalJoin && room.value) clearState();
      return;
    }
    const joinedRoom = ack.data?.room;
    if (!joinedRoom) {
      joining.value = false;
      clearState();
      toastError("加入房间失败");
      return;
    }
    hasJoinedOnce = true;
    applyRoom(joinedRoom);
    joining.value = false;
    if (isHost.value) {
      afterJoinAsHost(joinedRoom);
    } else {
      void syncPlayerToRoom(joinedRoom, null);
      queueEngine.requestQueueSnapshot();
    }
  }

  async function emitSync(roomId: string): Promise<void> {
    const ack = await emitCommand<ListenTogetherJoinAckData>({ type: "sync", roomId });
    if (!ack.success) {
      handleAckFailure(ack.errorMsg, ack.msg || "同步房间失败");
      return;
    }
    const syncedRoom = ack.data?.room;
    if (!syncedRoom) return;
    applyRoom(syncedRoom);
    if (isHost.value) {
      updateHeartbeat();
    } else {
      void syncPlayerToRoom(syncedRoom, null);
      queueEngine.requestQueueSnapshot();
    }
  }

  /** 房主入房后：初始化权威队列；room.song 为空时立即 CHANGE_SONG，不等 6 秒心跳 */
  function afterJoinAsHost(joinedRoom: ListenTogetherRoom): void {
    queueEngine.ensureHostQueueInitialized();
    if (joinedRoom.song) return;
    const currentSong = audio.currentSong;
    if (!currentSong || !canShareSong(currentSong)) return;
    const protoSong = toListenTogetherSong(currentSong);
    void queueEngine.emitChangeSongAsHost(
      protoSong,
      audio.isPlaying,
      crypto.randomUUID(),
      uniqueQueueItemIdForSong(queue.value, songRefOf(protoSong)),
    );
  }

  async function leaveRoom(): Promise<void> {
    const roomId = room.value?.roomId;
    if (!roomId) {
      clearState();
      return;
    }
    try {
      // ACK 成功或房间已不存在都视为离开完成；失败也不能把用户困在房间里
      await emitCommand({ type: "leave", roomId });
    } catch {
      // 离开失败时仍然清理本地状态
    }
    clearState();
    toastSuccess("已退出一起听");
  }

  /** 清理一起听状态：不动普通本地播放队列 */
  function clearState(): void {
    void electronAPI.disconnectListenTogetherSocket();
    stopHeartbeat();
    if (transitionResetTimer) {
      clearTimeout(transitionResetTimer);
      transitionResetTimer = null;
    }
    syncSeq += 1;
    loadSeq += 1;
    hostPlayback.activeTransitionId = null;
    queueEngine.resetProtocol();
    hasJoinedOnce = false;
    room.value = null;
    queue.value = emptyQueueState();
    socketConnected.value = false;
    latencyMs.value = null;
    joining.value = false;
    syncingFromRemote.value = false;
    lastVersion.value = -1;
    pendingTransitionId.value = null;
  }

  // ------------------------------------------------------------------
  // 房间状态应用与广播处理
  // ------------------------------------------------------------------
  function applyRoom(nextRoom: ListenTogetherRoom, version: number = nextRoom.version): void {
    const wasHost = isHost.value;
    room.value = nextRoom;
    lastVersion.value = Math.max(version, nextRoom.version);
    handleHostRoleChange(wasHost);
    queueEngine.ensureHostQueueInitialized();
    updateHeartbeat();
  }

  function updateCurrentRoom(
    version: number,
    patch: (current: ListenTogetherRoom) => ListenTogetherRoom,
  ): void {
    const current = room.value;
    if (!current) return;
    applyRoom(patch(current), version);
  }

  /** 房主身份变化时的职责交接（计划 12.6） */
  function handleHostRoleChange(wasHost: boolean): void {
    if (wasHost === isHost.value) return;
    if (isHost.value) {
      // 成员 → 房主：现有已同步队列即权威队列；为空则从本地在线队列初始化
      queueEngine.resetProtocol();
      queue.value = { ...queue.value, syncing: false, snapshotId: null };
      queueEngine.ensureHostQueueInitialized();
    } else {
      // 房主 → 成员：停心跳并向新房主要快照
      stopHeartbeat();
      queueEngine.requestQueueSnapshot();
    }
  }

  function handleAckFailure(errorMsg: ListenTogetherErrorCode | undefined, message: string): void {
    switch (errorMsg) {
      case "UNAUTHORIZED":
        clearState();
        toastError("登录已失效，请重新登录");
        return;
      case "ROOM_NOT_FOUND":
        clearState();
        toast("房间不存在或已关闭");
        return;
      case "NOT_IN_ROOM":
        clearState();
        toast("房间身份已失效，请重新加入");
        return;
      case "NO_PERMISSION": {
        toast("房主正在控制播放");
        const roomId = room.value?.roomId;
        if (roomId) void emitSync(roomId);
        return;
      }
      case "SOCKET_DISCONNECTED":
        toast("一起听正在重连");
        return;
      case "ACK_TIMEOUT":
        toast("一起听操作超时，请重试");
        return;
      default:
        toast(getErrorMessage(errorMsg, message, "一起听操作失败"));
    }
  }

  function getErrorMessage(
    errorMsg: ListenTogetherErrorCode | null | undefined,
    message: string,
    fallback: string,
  ): string {
    switch (errorMsg) {
      case "UNAUTHORIZED":
        return "请先登录账号";
      case "ROOM_NOT_FOUND":
        return "房间不存在";
      case "ROOM_FULL":
        return "房间人数已满";
      case "ROOM_ID_EXISTS":
        return "房间号已存在";
      case "INVALID_ROOM_ID":
        return "房间号需为 4-8 位数字";
      case "INVALID_ROOM_NAME":
        return "房间名不合法";
      case "INVALID_MAX_PEOPLE":
        return "房间人数超出允许范围";
      case "INVALID_SONG":
        return "当前歌曲不支持一起听";
      case "INVALID_POSITION":
        return "播放进度无效，请重试";
      case "NO_PERMISSION":
        return "房主正在控制播放";
      case "NOT_IN_ROOM":
        return "房间身份已失效，请重新加入";
      case "ALREADY_IN_ROOM":
        return "你已经在当前房间";
      case "USER_ALREADY_HAS_ROOM":
        return "请先退出当前房间";
      case "TARGET_USER_NOT_FOUND":
        return "目标成员不在房间内";
      case "HOST_CANNOT_BE_KICKED":
        return "不能移出房主";
      case "INTERNAL_ERROR":
        return "一起听服务异常，请稍后重试";
      case "SOCKET_DISCONNECTED":
        return "一起听正在重连";
      case "ACK_TIMEOUT":
        return "一起听操作超时，请重试";
      default:
        return message || fallback;
    }
  }

  function mapApiErrorMessage(
    errorMsg: ListenTogetherErrorCode | null,
    msg: string,
    fallback: string,
  ): string {
    return getErrorMessage(errorMsg, msg, fallback);
  }

  function handleRoomAck(ack: ListenTogetherAck<ListenTogetherRoomAckData>): void {
    if (!ack.success) {
      handleAckFailure(ack.errorMsg, ack.msg || "一起听同步失败");
      return;
    }
    const ackRoom = ack.data?.room;
    if (ackRoom && shouldApplyAckRoom(ackRoom.version, lastVersion.value)) {
      applyRoom(ackRoom);
    }
  }

  function handleBroadcast(message: ListenTogetherBroadcast): void {
    const currentRoomId = room.value?.roomId;
    if (!currentRoomId || message.roomId !== currentRoomId) return;

    // QUEUE_EVENT 的 version 恒为 0，靠 queueVersion 自行排序，不能套房间版本过滤
    if (message.event === "QUEUE_EVENT") {
      queueEngine.handleQueueEvent((message.data ?? {}) as ListenTogetherQueueEventData);
      return;
    }
    if (!shouldApplyBroadcastVersion(message.version, lastVersion.value)) return;

    switch (message.event) {
      case "ROOM_STATE_CHANGED": {
        const payload = message.data as ListenTogetherStateChangedData;
        applyRoom(payload.room, message.version);
        if (payload.action === "CHANGE_SONG") {
          queueEngine.alignQueuePointerToRoomSong(payload.room.song, payload.queueItemId ?? null);
        }
        void syncPlayerToRoom(payload.room, payload.operator?.userId ?? null);
        endTransition(payload.transitionId ?? null, payload.action);
        return;
      }
      case "ROOM_UPDATED": {
        const payload = message.data as ListenTogetherRoomUpdatedData;
        applyRoom(payload.room, message.version);
        return;
      }
      case "MEMBER_JOINED": {
        const payload = message.data as ListenTogetherMemberJoinedData;
        updateCurrentRoom(message.version, (current) => ({
          ...current,
          currentPeople: payload.members.length,
          members: payload.members,
        }));
        if (isHost.value && payload.member && payload.member.userId !== currentUserId.value) {
          // 新成员（含重连成员）需要最新队列快照和一次即时状态心跳
          void queueEngine.sendQueueSnapshot(payload.member.userId);
          void emitHostHeartbeat();
        }
        return;
      }
      case "MEMBER_LEFT": {
        const payload = message.data as ListenTogetherMemberLeftData;
        updateCurrentRoom(message.version, (current) => ({
          ...current,
          hostUserId: payload.newHostUserId || current.hostUserId,
          currentPeople: payload.members.length,
          members: payload.members,
        }));
        return;
      }
      case "MEMBER_KICKED": {
        const payload = message.data as ListenTogetherMemberKickedData;
        if (payload.targetUserId === currentUserId.value) {
          clearState();
          toast("你已被房主移出房间");
          return;
        }
        updateCurrentRoom(message.version, (current) => ({
          ...current,
          currentPeople: payload.members.length,
          members: payload.members,
        }));
        return;
      }
      case "HOST_TRANSFERRED": {
        const payload = message.data as ListenTogetherHostTransferredData;
        updateCurrentRoom(message.version, (current) => ({
          ...current,
          hostUserId: payload.newHostUserId,
          members: payload.members,
        }));
        return;
      }
      case "ROOM_DESTROYED": {
        clearState();
        toast("房间已关闭");
        return;
      }
      case "ERROR_MESSAGE": {
        const data = (message.data ?? {}) as { msg?: string };
        const text = data.msg || "一起听同步异常";
        toast(text);
        void reportError(new Error(text), { scope: "listenTogether", action: "serverErrorMessage" });
        return;
      }
    }
  }

  // ------------------------------------------------------------------
  // 远端 → 播放器同步（竞态保护核心）
  // ------------------------------------------------------------------

  /**
   * 歌曲加载“仅最新请求可生效”门：解析 URL 后若已有更新请求则丢弃，
   * 防止快速连续切歌时旧歌曲 URL 晚返回覆盖新歌曲。
   */
  async function loadSongGated(
    song: Song,
    options: { autoPlay: boolean; seekMs?: number },
  ): Promise<boolean> {
    const seq = ++loadSeq;
    let url = "";
    try {
      url = await getPlayableUrlByMusicApi(song, audio.getPreferredQualityKey(song.source));
    } catch (error) {
      void reportError(error, {
        scope: "listenTogether",
        action: "loadSongGated",
        songId: song.id,
        source: song.source,
        roomId: room.value?.roomId,
      });
    }
    if (seq !== loadSeq) return false;
    if (!url) {
      toastError("播放地址获取失败，可尝试切换其他音源");
      return false;
    }
    song.url = url;
    audio.currentSong = song;
    audio.initPlayer(url, {
      autoPlay: options.autoPlay,
      seek: protocolMsToPlayerSeconds(options.seekMs ?? 0),
    });
    return true;
  }

  /**
   * 把服务端房间状态应用到本地播放器。
   * 串行化：领取最新 syncSeq 并在每个 await 后核对，旧任务不得清掉新任务的抑制标记。
   */
  async function syncPlayerToRoom(
    sourceRoom: ListenTogetherRoom,
    operatorUserId: string | null,
  ): Promise<void> {
    const remoteSong = sourceRoom.song;
    if (!remoteSong) return;
    // 自己发起的操作已在本地执行过，服务端回声只用于元数据，不再驱动播放器
    if (operatorUserId && operatorUserId === currentUserId.value) return;

    const seq = ++syncSeq;
    syncingFromRemote.value = true;
    try {
      const localSong = audio.currentSong;
      const same = !!localSong && sameSongRef(songRefOf(localSong), songRefOf(remoteSong));
      if (!same) {
        // 不同歌曲：先以 autoPlay=false 加载最新远端歌曲，加载完成后再定位与设置状态
        const target = targetPositionMs(sourceRoom, Date.now());
        const loaded = await loadSongGated(fromListenTogetherSong(remoteSong), {
          autoPlay: false,
          seekMs: sourceRoom.status === "playing" ? target : sourceRoom.position,
        });
        if (!loaded || seq !== syncSeq) return;
      } else {
        const target = targetPositionMs(sourceRoom, Date.now());
        const currentMs = playerSecondsToProtocolMs(audio.currentTime);
        if (needsSeek(currentMs, target)) {
          audio.seek(protocolMsToPlayerSeconds(target));
        }
      }
      if (seq !== syncSeq) return;
      switch (sourceRoom.status) {
        case "playing":
          if (!audio.isPlaying) audio.player?.play();
          break;
        case "paused":
          if (audio.isPlaying) audio.player?.pause();
          break;
        case "ended":
          audio.player?.pause();
          audio.seek(protocolMsToPlayerSeconds(sourceRoom.position));
          break;
      }
      // 延迟解除抑制，吸收 Howler 异步事件回流
      await sleep(REMOTE_SYNC_RELEASE_DELAY_MS);
    } catch (error) {
      void reportError(error, {
        scope: "listenTogether",
        action: "syncPlayerToRoom",
        songId: remoteSong.id,
        source: remoteSong.source,
        roomId: sourceRoom.roomId,
      });
    } finally {
      // 只有最新令牌允许清除抑制标记
      if (seq === syncSeq) syncingFromRemote.value = false;
    }
  }

  // ------------------------------------------------------------------
  // 切歌防抖（transitionId）
  // ------------------------------------------------------------------
  function beginTransition(): string | null {
    if (!enabled.value || pendingTransition.value) return null;
    const transitionId = crypto.randomUUID();
    adoptTransition(transitionId);
    return transitionId;
  }

  function adoptTransition(transitionId: string): void {
    pendingTransitionId.value = transitionId;
    if (transitionResetTimer) clearTimeout(transitionResetTimer);
    // 450ms 仅是 UI 防抖兜底；正常应由匹配的 CHANGE_SONG ACK/广播提前结束
    transitionResetTimer = setTimeout(() => {
      if (pendingTransitionId.value === transitionId) {
        pendingTransitionId.value = null;
      }
    }, TRANSITION_DEBOUNCE_MS);
  }

  function endTransition(transitionId: string | null | undefined, action: string): void {
    if (!shouldCompleteTransition(action, pendingTransitionId.value, transitionId)) return;
    if (transitionResetTimer) {
      clearTimeout(transitionResetTimer);
      transitionResetTimer = null;
    }
    pendingTransitionId.value = null;
  }

  // ------------------------------------------------------------------
  // 房主权威队列引擎
  // ------------------------------------------------------------------
  const queueEngine = createListenTogetherQueueEngine({
    queue,
    room,
    currentUserId,
    isHost,
    audio: {
      currentSong: () => audio.currentSong,
      playlist: () => audio.playlist,
      pausePlayer: () => audio.player?.pause(),
      currentTimeSeconds: () => audio.currentTime,
    },
    emitCommand,
    handleRoomAck,
    handleAckFailure,
    beginTransition,
    adoptTransition,
    endTransition,
    loadSongGated,
    hostPlayback,
    toast,
    toastError,
  });

  // ------------------------------------------------------------------
  // 房主心跳
  // ------------------------------------------------------------------
  function updateHeartbeat(): void {
    const shouldRun = !!room.value && socketConnected.value && isHost.value;
    if (!shouldRun) {
      stopHeartbeat();
      return;
    }
    if (heartbeatTimer) return;
    heartbeatTimer = setInterval(() => {
      void emitHostHeartbeat();
    }, HOST_HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  async function emitHostHeartbeat(): Promise<void> {
    const currentRoom = room.value;
    if (!currentRoom || !socketConnected.value || !isHost.value) return;
    // 切歌执行中 / pending / 远端同步中跳过本拍
    if (hostPlayback.activeTransitionId || pendingTransition.value || syncingFromRemote.value) {
      return;
    }
    const song = audio.currentSong;
    if (!song || !canShareSong(song)) return;
    const protoSong = toListenTogetherSong(song);
    const durationMs = protoSong.duration || playerSecondsToProtocolMs(audio.duration);
    const position = clampPositionMs(playerSecondsToProtocolMs(audio.currentTime), durationMs);
    if (audio.isPlaying) {
      const ack = await emitCommand<ListenTogetherRoomAckData>({
        type: "play",
        roomId: currentRoom.roomId,
        song: protoSong,
        position,
      });
      handleRoomAck(ack);
      return;
    }
    if (!currentRoom.song) {
      await queueEngine.emitChangeSongAsHost(
        protoSong,
        false,
        crypto.randomUUID(),
        uniqueQueueItemIdForSong(queue.value, songRefOf(protoSong)),
      );
      return;
    }
    const ack = await emitCommand<ListenTogetherRoomAckData>({
      type: "pause",
      roomId: currentRoom.roomId,
      songRef: songRefOf(protoSong),
      position,
    });
    handleRoomAck(ack);
  }

  // ------------------------------------------------------------------
  // 对统一播放命令层暴露的房间内动作
  // ------------------------------------------------------------------

  /** 房间内操作权限守卫：未连接提示重连；无权限提示并主动 sync 校正本地状态 */
  function guardControl(): boolean {
    if (!enabled.value) return true;
    if (!socketConnected.value) {
      toast("一起听正在重连");
      return false;
    }
    if (canControl.value) return true;
    toast("房主正在控制播放");
    const roomId = room.value?.roomId;
    if (roomId) void emitSync(roomId);
    return false;
  }

  const roomActions = createListenTogetherRoomActions({
    enabled,
    isHost,
    syncingFromRemote,
    room,
    currentUserId,
    audio: {
      currentSong: () => audio.currentSong,
      isPlaying: () => audio.isPlaying,
      playPlayer: () => audio.player?.play(),
      pausePlayer: () => audio.player?.pause(),
      seekSeconds: (seconds) => audio.seek(seconds),
      currentTimeSeconds: () => audio.currentTime,
      durationSeconds: () => audio.duration,
    },
    engine: queueEngine,
    emitCommand,
    handleRoomAck,
    guardControl,
    beginTransition,
    toast,
  });

  // ------------------------------------------------------------------
  // 账号联动：退出登录 / 切换账号时清理一起听
  // ------------------------------------------------------------------
  watch(
    () => userStore.userInfo.id,
    (nextId, prevId) => {
      if (room.value && nextId !== prevId) {
        // 账号退出或切换：main 已断 socket，这里清掉旧账号房间状态
        clearState();
      }
      currentUserId.value = nextId || "";
    },
  );

  // token 刷新（同一账号）：旧 socket 仍持旧 token，重连后由 connected 事件触发 sync 恢复房间
  watch(
    () => userStore.token,
    (nextToken, prevToken) => {
      if (!room.value || !nextToken || !prevToken || nextToken === prevToken) return;
      if (userStore.userInfo.id !== currentUserId.value) return;
      void electronAPI.connectListenTogetherSocket();
    },
  );

  return {
    // 状态
    room,
    queue,
    socketConnected,
    latencyMs,
    joining,
    syncingFromRemote,
    lastVersion,
    currentUserId,
    pendingTransitionId,
    config,
    onlineServiceAvailable,
    // 派生
    enabled,
    isHost,
    canControl,
    pendingTransition,
    displayMembers,
    effectiveQueue,
    // 生命周期
    ensureListeners,
    teardownListeners,
    loadConfig,
    createRoom,
    joinRoom,
    leaveRoom,
    clearState,
    // 房间内动作（统一播放命令层调用）
    guardControl,
    ...roomActions,
  };
});

export type ListenTogetherStore = ReturnType<typeof useListenTogetherStore>;
