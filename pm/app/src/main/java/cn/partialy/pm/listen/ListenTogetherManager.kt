package cn.partialy.pm.listen

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.player.MusicController
import com.google.gson.Gson
import com.google.gson.JsonObject
import dagger.hilt.android.qualifiers.ApplicationContext
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
    private var suppressedLocalSongKey: String? = null
    private var heartbeatJob: Job? = null
    private var pendingSnapshotId: String? = null
    private var pendingSnapshotChunkCount: Int = 0
    private val pendingSnapshotChunks = mutableMapOf<Int, List<ListenTogetherQueueItem>>()

    init {
        observeLocalPlayer()
    }

    suspend fun createRoom(currentSong: SongInfo?, replaceExisting: Boolean = false) {
        val session = requireSession() ?: return
        val song = currentSong ?: run {
            emitToast("先播放一首在线歌曲，再创建一起听房间")
            return
        }
        if (song.type == SongType.LOCAL) {
            emitToast("本地歌曲暂不支持一起听")
            return
        }

        runCatching {
            _state.value = _state.value.copy(joining = true, currentUserId = session.user.id)
            val config = repository.getConfig()
            val name = "${session.user.username.ifBlank { "我的" }}的听歌房".take(40)
            val room = repository.createRoom(
                token = session.token,
                request = ListenTogetherCreateRoomRequest(
                    roomName = name,
                    maxPeople = config.defaultMaxPeople.coerceIn(2, config.maxPeopleLimit.coerceAtLeast(2)),
                    memberOperation = false,
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
        if (_state.value.isHost) {
            playOffsetQueueItemAsHost(offset = -1)
        } else {
            emitQueueCommand(ListenTogetherQueueCommand(command = QUEUE_COMMAND_PREVIOUS))
        }
    }

    fun requestNext() {
        if (!guardControl()) return
        val room = _state.value.room
        if (room == null) {
            musicController.next(auto = false)
            return
        }
        if (_state.value.isHost) {
            playOffsetQueueItemAsHost(offset = 1)
        } else {
            emitQueueCommand(ListenTogetherQueueCommand(command = QUEUE_COMMAND_NEXT))
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
        if (_state.value.isHost) {
            addSongAndPlayAsHost(song)
        } else {
            emitQueueCommand(
                ListenTogetherQueueCommand(
                    command = QUEUE_COMMAND_ADD_AND_PLAY,
                    song = song.toListenTogetherSong(musicController.duration.value),
                ),
            )
        }
    }

    fun requestPlayQueueItem(queueItemId: String) {
        if (!guardControl()) return
        if (_state.value.room == null) return
        if (_state.value.isHost) {
            playQueueItemAsHost(queueItemId)
        } else {
            emitQueueCommand(ListenTogetherQueueCommand(command = QUEUE_COMMAND_PLAY_ITEM, queueItemId = queueItemId))
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

    fun requestSeek(positionMs: Long) {
        if (!guardControl()) return
        musicController.seekToPositionMs(positionMs)
        val roomId = _state.value.room?.roomId ?: return
        socketClient.emitSeek(roomId, positionMs.coerceAtLeast(0L)) { handleRoomAck(it) }
    }

    fun shareText(): String? {
        val room = _state.value.room ?: return null
        return "来 Pisa Music 和我一起听歌，房间号：${room.roomId}"
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
                    _state.value = _state.value.copy(socketConnected = false)
                    updateHeartbeat()
                }
            }

            override fun onConnectError(message: String) {
                scope.launch {
                    _state.value = _state.value.copy(socketConnected = false, joining = false)
                    updateHeartbeat()
                    emitToast(if (message.isBlank()) "一起听连接失败" else message)
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
                if (key == suppressedLocalSongKey) {
                    suppressedLocalSongKey = null
                    return@collect
                }
                emitChangeSong(song, autoPlay = musicController.isPlaying.value)
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
                    socketClient.emitPause(room.roomId, musicController.currentPosition.value) { handleRoomAck(it) }
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
                if (playOffsetQueueItemAsHost(offset = 1)) return@collect
                socketClient.emitEnded(room.roomId, musicController.duration.value) { handleRoomAck(it) }
            }
        }
    }

    private fun playAndBroadcastSong(song: SongInfo, autoPlay: Boolean = true) {
        if (song.type == SongType.LOCAL) {
            emitToast("本地歌曲暂不支持一起听")
            return
        }
        val targetKey = song.key()
        suppressedLocalSongKey = targetKey.takeIf { it != musicController.currentSong.value.key() }
        musicController.play(song, autoPlay = autoPlay)
        emitChangeSong(song, autoPlay = autoPlay)
    }

    private fun emitChangeSong(song: SongInfo, autoPlay: Boolean) {
        val room = _state.value.room ?: return
        socketClient.emitChangeSong(
            roomId = room.roomId,
            song = song.toListenTogetherSong(musicController.duration.value),
            autoPlay = autoPlay,
        ) { handleRoomAck(it) }
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

    private fun addSongAndPlayAsHost(song: SongInfo, addedByUserId: String = _state.value.currentUserId) {
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
        playQueueSongAsHost(item, queue)
    }

    private fun playQueueItemAsHost(queueItemId: String) {
        ensureHostQueueInitialized()
        val state = _state.value
        val item = state.queue.items.firstOrNull { it.queueItemId == queueItemId } ?: return
        val queue = state.queue.copy(
            queueVersion = state.queue.queueVersion + 1,
            currentItemId = item.queueItemId,
            syncing = false,
            snapshotId = null,
        )
        _state.value = state.copy(queue = queue)
        playQueueSongAsHost(item, queue)
    }

    private fun playOffsetQueueItemAsHost(offset: Int): Boolean {
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
        playQueueItemAsHost(target.queueItemId)
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
            playQueueSongAsHost(nextItem, nextQueue, emitDelta = false)
        } else {
            musicController.pauseCurrent()
            state.room?.roomId?.let { socketClient.emitPause(it, musicController.currentPosition.value) { handleRoomAck(it) } }
        }
    }

    private fun playQueueSongAsHost(
        item: ListenTogetherQueueItem,
        queue: ListenTogetherQueueState,
        emitDelta: Boolean = true,
    ) {
        val song = item.song.toSongInfo()
        suppressedLocalSongKey = song.key().takeIf { it != musicController.currentSong.value.key() }
        musicController.play(song, autoPlay = true)
        if (emitDelta) emitQueueDelta(queue)
        emitChangeSong(song, autoPlay = true)
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
        when (command.command) {
            QUEUE_COMMAND_ADD_AND_PLAY -> command.song?.toSongInfo()?.let { addSongAndPlayAsHost(it, fromUserId) }
            QUEUE_COMMAND_PLAY_ITEM -> command.queueItemId?.let { playQueueItemAsHost(it) }
            QUEUE_COMMAND_REMOVE_ITEM -> command.queueItemId?.let { removeQueueItemAsHost(it) }
            QUEUE_COMMAND_NEXT -> playOffsetQueueItemAsHost(offset = 1)
            QUEUE_COMMAND_PREVIOUS -> playOffsetQueueItemAsHost(offset = -1)
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
        _state.value = _state.value.copy(
            queue = ListenTogetherQueueState(
                queueVersion = delta.queueVersion,
                currentItemId = delta.currentItemId,
                items = delta.items,
                syncing = false,
                snapshotId = null,
            ),
        )
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
            socketClient.emitChangeSong(
                roomId = room.roomId,
                song = song.toListenTogetherSong(musicController.duration.value),
                autoPlay = false,
            ) { handleRoomAck(it) }
        } else {
            socketClient.emitPause(room.roomId, position) { handleRoomAck(it) }
        }
    }

    private fun handleRoomAck(ack: ListenTogetherAck<ListenTogetherRoomAckData>) {
        scope.launch {
            if (!ack.success) {
                handleAckFailure(ack.errorMsg, ack.msg.ifBlank { "一起听同步失败" })
                return@launch
            }
            ack.data?.room?.let { applyRoom(it, joining = false) }
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
                syncPlayerToRoom(payload.room, payload.operator?.userId)
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
        val target = room.targetPosition()
        if (operatorUserId == _state.value.currentUserId &&
            abs(musicController.currentPosition.value - target) <= 1000L
        ) {
            return
        }
        val localSong = musicController.currentSong.value
        val sameSong = localSong?.type?.name?.lowercase() == remoteSong.source.lowercase()
            && localSong.id == remoteSong.id

        scope.launch {
            _state.value = _state.value.copy(syncingFromRemote = true)
            try {
                if (!sameSong) {
                    musicController.play(remoteSong.toSongInfo(), autoPlay = false)
                    delay(300)
                }
                val current = musicController.currentPosition.value
                if (abs(current - target) > 1000L) {
                    musicController.seekToPositionMs(target)
                    delay(100)
                }
                when (room.status) {
                    ListenTogetherRoom.STATUS_PLAYING -> musicController.playCurrent()
                    ListenTogetherRoom.STATUS_PAUSED -> musicController.pauseCurrent()
                    ListenTogetherRoom.STATUS_ENDED -> {
                        musicController.pauseCurrent()
                        musicController.seekToPositionMs(room.position)
                    }
                }
            } finally {
                delay(250)
                _state.value = _state.value.copy(syncingFromRemote = false)
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

    private fun canControl(state: ListenTogetherState): Boolean {
        val room = state.room ?: return false
        return room.hostUserId == state.currentUserId || room.memberOperation
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
        pendingSnapshotId = null
        pendingSnapshotChunkCount = 0
        pendingSnapshotChunks.clear()
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
    }
}
