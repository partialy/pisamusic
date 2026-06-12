package cn.partialy.pm.listen

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import cn.partialy.pm.R
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.player.MusicController
import com.google.gson.Gson
import com.google.gson.JsonObject
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine
import kotlin.math.abs
import java.util.UUID

@OptIn(UnstableApi::class)
@Singleton
class ListenTogetherManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val repository: ListenTogetherRepository,
    private val socketClient: ListenTogetherSocketClient,
    private val musicController: MusicController,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val gson = Gson()
    private val _state = MutableStateFlow(ListenTogetherState())
    val state: StateFlow<ListenTogetherState> = _state.asStateFlow()
    private val _events = MutableSharedFlow<ListenTogetherUiEvent>(extraBufferCapacity = 8)
    val uiEvents: SharedFlow<ListenTogetherUiEvent> = _events.asSharedFlow()

    private var lastSongKey: String? = null
    private var lastPlaying: Boolean? = null
    private var lastEndedSongKey: String? = null
    // 主动切歌时把期望的目标 key 加入集合，observeLocalPlayer 命中即吞掉 emit；
    // 用集合替代单值，避免快速连切时后一次写入覆盖前一次而漏抑制。
    private val expectedLocalSongKeys: MutableSet<String> = mutableSetOf()
    private var heartbeatJob: Job? = null
    private var transitionResetJob: Job? = null
    private var hostPlaybackJob: Job? = null
    private var activeHostTransitionId: String? = null
    // sync 协程串行化：每次同步领一个递增令牌并取消上一个协程，
    // 只有持最新令牌的协程才允许清除 syncingFromRemote，避免被取消的旧协程把抑制标志踩回 false。
    private var syncJob: Job? = null
    private var syncSeq = 0L
    private var pendingSnapshotId: String? = null
    private var pendingSnapshotChunkCount: Int = 0
    private val pendingSnapshotChunks = mutableMapOf<Int, List<ListenTogetherQueueItem>>()

    init {
        observeLocalPlayer()
    }

    suspend fun createRoom(
        currentSong: SongInfo?,
        roomName: String? = null,
        roomId: String? = null,
        maxPeople: Int? = null,
        memberOperation: Boolean? = null,
        replaceExisting: Boolean = false,
    ) {
        val session = requireSession() ?: return
        val song = currentSong ?: run {
            emitToast("先播放一首在线歌曲，再创建一起听房间")
            return
        }
        if (song.type == SongType.LOCAL) {
            emitToast("本地歌曲暂不支持一起听")
            return
        }

        val trimmedName = roomName?.trim()
        if (trimmedName != null && (trimmedName.length < 2 || trimmedName.length > 16)) {
            emitToast("房间名 2-16 个字")
            return
        }
        val trimmedRoomId = roomId?.trim()?.takeIf { it.isNotBlank() }
        if (trimmedRoomId != null && !trimmedRoomId.matches(Regex("\\d{4,8}"))) {
            emitToast("房间号需为 4-8 位数字")
            return
        }

        runCatching {
            _state.value = _state.value.copy(joining = true, currentUserId = session.user.id)
            val config = repository.getConfig()
            val defaultName = "${session.user.username.ifBlank { "我的" }}的音乐房".take(40)
            val effectiveName = (trimmedName ?: defaultName).take(40)
            val peopleLimit = config.maxPeopleLimit.coerceAtLeast(2)
            val effectiveMaxPeople = (maxPeople ?: config.defaultMaxPeople).coerceIn(2, peopleLimit)
            val effectiveMemberOperation = memberOperation ?: false
            val room = repository.createRoom(
                token = session.token,
                request = ListenTogetherCreateRoomRequest(
                    roomName = effectiveName,
                    roomId = trimmedRoomId,
                    maxPeople = effectiveMaxPeople,
                    memberOperation = effectiveMemberOperation,
                    replaceExisting = replaceExisting,
                ),
            )
            connectAndEnter(session, room.roomId, room)
        }.onFailure {
            _state.value = _state.value.copy(joining = false)
            if (!replaceExisting && it is ListenTogetherApiException && it.errorMsg == "USER_ALREADY_HAS_ROOM") {
                _events.tryEmit(ListenTogetherUiEvent.ConfirmReplaceRoom("当前已加入房间，继续创建将退出之前房间"))
            } else {
                emitToast(errorMessage(it, "创建房间失败"))
            }
        }
    }

    suspend fun joinRoom(roomId: String) {
        val session = requireSession() ?: return
        val cleanRoomId = roomId.trim()
        if (!cleanRoomId.matches(Regex("\\d{4,8}"))) {
            emitToast("请输入 4-8 位数字房间号")
            return
        }
        runCatching {
            _state.value = _state.value.copy(joining = true, currentUserId = session.user.id)
            val room = repository.getRoom(session.token, cleanRoomId)
            connectAndEnter(session, room.roomId, room)
        }.onFailure {
            _state.value = _state.value.copy(joining = false)
            emitToast(errorMessage(it, "加入房间失败"))
        }
    }

    suspend fun switchRoom(roomId: String) {
        val session = requireSession() ?: return
        val cleanRoomId = roomId.trim()
        if (!cleanRoomId.matches(Regex("\\d{4,8}"))) {
            emitToast("请输入 4-8 位数字房间号")
            return
        }
        if (_state.value.room?.roomId == cleanRoomId) return

        _state.value = _state.value.copy(joining = true, currentUserId = session.user.id)
        val targetRoom = runCatching {
            repository.getRoom(session.token, cleanRoomId)
        }.getOrElse {
            _state.value = _state.value.copy(joining = false)
            emitToast(errorMessage(it, "查询房间失败"))
            return
        }

        val currentRoomId = _state.value.room?.roomId
        if (currentRoomId != null && currentRoomId != cleanRoomId) {
            val leaveAck = suspendCoroutine<ListenTogetherAck<Unit>> { continuation ->
                socketClient.emitLeave(currentRoomId) { continuation.resume(it) }
            }
            if (!leaveAck.success) {
                _state.value = _state.value.copy(joining = false)
                handleAckFailure(
                    leaveAck.errorMsg,
                    leaveAck.msg.ifBlank { "退出当前房间失败，请重试" },
                )
                return
            }
            clearState()
        }

        connectAndEnter(session, targetRoom.roomId, targetRoom)
    }

    fun leaveRoom() {
        val roomId = _state.value.room?.roomId
        if (roomId == null) {
            clearState()
            return
        }
        socketClient.emitLeave(roomId) {
            scope.launch {
                clearState()
                emitToast("已退出一起听")
            }
        }
    }

    fun requestTogglePlayPause() {
        if (!guardControl()) return
        musicController.togglePlayPause()
    }

    fun requestPrevious() {
        if (!guardControl()) return
        val room = _state.value.room
        if (room == null) {
            musicController.previous(auto = false)
            return
        }
        val transitionId = beginTransition() ?: return
        if (_state.value.isHost) {
            playOffsetQueueItemAsHost(offset = -1, transitionId = transitionId)
        } else {
            emitQueueCommand(
                ListenTogetherQueueCommand(
                    command = QUEUE_COMMAND_PREVIOUS,
                    transitionId = transitionId,
                ),
            )
        }
    }

    fun requestNext() {
        if (!guardControl()) return
        val room = _state.value.room
        if (room == null) {
            musicController.next(auto = false)
            return
        }
        val transitionId = beginTransition() ?: return
        if (_state.value.isHost) {
            playOffsetQueueItemAsHost(offset = 1, transitionId = transitionId)
        } else {
            emitQueueCommand(
                ListenTogetherQueueCommand(
                    command = QUEUE_COMMAND_NEXT,
                    transitionId = transitionId,
                ),
            )
        }
    }

    fun requestPlaySong(song: SongInfo) {
        requestQueueSong(song)
    }

    fun requestQueueSong(song: SongInfo) {
        if (!guardControl()) return
        if (song.type == SongType.LOCAL && _state.value.enabled) {
            emitToast("本地歌曲暂不支持一起听")
            return
        }
        if (_state.value.room == null) {
            musicController.play(song)
            return
        }
        val transitionId = beginTransition() ?: return
        if (_state.value.isHost) {
            addSongAndPlayAsHost(song, transitionId = transitionId)
        } else {
            emitQueueCommand(
                ListenTogetherQueueCommand(
                    command = QUEUE_COMMAND_ADD_AND_PLAY,
                    song = song.toListenTogetherSong(musicController.duration.value),
                    transitionId = transitionId,
                ),
            )
        }
    }

    fun requestPlayQueueItem(queueItemId: String) {
        if (!guardControl()) return
        if (_state.value.room == null) return
        val transitionId = beginTransition() ?: return
        if (_state.value.isHost) {
            playQueueItemAsHost(queueItemId, transitionId)
        } else {
            emitQueueCommand(
                ListenTogetherQueueCommand(
                    command = QUEUE_COMMAND_PLAY_ITEM,
                    queueItemId = queueItemId,
                    transitionId = transitionId,
                ),
            )
        }
    }

    fun requestRemoveQueueItem(queueItemId: String) {
        if (!guardControl()) return
        if (_state.value.room == null) return
        if (_state.value.isHost) {
            removeQueueItemAsHost(queueItemId)
        } else {
            emitQueueCommand(ListenTogetherQueueCommand(command = QUEUE_COMMAND_REMOVE_ITEM, queueItemId = queueItemId))
        }
    }

    fun updateMemberOperation(enabled: Boolean) {
        val state = _state.value
        val room = state.room ?: return
        if (!state.isHost) {
            emitToast("只有房主可以设置成员权限")
            return
        }
        if (room.memberOperation == enabled) return
        socketClient.emitUpdateRoom(room.roomId, enabled) { handleRoomAck(it) }
    }

    fun kickMember(targetUserId: String) {
        val target = requireManageableMember(
            targetUserId = targetUserId,
            permissionMessage = "只有房主可以移出成员",
            selfMessage = "不能移出自己",
        ) ?: return
        val roomId = _state.value.room?.roomId ?: return
        socketClient.emitKickMember(roomId, target.userId) { ack ->
            scope.launch {
                if (ack.success) {
                    emitToast(context.getString(R.string.listen_together_remove_member_success, target.displayName()))
                } else {
                    handleMemberManagementAckFailure(
                        errorMsg = ack.errorMsg,
                        message = ack.msg.ifBlank { "移出成员失败" },
                    )
                }
            }
        }
    }

    fun transferHost(targetUserId: String) {
        val target = requireManageableMember(
            targetUserId = targetUserId,
            permissionMessage = "只有房主可以转让房主",
            selfMessage = "不能把房主转让给自己",
        ) ?: return
        val roomId = _state.value.room?.roomId ?: return
        socketClient.emitTransferHost(roomId, target.userId) { ack ->
            scope.launch {
                if (ack.success) {
                    handleRoomAck(ack)
                    emitToast(context.getString(R.string.listen_together_transfer_host_success, target.displayName()))
                } else {
                    handleMemberManagementAckFailure(
                        errorMsg = ack.errorMsg,
                        message = ack.msg.ifBlank { "转让房主失败" },
                    )
                }
            }
        }
    }

    fun requestSeek(positionMs: Long) {
        if (!guardControl()) return
        val song = musicController.currentSong.value ?: return
        musicController.seekToPositionMs(positionMs)
        val roomId = _state.value.room?.roomId ?: return
        socketClient.emitSeek(
            roomId = roomId,
            songRef = song.toListenTogetherSongRef(),
            position = positionMs.coerceAtLeast(0L),
        ) { handleRoomAck(it) }
    }

    fun shareText(): String? {
        val room = _state.value.room ?: return null
        return "来 Pisa Music 和我一起听歌，房间号：${room.roomId}\n" +
            ListenTogetherScanLink.buildWebLink(room.roomId)
    }

    private fun connectAndEnter(
        session: AccountSessionStore.Session,
        roomId: String,
        initialRoom: ListenTogetherRoom,
    ) {
        _state.value = _state.value.copy(
            room = initialRoom,
            joining = true,
            lastVersion = initialRoom.version,
            currentUserId = session.user.id,
        )
        socketClient.connect(session.token, object : ListenTogetherSocketClient.Listener {
            override fun onConnected() {
                scope.launch {
                    _state.value = _state.value.copy(socketConnected = true)
                    updateHeartbeat()
                    if (_state.value.joining) emitJoin(roomId) else emitSync(roomId)
                }
            }

            override fun onDisconnected() {
                scope.launch {
                    _state.value = _state.value.copy(socketConnected = false, latencyMs = null)
                    updateHeartbeat()
                }
            }

            override fun onConnectError(message: String) {
                scope.launch {
                    _state.value = _state.value.copy(socketConnected = false, latencyMs = null, joining = false)
                    updateHeartbeat()
                    emitToast(if (message.isBlank()) "一起听连接失败" else message)
                }
            }

            override fun onLatencyUpdated(latencyMs: Long) {
                scope.launch {
                    _state.value = _state.value.copy(latencyMs = latencyMs)
                }
            }

            override fun onBroadcast(event: String, raw: JsonObject) {
                scope.launch { handleBroadcast(event, raw) }
            }
        })
    }

    private fun emitJoin(roomId: String) {
        socketClient.emitJoin(roomId) { ack ->
            scope.launch {
                if (!ack.success) {
                    clearState()
                    handleAckFailure(ack.errorMsg, ack.msg.ifBlank { "加入房间失败" })
                    return@launch
                }
                val room = ack.data?.room
                if (room == null) {
                    handleAckFailure(null, "加入房间失败")
                    return@launch
                }
                applyRoom(room, joining = false)
                syncPlayerToRoom(room, operatorUserId = null)
                requestQueueSnapshot()
            }
        }
    }

    private fun emitSync(roomId: String) {
        socketClient.emitSync(roomId) { ack ->
            scope.launch {
                if (!ack.success) {
                    handleAckFailure(ack.errorMsg, ack.msg.ifBlank { "同步房间失败" })
                    return@launch
                }
                val room = ack.data?.room ?: return@launch
                applyRoom(room, joining = false)
                syncPlayerToRoom(room, operatorUserId = null)
                requestQueueSnapshot()
            }
        }
    }

    private fun observeLocalPlayer() {
        scope.launch {
            musicController.currentSong.collect { song ->
                val key = song.key()
                if (lastSongKey == null) {
                    lastSongKey = key
                    return@collect
                }
                if (lastSongKey == key) return@collect
                lastSongKey = key
                if (song == null || !shouldEmitLocalPlayback()) return@collect
                if (song.type == SongType.LOCAL) {
                    emitToast("本地歌曲暂不支持一起听")
                    return@collect
                }
                if (key != null && expectedLocalSongKeys.remove(key)) {
                    return@collect
                }
                val transitionId = beginTransition() ?: return@collect
                val queueItemId = uniqueQueueItemIdForSong(song)
                emitChangeSong(
                    song = song,
                    autoPlay = musicController.isPlaying.value,
                    transitionId = transitionId,
                    queueItemId = queueItemId,
                )
            }
        }
        scope.launch {
            musicController.isPlaying.collect { playing ->
                val previous = lastPlaying
                lastPlaying = playing
                if (previous == null || previous == playing || !shouldEmitLocalPlayback()) return@collect
                val room = _state.value.room ?: return@collect
                val song = musicController.currentSong.value ?: return@collect
                if (song.type == SongType.LOCAL) return@collect
                if (playing) {
                    socketClient.emitPlay(
                        roomId = room.roomId,
                        song = song.toListenTogetherSong(musicController.duration.value),
                        position = musicController.currentPosition.value,
                    ) { handleRoomAck(it) }
                } else {
                    socketClient.emitPause(
                        roomId = room.roomId,
                        songRef = song.toListenTogetherSongRef(),
                        position = musicController.currentPosition.value,
                    ) { handleRoomAck(it) }
                }
            }
        }
        scope.launch {
            musicController.playbackState.collect { playbackState ->
                if (playbackState != Player.STATE_ENDED) return@collect
                val state = _state.value
                if (!state.enabled || !state.socketConnected || state.syncingFromRemote || !state.isHost) return@collect
                val room = _state.value.room ?: return@collect
                val key = musicController.currentSong.value.key()
                if (key == null || lastEndedSongKey == key) return@collect
                lastEndedSongKey = key
                // 自动续播与用户手动 next 共用防抖窗口，避免一首歌尾 500ms 内手动 next 撞自动 advance 出双切。
                val transitionId = beginTransition() ?: return@collect
                if (playOffsetQueueItemAsHost(offset = 1, transitionId = transitionId)) return@collect
                val song = musicController.currentSong.value ?: return@collect
                socketClient.emitEnded(
                    roomId = room.roomId,
                    songRef = song.toListenTogetherSongRef(),
                    position = musicController.duration.value,
                    transitionId = transitionId,
                ) { handleRoomAck(it) }
            }
        }
    }

    private fun emitChangeSong(
        song: SongInfo,
        autoPlay: Boolean,
        transitionId: String,
        queueItemId: String?,
    ) {
        val room = _state.value.room ?: return
        socketClient.emitChangeSong(
            roomId = room.roomId,
            song = song.toListenTogetherSong(musicController.duration.value),
            autoPlay = autoPlay,
            transitionId = transitionId,
            queueItemId = queueItemId,
        ) { ack ->
            handleRoomAck(ack)
            if (ack.success && ack.data?.applied != false) {
                scope.launch {
                    endTransition(ack.data?.transitionId ?: transitionId, action = ACTION_CHANGE_SONG)
                }
            }
        }
    }

    private fun ensureHostQueueInitialized() {
        val state = _state.value
        if (!state.isHost || state.queue.items.isNotEmpty()) return
        val currentSong = musicController.currentSong.value
        val songs = musicController.playList.value
            .filter { it.type != SongType.LOCAL }
            .toMutableList()
        if (currentSong != null && currentSong.type != SongType.LOCAL) {
            val exists = songs.any { it.type == currentSong.type && it.id == currentSong.id }
            if (!exists) songs.add(0, currentSong)
        }
        val items = songs.map { it.toQueueItem(state.currentUserId) }
        val currentItemId = currentSong?.let { song ->
            items.firstOrNull { it.song.source == song.type.name.lowercase() && it.song.id == song.id }?.queueItemId
        } ?: items.firstOrNull()?.queueItemId
        _state.value = state.copy(
            queue = ListenTogetherQueueState(
                queueVersion = state.queue.queueVersion + 1,
                currentItemId = currentItemId,
                items = items,
            ),
        )
    }

    private fun addSongAndPlayAsHost(
        song: SongInfo,
        addedByUserId: String = _state.value.currentUserId,
        transitionId: String,
    ) {
        if (song.type == SongType.LOCAL) {
            emitToast("本地歌曲暂不支持一起听")
            return
        }
        ensureHostQueueInitialized()
        val item = song.toQueueItem(addedByUserId)
        val state = _state.value
        val queue = state.queue.copy(
            queueVersion = state.queue.queueVersion + 1,
            currentItemId = item.queueItemId,
            items = state.queue.items + item,
            syncing = false,
            snapshotId = null,
        )
        _state.value = state.copy(queue = queue)
        playQueueSongAsHost(item, queue, transitionId)
    }

    private fun playQueueItemAsHost(queueItemId: String, transitionId: String) {
        ensureHostQueueInitialized()
        val state = _state.value
        val item = state.queue.items.firstOrNull { it.queueItemId == queueItemId } ?: return
        val queue = state.queue.copy(
            currentItemId = item.queueItemId,
            syncing = false,
            snapshotId = null,
        )
        _state.value = state.copy(queue = queue)
        // 纯指针移动（next/prev/play-item，items 不变）只发 change_song，
        // 队列当前指针由接收端跟随 room.song 推导，避免两通道分叉导致信息不一致。
        playQueueSongAsHost(item, queue, transitionId, emitDelta = false)
    }

    private fun playOffsetQueueItemAsHost(offset: Int, transitionId: String): Boolean {
        ensureHostQueueInitialized()
        val queue = _state.value.queue
        if (queue.items.isEmpty()) return false
        val currentIndex = queue.currentIndex().takeIf { it >= 0 } ?: currentQueueIndexFromSong(queue)
        val targetIndex = when {
            offset > 0 && currentIndex >= queue.items.lastIndex -> 0
            offset > 0 -> currentIndex + 1
            offset < 0 && currentIndex <= 0 -> queue.items.lastIndex
            offset < 0 -> currentIndex - 1
            else -> currentIndex
        }
        val target = queue.items.getOrNull(targetIndex) ?: return false
        playQueueItemAsHost(target.queueItemId, transitionId)
        return true
    }

    private fun removeQueueItemAsHost(queueItemId: String) {
        ensureHostQueueInitialized()
        val state = _state.value
        val queue = state.queue
        val removeIndex = queue.items.indexOfFirst { it.queueItemId == queueItemId }
        if (removeIndex < 0) return
        val wasCurrent = queue.currentItemId == queueItemId
        val nextItems = queue.items.filterNot { it.queueItemId == queueItemId }
        val nextCurrent = when {
            !wasCurrent -> queue.currentItemId
            nextItems.isEmpty() -> null
            else -> nextItems[removeIndex.coerceAtMost(nextItems.lastIndex)].queueItemId
        }
        val nextQueue = queue.copy(
            queueVersion = queue.queueVersion + 1,
            currentItemId = nextCurrent,
            items = nextItems,
            syncing = false,
            snapshotId = null,
        )
        _state.value = state.copy(queue = nextQueue)
        emitQueueDelta(nextQueue)
        if (!wasCurrent) return
        val nextItem = nextItems.firstOrNull { it.queueItemId == nextCurrent }
        if (nextItem != null) {
            val transitionId = beginTransition() ?: UUID.randomUUID().toString().also(::adoptTransition)
            playQueueSongAsHost(nextItem, nextQueue, transitionId, emitDelta = false)
        } else {
            musicController.pauseCurrent()
            val song = musicController.currentSong.value
            if (song != null) {
                state.room?.roomId?.let { roomId ->
                    socketClient.emitPause(
                        roomId = roomId,
                        songRef = song.toListenTogetherSongRef(),
                        position = musicController.currentPosition.value,
                    ) { handleRoomAck(it) }
                }
            }
        }
    }

    private fun playQueueSongAsHost(
        item: ListenTogetherQueueItem,
        queue: ListenTogetherQueueState,
        transitionId: String,
        emitDelta: Boolean = true,
    ) {
        val song = item.song.toSongInfo()
        val targetKey = song.key()
        if (targetKey != null && targetKey != musicController.currentSong.value.key()) {
            expectedLocalSongKeys.add(targetKey)
        }
        activeHostTransitionId = transitionId
        hostPlaybackJob?.cancel()
        hostPlaybackJob = scope.launch {
            var applied = false
            try {
                applied = musicController.playLatest(song, autoPlay = true)
                if (!applied || activeHostTransitionId != transitionId) return@launch
                if (emitDelta) emitQueueDelta(queue)
                emitChangeSong(
                    song = song,
                    autoPlay = true,
                    transitionId = transitionId,
                    queueItemId = item.queueItemId,
                )
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                emitToast(error.message ?: "切歌失败")
            } finally {
                if (!applied && targetKey != null) expectedLocalSongKeys.remove(targetKey)
                if (activeHostTransitionId == transitionId) {
                    activeHostTransitionId = null
                }
            }
        }
    }

    private fun emitQueueCommand(command: ListenTogetherQueueCommand) {
        val room = _state.value.room ?: return
        socketClient.emitQueueEvent(
            roomId = room.roomId,
            kind = QUEUE_KIND_COMMAND,
            targetUserId = room.hostUserId,
            data = mapOf(
                "command" to command.command,
                "queueItemId" to command.queueItemId,
                "song" to command.song,
                "transitionId" to command.transitionId,
            ),
        ) { ack ->
            scope.launch {
                if (!ack.success) handleAckFailure(ack.errorMsg, ack.msg.ifBlank { "一起听队列操作失败" })
            }
        }
    }

    private fun requestQueueSnapshot() {
        val room = _state.value.room ?: return
        if (_state.value.isHost) return
        _state.value = _state.value.copy(queue = _state.value.queue.copy(syncing = true))
        socketClient.emitQueueEvent(
            roomId = room.roomId,
            kind = QUEUE_KIND_SNAPSHOT_REQUEST,
            targetUserId = room.hostUserId,
        ) { ack ->
            scope.launch {
                if (!ack.success) handleAckFailure(ack.errorMsg, ack.msg.ifBlank { "请求房间队列失败" })
            }
        }
    }

    private fun sendQueueSnapshot(targetUserId: String) {
        ensureHostQueueInitialized()
        val room = _state.value.room ?: return
        val queue = _state.value.queue
        val snapshotId = UUID.randomUUID().toString()
        val chunks = queue.items.chunked(QUEUE_SNAPSHOT_CHUNK_SIZE).ifEmpty { listOf(emptyList()) }
        scope.launch {
            chunks.forEachIndexed { index, items ->
                socketClient.emitQueueEvent(
                    roomId = room.roomId,
                    kind = QUEUE_KIND_SNAPSHOT_CHUNK,
                    targetUserId = targetUserId,
                    data = mapOf(
                        "snapshotId" to snapshotId,
                        "queueVersion" to queue.queueVersion,
                        "total" to queue.items.size,
                        "chunkIndex" to index,
                        "chunkCount" to chunks.size,
                        "currentItemId" to queue.currentItemId,
                        "items" to items,
                    ),
                )
                if (index < chunks.lastIndex) delay(QUEUE_SNAPSHOT_CHUNK_DELAY_MS)
            }
        }
    }

    private fun emitQueueDelta(queue: ListenTogetherQueueState = _state.value.queue) {
        val room = _state.value.room ?: return
        socketClient.emitQueueEvent(
            roomId = room.roomId,
            kind = QUEUE_KIND_DELTA,
            data = mapOf(
                "queueVersion" to queue.queueVersion,
                "currentItemId" to queue.currentItemId,
                "items" to queue.items,
            ),
        )
    }

    private fun handleQueueEvent(data: JsonObject?) {
        val kind = data.getString("kind")
        val fromUserId = data.getString("fromUserId")
        if (fromUserId == _state.value.currentUserId) return
        when (kind) {
            QUEUE_KIND_SNAPSHOT_REQUEST -> {
                if (_state.value.isHost && fromUserId.isNotBlank()) sendQueueSnapshot(fromUserId)
            }
            QUEUE_KIND_SNAPSHOT_CHUNK -> applyQueueSnapshotChunk(
                gson.fromJson(data, ListenTogetherQueueSnapshotChunk::class.java),
            )
            QUEUE_KIND_COMMAND -> {
                if (_state.value.isHost && fromUserId.isNotBlank()) {
                    handleQueueCommand(fromUserId, gson.fromJson(data, ListenTogetherQueueCommand::class.java))
                }
            }
            QUEUE_KIND_DELTA -> applyQueueDelta(gson.fromJson(data, ListenTogetherQueueDelta::class.java))
        }
    }

    private fun handleQueueCommand(fromUserId: String, command: ListenTogetherQueueCommand) {
        val room = _state.value.room ?: return
        if (!room.memberOperation) return
        val transitionId = command.transitionId
            ?.takeIf { it.isNotBlank() }
            ?: UUID.randomUUID().toString()
        when (command.command) {
            QUEUE_COMMAND_ADD_AND_PLAY -> command.song?.toSongInfo()?.let {
                adoptTransition(transitionId)
                addSongAndPlayAsHost(it, fromUserId, transitionId)
            }
            QUEUE_COMMAND_PLAY_ITEM -> command.queueItemId?.let {
                adoptTransition(transitionId)
                playQueueItemAsHost(it, transitionId)
            }
            QUEUE_COMMAND_REMOVE_ITEM -> command.queueItemId?.let { removeQueueItemAsHost(it) }
            QUEUE_COMMAND_NEXT -> {
                adoptTransition(transitionId)
                playOffsetQueueItemAsHost(offset = 1, transitionId = transitionId)
            }
            QUEUE_COMMAND_PREVIOUS -> {
                adoptTransition(transitionId)
                playOffsetQueueItemAsHost(offset = -1, transitionId = transitionId)
            }
        }
    }

    private fun applyQueueSnapshotChunk(chunk: ListenTogetherQueueSnapshotChunk) {
        if (chunk.snapshotId.isBlank() || chunk.chunkCount <= 0) return
        if (pendingSnapshotId != chunk.snapshotId) {
            pendingSnapshotId = chunk.snapshotId
            pendingSnapshotChunkCount = chunk.chunkCount
            pendingSnapshotChunks.clear()
            _state.value = _state.value.copy(
                queue = _state.value.queue.copy(syncing = true, snapshotId = chunk.snapshotId),
            )
        }
        pendingSnapshotChunks[chunk.chunkIndex] = chunk.items
        if (pendingSnapshotChunks.size < pendingSnapshotChunkCount) return
        val items = (0 until pendingSnapshotChunkCount).flatMap { pendingSnapshotChunks[it].orEmpty() }
        _state.value = _state.value.copy(
            queue = ListenTogetherQueueState(
                queueVersion = chunk.queueVersion,
                currentItemId = chunk.currentItemId,
                items = items,
                syncing = false,
                snapshotId = null,
            ),
        )
        pendingSnapshotId = null
        pendingSnapshotChunkCount = 0
        pendingSnapshotChunks.clear()
    }

    private fun applyQueueDelta(delta: ListenTogetherQueueDelta) {
        if (delta.queueVersion < _state.value.queue.queueVersion) return
        val currentQueue = _state.value.queue
        val retainedCurrentItemId = currentQueue.currentItemId
            ?.takeIf { currentId -> delta.items.any { it.queueItemId == currentId } }
        _state.value = _state.value.copy(
            queue = ListenTogetherQueueState(
                queueVersion = delta.queueVersion,
                currentItemId = retainedCurrentItemId,
                items = delta.items,
                syncing = false,
                snapshotId = null,
            ),
        )
    }

    /**
     * 让队列当前指针跟随权威的 room.song：纯指针移动类操作不再单独广播 QUEUE_DELTA，
     * 当前项由这条 change_song 推导，保证「显示的歌」与「播放的歌」始终一致。
     * items 列表仍由 snapshot / 结构性 delta 维护，互不冲突。
     */
    private fun alignQueuePointerToRoomSong(song: ListenTogetherSong?, queueItemId: String?) {
        val queue = _state.value.queue
        val resolution = resolveQueuePointer(queue, song, queueItemId)
        val resolvedItemId = resolution.queueItemId
        if (resolvedItemId != null && queue.currentItemId != resolvedItemId) {
            _state.value = _state.value.copy(queue = queue.copy(currentItemId = resolvedItemId))
        }
        if (resolution.requestSnapshot && !_state.value.isHost) {
            requestQueueSnapshot()
        }
    }

    private fun uniqueQueueItemIdForSong(song: SongInfo): String? {
        val matches = _state.value.queue.items.filter {
            it.song.source.equals(song.type.name, ignoreCase = true) && it.song.id == song.id
        }
        return matches.singleOrNull()?.queueItemId
    }

    private fun currentQueueIndexFromSong(queue: ListenTogetherQueueState): Int {
        val song = musicController.currentSong.value ?: return 0
        return queue.items.indexOfFirst {
            it.song.source == song.type.name.lowercase() && it.song.id == song.id
        }.takeIf { it >= 0 } ?: 0
    }

    private fun targetQueueSong(offset: Int): SongInfo? {
        val songs = musicController.playList.value
        if (songs.isEmpty()) return null
        val current = musicController.currentSong.value
        val currentIndex = songs.indexOfFirst { current != null && it.type == current.type && it.id == current.id }
            .takeIf { it >= 0 }
            ?: musicController.currentIndex.value.coerceIn(0, songs.lastIndex)
        val targetIndex = when {
            offset > 0 && currentIndex >= songs.lastIndex -> 0
            offset > 0 -> currentIndex + 1
            offset < 0 && currentIndex <= 0 -> songs.lastIndex
            offset < 0 -> currentIndex - 1
            else -> currentIndex
        }
        return songs.getOrNull(targetIndex)
    }

    private fun updateHeartbeat() {
        val state = _state.value
        val shouldRun = state.room != null &&
            state.socketConnected &&
            state.room.hostUserId == state.currentUserId
        if (!shouldRun) {
            heartbeatJob?.cancel()
            heartbeatJob = null
            return
        }
        if (heartbeatJob?.isActive == true) return
        heartbeatJob = scope.launch {
            while (isActive) {
                delay(HOST_HEARTBEAT_INTERVAL_MS)
                emitHostHeartbeat()
            }
        }
    }

    private fun emitHostHeartbeat() {
        val room = _state.value.room ?: return
        if (!_state.value.socketConnected || room.hostUserId != _state.value.currentUserId) return
        if (activeHostTransitionId != null || hostPlaybackJob?.isActive == true) return
        val song = musicController.currentSong.value ?: return
        if (song.type == SongType.LOCAL) return
        val position = musicController.currentPosition.value.coerceAtLeast(0L)
        if (musicController.isPlaying.value) {
            socketClient.emitPlay(
                roomId = room.roomId,
                song = song.toListenTogetherSong(musicController.duration.value),
                position = position,
            ) { handleRoomAck(it) }
            return
        }
        if (room.song == null) {
            val transitionId = UUID.randomUUID().toString()
            socketClient.emitChangeSong(
                roomId = room.roomId,
                song = song.toListenTogetherSong(musicController.duration.value),
                autoPlay = false,
                transitionId = transitionId,
                queueItemId = uniqueQueueItemIdForSong(song),
            ) { handleRoomAck(it) }
        } else {
            socketClient.emitPause(
                roomId = room.roomId,
                songRef = song.toListenTogetherSongRef(),
                position = position,
            ) { handleRoomAck(it) }
        }
    }

    private fun handleRoomAck(ack: ListenTogetherAck<ListenTogetherRoomAckData>) {
        scope.launch {
            if (!ack.success) {
                handleAckFailure(ack.errorMsg, ack.msg.ifBlank { "一起听同步失败" })
                return@launch
            }
            ack.data?.room
                ?.takeIf { it.version >= _state.value.lastVersion }
                ?.let { applyRoom(it, joining = false) }
        }
    }

    private fun handleBroadcast(event: String, raw: JsonObject) {
        val roomId = raw.getString("roomId")
        val currentRoomId = _state.value.room?.roomId ?: return
        if (roomId != currentRoomId) return
        val data = raw.getAsJsonObject("data")
        if (event == "QUEUE_EVENT") {
            handleQueueEvent(data)
            return
        }
        val version = raw.getLong("version")
        if (version < _state.value.lastVersion) return

        when (event) {
            "ROOM_STATE_CHANGED" -> {
                val payload = gson.fromJson(data, ListenTogetherStateChangedData::class.java)
                applyRoom(payload.room, joining = false, version = version)
                if (payload.action == ACTION_CHANGE_SONG) {
                    alignQueuePointerToRoomSong(payload.room.song, payload.queueItemId)
                }
                syncPlayerToRoom(payload.room, payload.operator?.userId)
                endTransition(payload.transitionId, payload.action)
            }
            "ROOM_UPDATED" -> {
                val payload = gson.fromJson(data, ListenTogetherRoomDataPayload::class.java)
                applyRoom(payload.room, joining = false, version = version)
            }
            "MEMBER_JOINED" -> {
                val payload = updateMembers(data, version)
                emitHostHeartbeat()
                if (_state.value.isHost) {
                    payload.member?.userId?.takeIf { it != _state.value.currentUserId }?.let { sendQueueSnapshot(it) }
                }
            }
            "MEMBER_LEFT" -> updateMembers(data, version)
            "MEMBER_KICKED" -> {
                val payload = gson.fromJson(data, ListenTogetherKickedData::class.java)
                if (payload.targetUserId == _state.value.currentUserId) {
                    clearState()
                    emitToast("你已被房主移出房间")
                } else {
                    updateCurrentRoom(version) { it.copy(members = payload.members) }
                }
            }
            "HOST_TRANSFERRED" -> {
                val payload = gson.fromJson(data, ListenTogetherHostTransferredData::class.java)
                updateCurrentRoom(version) { it.copy(hostUserId = payload.newHostUserId, members = payload.members) }
            }
            "ROOM_DESTROYED" -> {
                clearState()
                emitToast("房间已关闭")
            }
            "ERROR_MESSAGE" -> emitToast(data?.getString("msg").orEmpty().ifBlank { "一起听同步异常" })
        }
    }

    private fun updateMembers(data: JsonObject?, version: Long): ListenTogetherMembersData {
        val payload = gson.fromJson(data, ListenTogetherMembersData::class.java)
        updateCurrentRoom(version) { room ->
            room.copy(
                hostUserId = payload.newHostUserId?.takeIf { it.isNotBlank() } ?: room.hostUserId,
                members = payload.members,
            )
        }
        return payload
    }

    private fun syncPlayerToRoom(room: ListenTogetherRoom, operatorUserId: String?) {
        val remoteSong = room.song ?: return
        // 自己刚 emit 的操作（host 或开放权限的成员），本地播放器已经在调用方主动同步过；
        // server 的回声广播仅用于元数据，不应再回放或 seek，否则会触发 observeLocalPlayer
        // 二次 emit 引起两首歌之间反复跳动。
        if (!operatorUserId.isNullOrBlank() && operatorUserId == _state.value.currentUserId) return
        val target = room.targetPosition()
        // 串行化：领取最新令牌并取消上一个尚未完成的 sync 协程，避免快速连切时多个协程
        // 重叠把 syncingFromRemote 标志互相踩踏，导致抑制失效引发回发 change_song 的反馈环。
        val seq = ++syncSeq
        syncJob?.cancel()
        syncJob = scope.launch {
            val localSong = musicController.currentSong.value
            val sameSong = localSong?.type?.name?.lowercase() == remoteSong.source.lowercase() &&
                localSong.id == remoteSong.id
            _state.value = _state.value.copy(syncingFromRemote = true)
            try {
                if (!sameSong) {
                    val applied = musicController.playLatest(remoteSong.toSongInfo(), autoPlay = false)
                    if (!applied || seq != syncSeq) return@launch
                }
                val current = musicController.currentPosition.value
                if (abs(current - target) > 1000L) {
                    musicController.seekToPositionMs(target)
                }
                when (room.status) {
                    ListenTogetherRoom.STATUS_PLAYING -> musicController.setPlaying(true)
                    ListenTogetherRoom.STATUS_PAUSED -> musicController.setPlaying(false)
                    ListenTogetherRoom.STATUS_ENDED -> {
                        musicController.setPlaying(false)
                        musicController.seekToPositionMs(room.position)
                    }
                }
                delay(250)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Throwable) {
                emitToast(error.message ?: "同步歌曲失败")
            } finally {
                // 只有持最新令牌的协程才清除抑制标志；被取消的旧协程 seq 已过期，不会误清。
                if (seq == syncSeq) {
                    _state.value = _state.value.copy(syncingFromRemote = false)
                }
            }
        }
    }

    private fun applyRoom(room: ListenTogetherRoom, joining: Boolean, version: Long = room.version) {
        _state.value = _state.value.copy(
            room = room,
            joining = joining,
            lastVersion = version.coerceAtLeast(room.version),
        )
        ensureHostQueueInitialized()
        updateHeartbeat()
    }

    private fun updateCurrentRoom(version: Long, block: (ListenTogetherRoom) -> ListenTogetherRoom) {
        val room = _state.value.room ?: return
        _state.value = _state.value.copy(room = block(room), lastVersion = version)
        ensureHostQueueInitialized()
        updateHeartbeat()
    }

    private fun shouldEmitLocalPlayback(): Boolean {
        val state = _state.value
        return state.enabled && state.socketConnected && !state.syncingFromRemote && canControl(state)
    }

    private fun guardControl(): Boolean {
        val state = _state.value
        if (!state.enabled) return true
        if (!state.socketConnected) {
            emitToast("一起听正在重连")
            return false
        }
        if (canControl(state)) return true
        emitToast("房主正在控制播放")
        socketClient.emitSync(state.room?.roomId ?: return false) { ack ->
            scope.launch {
                if (ack.success) ack.data?.room?.let { applyRoom(it, joining = false) }
            }
        }
        return false
    }

    private fun beginTransition(): String? {
        val state = _state.value
        if (!state.enabled || state.pendingTransition) return null
        val transitionId = UUID.randomUUID().toString()
        adoptTransition(transitionId)
        return transitionId
    }

    private fun adoptTransition(transitionId: String) {
        _state.value = _state.value.copy(pendingTransitionId = transitionId)
        transitionResetJob?.cancel()
        transitionResetJob = scope.launch {
            delay(TRANSITION_DEBOUNCE_MS)
            if (_state.value.pendingTransitionId == transitionId) {
                _state.value = _state.value.copy(pendingTransitionId = null)
            }
        }
    }

    private fun endTransition(transitionId: String?, action: String) {
        if (!shouldCompleteTransition(action, _state.value.pendingTransitionId, transitionId)) return
        transitionResetJob?.cancel()
        transitionResetJob = null
        _state.value = _state.value.copy(pendingTransitionId = null)
    }

    private fun canControl(state: ListenTogetherState): Boolean {
        val room = state.room ?: return false
        return room.hostUserId == state.currentUserId || room.memberOperation
    }

    private fun requireManageableMember(
        targetUserId: String,
        permissionMessage: String,
        selfMessage: String,
    ): ListenTogetherMember? {
        val state = _state.value
        val room = state.room ?: return null
        if (!state.isHost) {
            emitToast(permissionMessage)
            return null
        }
        val cleanTargetUserId = targetUserId.trim()
        if (cleanTargetUserId.isBlank()) {
            emitToast("目标成员不存在")
            return null
        }
        if (cleanTargetUserId == state.currentUserId) {
            emitToast(selfMessage)
            return null
        }
        return room.members.firstOrNull { it.userId == cleanTargetUserId } ?: run {
            emitToast("目标成员已不在房间")
            null
        }
    }

    private fun handleMemberManagementAckFailure(errorMsg: String?, message: String) {
        when (errorMsg) {
            "UNAUTHORIZED" -> handleAckFailure(errorMsg, message)
            "ROOM_NOT_FOUND", "NOT_IN_ROOM" -> handleAckFailure(errorMsg, message)
            "NO_PERMISSION" -> {
                emitToast("当前账号已不是房主")
                _state.value.room?.roomId?.let { emitSync(it) }
            }
            "TARGET_USER_NOT_FOUND" -> {
                emitToast("目标成员已不在房间")
                _state.value.room?.roomId?.let { emitSync(it) }
            }
            "HOST_CANNOT_BE_KICKED" -> emitToast("不能移出房主")
            else -> emitToast(message.ifBlank { "成员管理操作失败" })
        }
    }

    private fun handleAckFailure(errorMsg: String?, message: String) {
        when (errorMsg) {
            "UNAUTHORIZED" -> {
                clearState()
                _events.tryEmit(ListenTogetherUiEvent.RequireLogin("登录已失效，请重新登录"))
            }
            "ROOM_NOT_FOUND", "NOT_IN_ROOM" -> {
                clearState()
                emitToast(message.ifBlank { "房间不存在或已关闭" })
            }
            "NO_PERMISSION" -> {
                emitToast("房主未允许成员控制播放")
                _state.value.room?.roomId?.let { emitSync(it) }
            }
            else -> emitToast(message.ifBlank { "一起听操作失败" })
        }
    }

    private fun clearState() {
        socketClient.disconnect()
        heartbeatJob?.cancel()
        heartbeatJob = null
        transitionResetJob?.cancel()
        transitionResetJob = null
        hostPlaybackJob?.cancel()
        hostPlaybackJob = null
        activeHostTransitionId = null
        syncSeq += 1
        syncJob?.cancel()
        syncJob = null
        pendingSnapshotId = null
        pendingSnapshotChunkCount = 0
        pendingSnapshotChunks.clear()
        expectedLocalSongKeys.clear()
        lastSongKey = null
        lastEndedSongKey = null
        _state.value = ListenTogetherState(currentUserId = AccountSessionStore.read(context).user.id)
    }

    private fun requireSession(): AccountSessionStore.Session? {
        val session = AccountSessionStore.read(context)
        if (!session.loggedIn) {
            _events.tryEmit(ListenTogetherUiEvent.RequireLogin("请先登录账号"))
            return null
        }
        return session
    }

    private fun emitToast(message: String) {
        _events.tryEmit(ListenTogetherUiEvent.Toast(message))
    }

    private fun errorMessage(error: Throwable, fallback: String): String {
        if (error is ListenTogetherApiException) {
            return when (error.errorMsg) {
                "ROOM_FULL" -> "房间人数已满"
                "ROOM_NOT_FOUND" -> "房间不存在"
                "ROOM_ID_EXISTS" -> "房间号已存在"
                "USER_ALREADY_HAS_ROOM" -> "请先退出当前房间"
                "UNAUTHORIZED" -> "请先登录账号"
                else -> error.message.ifBlank { fallback }
            }
        }
        return error.message?.takeIf { it.isNotBlank() } ?: fallback
    }

    private fun SongInfo?.key(): String? = this?.let { "${it.type.name}:${it.id}" }

    private fun JsonObject?.getString(name: String): String =
        this?.get(name)?.takeIf { !it.isJsonNull }?.asString.orEmpty()

    private fun JsonObject?.getLong(name: String): Long =
        this?.get(name)?.takeIf { !it.isJsonNull }?.asLong ?: 0L

    private fun SongInfo.toQueueItem(addedByUserId: String): ListenTogetherQueueItem =
        ListenTogetherQueueItem(
            queueItemId = UUID.randomUUID().toString(),
            song = toListenTogetherSong(duration?.toLong()?.times(1000L)),
            addedByUserId = addedByUserId,
            addedAt = System.currentTimeMillis(),
        )

    companion object {
        private const val HOST_HEARTBEAT_INTERVAL_MS = 6_000L
        private const val TRANSITION_DEBOUNCE_MS = 450L
        private const val QUEUE_SNAPSHOT_CHUNK_SIZE = 200
        private const val QUEUE_SNAPSHOT_CHUNK_DELAY_MS = 50L
        private const val QUEUE_KIND_SNAPSHOT_REQUEST = "SNAPSHOT_REQUEST"
        private const val QUEUE_KIND_SNAPSHOT_CHUNK = "SNAPSHOT_CHUNK"
        private const val QUEUE_KIND_COMMAND = "QUEUE_COMMAND"
        private const val QUEUE_KIND_DELTA = "QUEUE_DELTA"
        private const val QUEUE_COMMAND_ADD_AND_PLAY = "ADD_AND_PLAY"
        private const val QUEUE_COMMAND_PLAY_ITEM = "PLAY_ITEM"
        private const val QUEUE_COMMAND_REMOVE_ITEM = "REMOVE_ITEM"
        private const val QUEUE_COMMAND_NEXT = "NEXT"
        private const val QUEUE_COMMAND_PREVIOUS = "PREVIOUS"
        private const val ACTION_CHANGE_SONG = "CHANGE_SONG"
    }
}
