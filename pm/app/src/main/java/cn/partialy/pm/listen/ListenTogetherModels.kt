package cn.partialy.pm.listen

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType

data class ListenTogetherConfigResponse(
    val msg: String = "",
    val code: Int = 0,
    val success: Boolean = true,
    val data: ListenTogetherConfig = ListenTogetherConfig(),
)

data class ListenTogetherRoomResponse(
    val msg: String = "",
    val code: Int = 0,
    val success: Boolean = true,
    val data: ListenTogetherRoomData? = null,
    val errorMsg: String? = null,
)

data class ListenTogetherRoomData(
    val room: ListenTogetherRoom = ListenTogetherRoom(),
)

data class ListenTogetherCreateRoomRequest(
    val roomName: String,
    val roomId: String? = null,
    val maxPeople: Int? = null,
    val memberOperation: Boolean = false,
)

data class ListenTogetherConfig(
    val maxPeopleLimit: Int = 8,
    val defaultMaxPeople: Int = 2,
    val roomIdMinLength: Int = 4,
    val roomIdMaxLength: Int = 8,
    val defaultRoomIdLength: Int = 6,
)

data class ListenTogetherRoom(
    val roomId: String = "",
    val roomName: String = "",
    val hostUserId: String = "",
    val song: ListenTogetherSong? = null,
    val status: String = STATUS_PAUSED,
    val position: Long = 0L,
    val maxPeople: Int = 2,
    val currentPeople: Int = 0,
    val memberOperation: Boolean = false,
    val createdAt: Long = 0L,
    val updatedAt: Long = 0L,
    val version: Long = 0L,
    val members: List<ListenTogetherMember> = emptyList(),
) {
    fun displayPeople(): Int = currentPeople.takeIf { it > 0 } ?: members.count { it.online }.coerceAtLeast(1)

    companion object {
        const val STATUS_PLAYING = "playing"
        const val STATUS_PAUSED = "paused"
        const val STATUS_ENDED = "ended"
    }
}

data class ListenTogetherMember(
    val userId: String = "",
    val username: String = "",
    val nickname: String = "",
    val avatarUrl: String = "",
    val role: String = ROLE_MEMBER,
    val online: Boolean = false,
    val joinedAt: Long = 0L,
    val lastSeenAt: Long = 0L,
) {
    fun displayName(): String = nickname.ifBlank { username }.ifBlank { userId }

    companion object {
        const val ROLE_HOST = "host"
        const val ROLE_MEMBER = "member"
    }
}

data class ListenTogetherSong(
    val id: String = "",
    val source: String = "kg",
    val urlParam: String = "",
    val name: String = "",
    val singer: String = "",
    val album: String = "",
    val cover: String = "",
    val coverSize: ListenTogetherCoverSize? = null,
    val url: String = "",
    val duration: Long = 0L,
    val vip: Boolean? = null,
    val size: Map<String, Long>? = null,
    val filePath: String? = null,
)

data class ListenTogetherCoverSize(
    val s: String = "",
    val m: String = "",
    val l: String = "",
    val xl: String = "",
)

data class ListenTogetherState(
    val room: ListenTogetherRoom? = null,
    val queue: ListenTogetherQueueState = ListenTogetherQueueState(),
    val socketConnected: Boolean = false,
    val joining: Boolean = false,
    val syncingFromRemote: Boolean = false,
    val lastVersion: Long = -1L,
    val currentUserId: String = "",
) {
    val enabled: Boolean get() = room != null
    val isHost: Boolean get() = room?.hostUserId?.isNotBlank() == true && currentUserId == room.hostUserId
}

data class ListenTogetherQueueItem(
    val queueItemId: String = "",
    val song: ListenTogetherSong = ListenTogetherSong(),
    val addedByUserId: String = "",
    val addedAt: Long = 0L,
)

data class ListenTogetherQueueState(
    val queueVersion: Long = 0L,
    val currentItemId: String? = null,
    val items: List<ListenTogetherQueueItem> = emptyList(),
    val syncing: Boolean = false,
    val snapshotId: String? = null,
) {
    fun currentIndex(): Int = items.indexOfFirst { it.queueItemId == currentItemId }
}

data class ListenTogetherQueueSnapshotChunk(
    val snapshotId: String = "",
    val queueVersion: Long = 0L,
    val total: Int = 0,
    val chunkIndex: Int = 0,
    val chunkCount: Int = 0,
    val currentItemId: String? = null,
    val items: List<ListenTogetherQueueItem> = emptyList(),
)

data class ListenTogetherQueueDelta(
    val queueVersion: Long = 0L,
    val currentItemId: String? = null,
    val items: List<ListenTogetherQueueItem> = emptyList(),
)

data class ListenTogetherQueueCommand(
    val command: String = "",
    val queueItemId: String? = null,
    val song: ListenTogetherSong? = null,
)

data class ListenTogetherSocketPayload(
    val requestId: String,
    val roomId: String,
    val action: String,
    val data: Map<String, Any?> = emptyMap(),
)

data class ListenTogetherAck<T>(
    val success: Boolean = false,
    val code: Int = 0,
    val msg: String = "",
    val data: T? = null,
    val errorMsg: String? = null,
)

data class ListenTogetherJoinAckData(
    val room: ListenTogetherRoom = ListenTogetherRoom(),
    val serverTime: Long = 0L,
)

data class ListenTogetherRoomAckData(
    val room: ListenTogetherRoom = ListenTogetherRoom(),
)

data class ListenTogetherBroadcast<T>(
    val event: String = "",
    val roomId: String = "",
    val serverTime: Long = 0L,
    val version: Long = 0L,
    val data: T? = null,
)

data class ListenTogetherStateChangedData(
    val action: String = "",
    val room: ListenTogetherRoom = ListenTogetherRoom(),
    val operator: ListenTogetherOperator? = null,
)

data class ListenTogetherRoomDataPayload(
    val room: ListenTogetherRoom = ListenTogetherRoom(),
)

data class ListenTogetherMembersData(
    val member: ListenTogetherMember? = null,
    val members: List<ListenTogetherMember> = emptyList(),
    val userId: String? = null,
    val newHostUserId: String? = null,
)

data class ListenTogetherKickedData(
    val targetUserId: String = "",
    val members: List<ListenTogetherMember> = emptyList(),
)

data class ListenTogetherHostTransferredData(
    val oldHostUserId: String = "",
    val newHostUserId: String = "",
    val members: List<ListenTogetherMember> = emptyList(),
)

data class ListenTogetherOperator(
    val userId: String = "",
    val nickname: String = "",
)

sealed class ListenTogetherUiEvent {
    data class Toast(val message: String) : ListenTogetherUiEvent()
    data class RequireLogin(val message: String) : ListenTogetherUiEvent()
}

class ListenTogetherApiException(
    val apiCode: Int,
    override val message: String,
    val errorMsg: String? = null,
) : RuntimeException(message)

fun SongInfo.toListenTogetherSong(durationMs: Long? = null): ListenTogetherSong =
    ListenTogetherSong(
        id = id,
        source = type.name.lowercase(),
        urlParam = id,
        name = name,
        singer = artist,
        album = album.orEmpty(),
        cover = coverUrl,
        url = "",
        duration = durationMs?.takeIf { it > 0L } ?: ((duration ?: 0).coerceAtLeast(0).toLong() * 1000L),
    )

fun ListenTogetherSong.toSongInfo(): SongInfo =
    SongInfo(
        id = id.ifBlank { urlParam },
        type = when (source.lowercase()) {
            "wy" -> SongType.WY
            "kw" -> SongType.KW
            "local" -> SongType.LOCAL
            else -> SongType.KG
        },
        name = name,
        artist = singer,
        coverUrl = cover,
        album = album,
        duration = (duration / 1000L).coerceAtLeast(0L).toInt(),
    )

fun ListenTogetherRoom.targetPosition(nowMs: Long = System.currentTimeMillis()): Long {
    if (status != ListenTogetherRoom.STATUS_PLAYING) return position.coerceAtLeast(0L)
    return (position + (nowMs - updatedAt).coerceAtLeast(0L)).coerceAtLeast(0L)
}
