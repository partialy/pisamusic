package cn.partialy.pm.player

import android.content.Context
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

class PlayerStateStore(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    fun load(): PersistedPlayerState? {
        val raw = prefs.getString(KEY_STATE, null) ?: return null
        return runCatching { json.decodeFromString(PersistedPlayerState.serializer(), raw) }.getOrNull()
    }

    fun save(state: PersistedPlayerState) {
        val raw = json.encodeToString(state)
        prefs.edit().putString(KEY_STATE, raw).apply()
    }

    fun clear() {
        prefs.edit().remove(KEY_STATE).apply()
    }

    companion object {
        private const val PREFS = "player_state"
        private const val KEY_STATE = "state_json"
    }
}

@Serializable
data class PersistedPlayerState(
    val songs: List<PersistedSong>,
    val currentIndex: Int,
    val currentSongUrl: String? = null,
    val positionMs: Long,
    val durationMs: Long,
    val playWhenReady: Boolean,
)

@Serializable
data class PersistedSong(
    val id: String,
    val type: String,
    val name: String,
    val artist: String,
    val coverUrl: String = "",
    val album: String? = null,
)

fun PersistedSong.toSongInfo(): SongInfo {
    val t = runCatching { SongType.valueOf(type) }.getOrDefault(SongType.LOCAL)
    return SongInfo(
        id = id,
        type = t,
        name = name,
        artist = artist,
        coverUrl = coverUrl,
        album = album,
    )
}

fun SongInfo.toPersistedSong(): PersistedSong = PersistedSong(
    id = id,
    type = type.name,
    name = name,
    artist = artist,
    coverUrl = coverUrl,
    album = album,
)

