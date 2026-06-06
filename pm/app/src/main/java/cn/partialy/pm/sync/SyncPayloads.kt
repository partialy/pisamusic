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
import com.google.gson.JsonElement
import com.google.gson.JsonNull
import com.google.gson.JsonObject

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

    fun parseSong(value: Any?, itemKey: String = ""): CanonicalSong? {
        val payload = value.toJsonObject() ?: return null
        val fallback = songKeyParts(itemKey)
        val id = payload.stringValue("id").ifBlank { fallback?.second.orEmpty() }
        if (id.isBlank()) return null
        val source = payload.stringValue("source")
            .ifBlank { fallback?.first.orEmpty() }
            .ifBlank { "kg" }
            .let { SongType.fromCanonicalSource(it).toCanonicalSource() }
        return CanonicalSong(
            id = id,
            source = source,
            urlParam = payload.stringValue("urlParam", "url_param").ifBlank { id },
            name = payload.stringValue("name", "title"),
            singer = payload.stringValue("singer", "artist", "author"),
            album = payload.stringValue("album"),
            cover = payload.stringValue("cover", "coverUrl", "pic", "image"),
            coverSize = payload.coverSizeValue("coverSize", "cover_size"),
            duration = payload.intValue("duration", "durationMs"),
            size = payload.longMapValue("size"),
            vip = payload.booleanValue("vip"),
        )
    }

    fun parsePlaylist(value: Any?, itemKey: String = ""): CanonicalPlaylist? {
        val payload = value.toJsonObject() ?: return null
        val fallback = playlistKeyParts(itemKey)
        val id = payload.stringValue("id").ifBlank { fallback?.second.orEmpty() }
        if (id.isBlank()) return null
        val source = payload.stringValue("source")
            .ifBlank { fallback?.first.orEmpty() }
            .ifBlank { "kg" }
            .trim()
            .lowercase()
        return CanonicalPlaylist(
            id = id,
            source = source,
            name = payload.stringValue("name", "title"),
            desc = payload.stringValue("desc", "intro", "description"),
            cover = payload.stringValue("cover", "coverUrl", "pic", "image"),
            coverSize = payload.coverSizeValue("coverSize", "cover_size"),
            tags = payload.tagsValue("tags"),
            song_count = payload.intValue("song_count", "songCount", "count"),
            play_count = payload.stringValue("play_count", "playCount"),
            collect_count = payload.stringValue("collect_count", "collectCount"),
        )
    }

    fun parseJsonObject(raw: String): Any = runCatching {
        gson.fromJson(raw.ifBlank { "{}" }, Any::class.java) ?: emptyMap<String, Any>()
    }.getOrElse { emptyMap<String, Any>() }

    fun songFromKey(key: String): CanonicalSong? {
        val parts = songKeyParts(key) ?: return null
        return CanonicalSong(
            id = parts.second,
            source = parts.first,
            urlParam = parts.second,
            name = "",
            singer = "",
        )
    }

    fun playlistFromKey(key: String): CanonicalPlaylist? {
        val parts = playlistKeyParts(key) ?: return null
        return CanonicalPlaylist(
            id = parts.second,
            source = parts.first,
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

    private fun songKeyParts(key: String): Pair<String, String>? {
        val parts = key.split(":", limit = 2)
        if (parts.size != 2 || parts[1].isBlank()) return null
        return SongType.fromCanonicalSource(parts[0]).toCanonicalSource() to parts[1]
    }

    private fun playlistKeyParts(key: String): Pair<String, String>? {
        val parts = key.split(":", limit = 2)
        if (parts.size != 2 || parts[1].isBlank()) return null
        return parts[0].trim().lowercase().ifBlank { "kg" } to parts[1]
    }

    private fun Any?.toJsonObject(): JsonObject? {
        if (this == null) return null
        return runCatching {
            val element = if (this is String) {
                gson.fromJson(this.ifBlank { "{}" }, JsonElement::class.java)
            } else {
                gson.toJsonTree(this)
            }
            element?.takeIf { it.isJsonObject }?.asJsonObject
        }.getOrNull()
    }

    private fun JsonObject.element(vararg names: String): JsonElement? =
        names.firstNotNullOfOrNull { name ->
            get(name)?.takeUnless { it is JsonNull }
        }

    private fun JsonObject.stringValue(vararg names: String): String {
        val value = element(*names) ?: return ""
        return runCatching {
            when {
                value.isJsonPrimitive -> value.asJsonPrimitive.asString
                else -> ""
            }
        }.getOrDefault("").trim()
    }

    private fun JsonObject.intValue(vararg names: String): Int {
        val value = element(*names) ?: return 0
        return runCatching {
            when {
                value.isJsonPrimitive && value.asJsonPrimitive.isNumber -> value.asInt
                value.isJsonPrimitive -> value.asString.toDoubleOrNull()?.toInt() ?: 0
                else -> 0
            }
        }.getOrDefault(0)
    }

    private fun JsonObject.booleanValue(vararg names: String): Boolean? {
        val value = element(*names) ?: return null
        return runCatching {
            when {
                value.isJsonPrimitive && value.asJsonPrimitive.isBoolean -> value.asBoolean
                value.isJsonPrimitive -> value.asString.toBooleanStrictOrNull()
                else -> null
            }
        }.getOrNull()
    }

    private fun JsonObject.longMapValue(vararg names: String): Map<String, Long>? {
        val value = element(*names)?.takeIf { it.isJsonObject }?.asJsonObject ?: return null
        val result = value.entrySet().mapNotNull { (key, element) ->
            val number = runCatching {
                when {
                    element.isJsonPrimitive && element.asJsonPrimitive.isNumber -> element.asLong
                    element.isJsonPrimitive -> element.asString.toDoubleOrNull()?.toLong()
                    else -> null
                }
            }.getOrNull()
            number?.let { key to it }
        }.toMap()
        return result.ifEmpty { null }
    }

    private fun JsonObject.coverSizeValue(vararg names: String): cn.partialy.pm.model.CanonicalCoverSize? {
        val value = element(*names)?.takeIf { it.isJsonObject }?.asJsonObject ?: return null
        return cn.partialy.pm.model.CanonicalCoverSize(
            s = value.stringValue("s"),
            m = value.stringValue("m"),
            l = value.stringValue("l"),
            xl = value.stringValue("xl"),
        )
    }

    private fun JsonObject.tagsValue(vararg names: String): List<cn.partialy.pm.model.CanonicalPlaylistTag> {
        val value = element(*names)?.takeIf { it.isJsonArray }?.asJsonArray ?: return emptyList()
        return value.mapNotNull { tag -> tag.toPlaylistTag() }
    }

    private fun JsonElement.toPlaylistTag(): cn.partialy.pm.model.CanonicalPlaylistTag? {
        return when {
            isJsonObject -> {
                val obj = asJsonObject
                val name = obj.stringValue("name")
                if (name.isBlank()) null else cn.partialy.pm.model.CanonicalPlaylistTag(
                    name = name,
                    id = obj.stringValue("id"),
                )
            }
            isJsonPrimitive -> {
                val name = runCatching { asString }.getOrDefault("").trim()
                if (name.isBlank()) null else cn.partialy.pm.model.CanonicalPlaylistTag(name = name, id = "")
            }
            else -> null
        }
    }
}
