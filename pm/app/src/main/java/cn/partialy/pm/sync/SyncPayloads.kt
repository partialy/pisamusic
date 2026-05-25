package cn.partialy.pm.sync

import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.CanonicalSong
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.fromCanonicalSource
import cn.partialy.pm.model.toCanonicalPlaylist
import cn.partialy.pm.model.toCanonicalSong
import cn.partialy.pm.model.toCanonicalSource
import com.google.gson.Gson

object SyncPayloads {
    const val TYPE_FAVORITE_SONG = "favorite_song"
    const val TYPE_FAVORITE_PLAYLIST = "favorite_playlist"
    const val TYPE_USER_PLAYLIST = "user_playlist"
    const val TYPE_PLAYLIST_TRACK = "playlist_track"
    const val ACTION_UPSERT = "upsert"
    const val ACTION_DELETE = "delete"

    private val gson = Gson()

    fun songKey(song: SongInfo): String = song.toCanonicalSong().let { "${it.source}:${it.id}" }
    fun playlistKey(playlist: CollectedPlaylist): String =
        playlist.toCanonicalPlaylist().let { "${it.source}:${it.id}" }

    fun playlistTrackKey(playlistId: String, song: SongInfo): String = "${playlistId}|${songKey(song)}"

    fun songPayload(song: SongInfo): String = gson.toJson(song.toCanonicalSong())
    fun playlistPayload(playlist: CollectedPlaylist, clearLocalFileCover: Boolean = true): String {
        val canonical = playlist.toCanonicalPlaylist().let {
            if (clearLocalFileCover && it.source == "local" && isLocalOnlyCover(it.cover)) {
                it.copy(cover = "")
            } else {
                it
            }
        }
        return gson.toJson(canonical)
    }

    fun parseSong(value: Any?): CanonicalSong? = parse(value, CanonicalSong::class.java)
    fun parsePlaylist(value: Any?): CanonicalPlaylist? = parse(value, CanonicalPlaylist::class.java)
    fun parseJsonObject(raw: String): Any = runCatching {
        gson.fromJson(raw.ifBlank { "{}" }, Any::class.java) ?: emptyMap<String, Any>()
    }.getOrElse { emptyMap<String, Any>() }

    fun songFromKey(key: String): CanonicalSong? {
        val parts = key.split(":", limit = 2)
        if (parts.size != 2 || parts[1].isBlank()) return null
        return CanonicalSong(
            id = parts[1],
            source = SongType.fromCanonicalSource(parts[0]).toCanonicalSource(),
            urlParam = parts[1],
            name = "",
            singer = "",
        )
    }

    fun playlistFromKey(key: String): CanonicalPlaylist? {
        val parts = key.split(":", limit = 2)
        if (parts.size != 2 || parts[1].isBlank()) return null
        return CanonicalPlaylist(
            id = parts[1],
            source = parts[0].trim().lowercase().ifBlank { "kg" },
            name = "",
        )
    }

    fun playlistTrackFromKey(key: String): Pair<String, CanonicalSong>? {
        val parts = key.split("|", limit = 2)
        if (parts.size != 2 || parts[0].isBlank()) return null
        val song = songFromKey(parts[1]) ?: return null
        return parts[0] to song
    }

    private fun isLocalOnlyCover(cover: String): Boolean {
        val normalized = cover.trim().lowercase()
        return normalized.startsWith("file:") || normalized.startsWith("local_file:")
    }

    private fun <T> parse(value: Any?, clazz: Class<T>): T? {
        if (value == null) return null
        return runCatching {
            gson.fromJson(gson.toJson(value), clazz)
        }.getOrNull()
    }
}
