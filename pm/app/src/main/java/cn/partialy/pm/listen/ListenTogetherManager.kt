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

    init {
        observeLocalPlayer()
    }

    suspend fun createRoom(currentSong: SongInfo?) {
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
                ),
            )
            connectAndEnter(session, room.roomId, room)
        }.onFailure {
            _state.value = _state.value.copy(joining = false)
            emitToast(errorMessage(it, "创建房间失败"))
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
        val target = targetQueueSong(offset = -1) ?: return
        playAndBroadcastSong(target)
    }

    fun requestNext() {
        if (!guardControl()) return
        val room = _state.value.room
        if (room == null) {
            musicController.next(auto = false)
            return
        }
        val target = targetQueueSong(offset = 1) ?: return
        playAndBroadcastSong(target)
    }

    fun requestPlaySong(song: SongInfo) {
        if (!guardControl()) return
        if (song.type == SongType.LOCAL && _state.value.enabled) {
            emitToast("本地歌曲暂不支持一起听")
            return
        }
        if (_state.value.room == null) {
            musicController.play(song)
            return
        }
        playAndBroadcastSong(song)
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
                if (playbackState != Player.STATE_ENDED || !shouldEmitLocalPlayback()) return@collect
                val room = _state.value.room ?: return@collect
                val key = musicController.currentSong.value.key()
                if (key == null || lastEndedSongKey == key) return@collect
                lastEndedSongKey = key
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
        val version = raw.getLong("version")
        if (version < _state.value.lastVersion) return
        val data = raw.getAsJsonObject("data")

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
                updateMembers(data, version)
                emitHostHeartbeat()
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

    private fun updateMembers(data: JsonObject?, version: Long) {
        val payload = gson.fromJson(data, ListenTogetherMembersData::class.java)
        updateCurrentRoom(version) { room ->
            room.copy(
                hostUserId = payload.newHostUserId?.takeIf { it.isNotBlank() } ?: room.hostUserId,
                members = payload.members,
            )
        }
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
        updateHeartbeat()
    }

    private fun updateCurrentRoom(version: Long, block: (ListenTogetherRoom) -> ListenTogetherRoom) {
        val room = _state.value.room ?: return
        _state.value = _state.value.copy(room = block(room), lastVersion = version)
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

    companion object {
        private const val HOST_HEARTBEAT_INTERVAL_MS = 6_000L
    }
}
