package cn.partialy.pm.listen

import android.os.SystemClock
import com.google.gson.Gson
import com.google.gson.JsonObject
import io.socket.client.Ack
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject
import java.util.UUID
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton

@Singleton
class ListenTogetherSocketClient @Inject constructor(
    @Named("system_api_base_url") private val systemApiBaseUrl: String,
) {
    interface Listener {
        fun onConnected()
        fun onDisconnected()
        fun onConnectError(message: String)
        fun onLatencyUpdated(latencyMs: Long)
        fun onBroadcast(event: String, raw: JsonObject)
    }

    private val gson = Gson()
    private var socket: Socket? = null
    private var listener: Listener? = null

    val connected: Boolean get() = socket?.connected() == true

    fun connect(token: String, listener: Listener) {
        disconnect()
        this.listener = listener
        val options = IO.Options().apply {
            transports = arrayOf("websocket")
            auth = mapOf("token" to "Bearer $token")
        }
        socket = IO.socket(systemApiBaseUrl, options).apply {
            on(Socket.EVENT_CONNECT) { listener.onConnected() }
            on(Socket.EVENT_DISCONNECT) { listener.onDisconnected() }
            on(Socket.EVENT_CONNECT_ERROR) { args ->
                listener.onConnectError(args.firstOrNull()?.toString().orEmpty().ifBlank { "Socket 连接失败" })
            }
            BROADCAST_EVENTS.forEach { event ->
                on(event) { args ->
                    args.firstOrNull()?.toJsonObject()?.let { listener.onBroadcast(event, it) }
                }
            }
            connect()
        }
    }

    fun disconnect() {
        socket?.apply {
            off()
            disconnect()
            close()
        }
        socket = null
        listener = null
    }

    fun emitJoin(roomId: String, ack: (ListenTogetherAck<ListenTogetherJoinAckData>) -> Unit) {
        emit("listen:join", roomId, "JOIN", emptyMap(), ListenTogetherJoinAckData::class.java, ack)
    }

    fun emitLeave(roomId: String, ack: (ListenTogetherAck<Unit>) -> Unit) {
        emit("listen:leave", roomId, "LEAVE", emptyMap(), Unit::class.java, ack)
    }

    fun emitPlay(
        roomId: String,
        song: ListenTogetherSong,
        position: Long,
        ack: (ListenTogetherAck<ListenTogetherRoomAckData>) -> Unit,
    ) {
        emit("listen:play", roomId, "PLAY", mapOf("song" to song, "position" to position), ListenTogetherRoomAckData::class.java, ack)
    }

    fun emitPause(roomId: String, position: Long, ack: (ListenTogetherAck<ListenTogetherRoomAckData>) -> Unit) {
        emit("listen:pause", roomId, "PAUSE", mapOf("position" to position), ListenTogetherRoomAckData::class.java, ack)
    }

    fun emitChangeSong(
        roomId: String,
        song: ListenTogetherSong,
        autoPlay: Boolean,
        ack: (ListenTogetherAck<ListenTogetherRoomAckData>) -> Unit,
    ) {
        emit("listen:change_song", roomId, "CHANGE_SONG", mapOf("song" to song, "autoPlay" to autoPlay), ListenTogetherRoomAckData::class.java, ack)
    }

    fun emitSeek(roomId: String, position: Long, ack: (ListenTogetherAck<ListenTogetherRoomAckData>) -> Unit) {
        emit("listen:seek", roomId, "SEEK", mapOf("position" to position), ListenTogetherRoomAckData::class.java, ack)
    }

    fun emitEnded(roomId: String, position: Long, ack: (ListenTogetherAck<ListenTogetherRoomAckData>) -> Unit) {
        emit("listen:ended", roomId, "ENDED", mapOf("position" to position), ListenTogetherRoomAckData::class.java, ack)
    }

    fun emitSync(roomId: String, ack: (ListenTogetherAck<ListenTogetherJoinAckData>) -> Unit) {
        emit("listen:sync", roomId, "SYNC", emptyMap(), ListenTogetherJoinAckData::class.java, ack)
    }

    fun emitUpdateRoom(
        roomId: String,
        memberOperation: Boolean,
        ack: (ListenTogetherAck<ListenTogetherRoomAckData>) -> Unit,
    ) {
        emit(
            "listen:update_room",
            roomId,
            "UPDATE_ROOM",
            mapOf("memberOperation" to memberOperation),
            ListenTogetherRoomAckData::class.java,
            ack,
        )
    }

    fun emitQueueEvent(
        roomId: String,
        kind: String,
        targetUserId: String? = null,
        data: Map<String, Any?> = emptyMap(),
        ack: (ListenTogetherAck<Unit>) -> Unit = {},
    ) {
        val eventData = data.toMutableMap().apply {
            put("kind", kind)
            if (!targetUserId.isNullOrBlank()) put("targetUserId", targetUserId)
        }
        emit("listen:queue", roomId, "QUEUE", eventData, Unit::class.java, ack)
    }

    private fun <T> emit(
        event: String,
        roomId: String,
        action: String,
        data: Map<String, Any?>,
        dataClass: Class<T>,
        ack: (ListenTogetherAck<T>) -> Unit,
    ) {
        val socket = socket ?: run {
            ack(ListenTogetherAck(success = false, code = -1, msg = "Socket 未连接", errorMsg = "SOCKET_DISCONNECTED"))
            return
        }
        val payload = ListenTogetherSocketPayload(
            requestId = UUID.randomUUID().toString(),
            roomId = roomId,
            action = action,
            data = data,
        )
        val sentAt = SystemClock.elapsedRealtime()
        socket.emit(event, JSONObject(gson.toJson(payload)), Ack { args ->
            listener?.onLatencyUpdated((SystemClock.elapsedRealtime() - sentAt).coerceAtLeast(0L))
            ack(parseAck(args.firstOrNull(), dataClass))
        })
    }

    private fun <T> parseAck(raw: Any?, dataClass: Class<T>): ListenTogetherAck<T> {
        val json = raw.toJsonObject() ?: return ListenTogetherAck(success = false, code = -1, msg = "服务端响应无效")
        val success = json.get("success")?.asBoolean == true
        val code = json.get("code")?.asInt ?: -1
        val msg = json.get("msg")?.asString.orEmpty()
        val errorMsg = json.get("errorMsg")?.asString
        val data = json.get("data")?.takeIf { it.isJsonObject && dataClass != Unit::class.java }
            ?.let { runCatching { gson.fromJson(it, dataClass) }.getOrNull() }
        return ListenTogetherAck(success = success, code = code, msg = msg, data = data, errorMsg = errorMsg)
    }

    private fun Any?.toJsonObject(): JsonObject? {
        return when (this) {
            is JSONObject -> runCatching { gson.fromJson(toString(), JsonObject::class.java) }.getOrNull()
            is JsonObject -> this
            is String -> runCatching { gson.fromJson(this, JsonObject::class.java) }.getOrNull()
            else -> runCatching { gson.fromJson(gson.toJson(this), JsonObject::class.java) }.getOrNull()
        }
    }

    companion object {
        private val BROADCAST_EVENTS = listOf(
            "ROOM_STATE_CHANGED",
            "ROOM_UPDATED",
            "MEMBER_JOINED",
            "MEMBER_LEFT",
            "MEMBER_KICKED",
            "HOST_TRANSFERRED",
            "ROOM_DESTROYED",
            "QUEUE_EVENT",
            "ERROR_MESSAGE",
        )
    }
}
