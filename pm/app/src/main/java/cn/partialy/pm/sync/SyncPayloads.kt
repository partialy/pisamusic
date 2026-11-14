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

    fun songKey(song: SongInfo): String = song.toCanonicalSong().let { "${it.source}:${if (song.type == SongType.LOCAL) song.localSyncId ?: it.id else it.id}" }
    fun playlistKey(playlist: CollectedPlaylist): String =
        playlist.toCanonicalPlaylist().let { "${it.source}:${it.id}" }

    fun playlistTrackKey(playlistId: String, song: SongInfo): String {
        if (song.type == SongType.LOCAL) require(LocalSyncTrackStore.isSyncId(song.localSyncId ?: song.id)) {
            "本地歌曲缺少稳定同步身份"
        }
        return "${playlistId}|${songKey(song)}"
    }

    fun songPayload(song: SongInfo, favoritedAt: Long? = null, sortOrder: Long? = null): String {
        val value = if (song.type == SongType.LOCAL) {
            val id = song.localSyncId ?: song.id
            require(LocalSyncTrackStore.isSyncId(id)) { "本地歌曲缺少稳定同步身份" }
            JsonObject().apply {
                addProperty("source", "local"); addProperty("id", id); addProperty("urlParam", id)
                addProperty("name", publicText(song.name)); addProperty("singer", publicText(song.artist))
                addProperty("album", publicText(song.album.orEmpty()))
                addProperty("cover", safeLocalCover(song.coverUrl))
                song.durationMs?.takeIf { it >= 0 }?.let { addProperty("durationMs", it) }
            }
        } else gson.toJsonTree(song.toCanonicalSong().copy(favoritedAt = favoritedAt)).asJsonObject.apply {
            remove("localSyncId")
        }
        sortOrder?.let { value.addProperty("sortOrder", it) }
        return gson.toJson(value)
    }

    private fun publicText(value: String): String = value.take(512).takeUnless {
        it.startsWith("/") || it.startsWith("\\") || Regex("^[A-Za-z]:[\\\\/]").containsMatchIn(it) ||
            Regex("(?i)(file:|content:|[a-z][a-z0-9+.-]*://)").containsMatchIn(it)
    }.orEmpty()

    private fun safeLocalCover(value: String): String = runCatching {
        val uri = java.net.URI(value)
        val allowed = setOf("param", "thumbnail", "w", "h", "width", "height", "size", "quality", "q")
        val querySafe = uri.rawQuery.orEmpty().split('&').filter { it.isNotEmpty() }.all { entry ->
            val pair = entry.split('=', limit = 2)
            pair.size == 2 && pair[0] in allowed &&
                Regex("[0-9]{1,5}(?:[xy_*][0-9]{1,5})?!?").matches(java.net.URLDecoder.decode(pair[1], "UTF-8"))
        }
        val host = uri.host.orEmpty().lowercase()
        val publicHost = host.contains('.') && !Regex("^(localhost|127[.]|10[.]|192[.]168[.]|169[.]254[.]|172[.](1[6-9]|2[0-9]|3[01])[.])").containsMatchIn(host) && !host.endsWith(".local") && !host.endsWith(".localhost")
        value.takeIf { publicHost && it.length <= 2048 && uri.scheme == "https" && !uri.host.isNullOrBlank() && uri.userInfo == null && uri.fragment == null && querySafe }.orEmpty()
    }.getOrDefault("")
    fun playlistPayload(playlist: CollectedPlaylist, clearLocalFileCover: Boolean = true): String {
        val canonical = playlist.toCanonicalPlaylist().let {
            if (clearLocalFileCover && it.source == "local" && isLocalOnlyCover(it.cover)) {
                it.copy(cover = "")
            } else {
                it
            }
        }
        return gson.toJson(gson.toJsonTree(canonical).asJsonObject.apply {
            remove("coverResourcePresent"); remove("coverPresetPresent")
            if (canonical.coverResourcePresent && canonical.coverResource == null) add("coverResource", JsonNull.INSTANCE)
            if (canonical.coverPresetPresent && canonical.coverPreset == null) add("coverPreset", JsonNull.INSTANCE)
        })
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
            duration = if (source == "local") payload.stringValue("durationMs").toDoubleOrNull()
                ?.takeIf { it.isFinite() && it >= 0 }?.div(1000)?.toInt() ?: 0 else payload.intValue("duration"),
            durationMs = if (source == "local") payload.stringValue("durationMs").toDoubleOrNull()
                ?.takeIf { it.isFinite() && it >= 0 }?.toLong() else null,
            size = payload.longMapValue("size"),
            vip = payload.booleanValue("vip"),
            playable = if (source == "local") false else payload.booleanValue("playable") ?: true,
            favoritedAt = payload.stringValue("favoritedAt").toDoubleOrNull()?.toLong()?.takeIf { it > 0 },
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
            coverResource = payload.get("coverResource")?.takeIf { it.isJsonObject }?.asJsonObject
                ?.stringValue("resourceId")?.takeIf { it.isNotBlank() }?.let { cn.partialy.pm.model.CanonicalCoverResource(it) },
            coverPreset = payload.stringValue("coverPreset").takeIf { it.isNotBlank() },
            coverResourcePresent = payload.has("coverResource"), coverPresetPresent = payload.has("coverPreset"),
            favoritedAt = payload.stringValue("favoritedAt").toDoubleOrNull()?.toLong()?.takeIf { it > 0 },
        )
    }

    fun sortOrder(value: Any?): Long? = value.toJsonObject()?.stringValue("sortOrder")?.toDoubleOrNull()
        ?.takeIf { it.isFinite() && it >= 0 && it <= 9007199254740991.0 && it % 1.0 == 0.0 }?.toLong()

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

    internal fun isLocalOnlyCover(cover: String): Boolean {
        val normalized = cover.trim().lowercase()
        return normalized.startsWith("file:") || normalized.startsWith("local_file:") || normalized.startsWith("content:") ||
            normalized.startsWith("/") || normalized.startsWith("\\") || Regex("^[a-z]:[\\\\/]").containsMatchIn(normalized)
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
