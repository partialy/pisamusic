package cn.partialy.pm.model

/**
 * 与桌面端 Song 字段保持一致的歌曲快照。
 *
 * Android 现有播放链路仍使用 [SongInfo]，收藏、歌单和后续同步持久化优先写入本结构。
 */
data class CanonicalSong(
    val id: String,
    val source: String,
    val urlParam: String,
    val name: String,
    val singer: String,
    val album: String = "",
    val cover: String = "",
    val coverSize: CanonicalCoverSize? = null,
    val duration: Int = 0,
    val size: Map<String, Long>? = null,
    val vip: Boolean? = null,
)

data class CanonicalCoverSize(
    val s: String = "",
    val m: String = "",
    val l: String = "",
    val xl: String = "",
)

/**
 * 与桌面端 CommonPlaylist 字段保持一致的歌单快照。
 */
data class CanonicalPlaylist(
    val id: String,
    val source: String,
    val name: String,
    val desc: String = "",
    val cover: String = "",
    val coverSize: CanonicalCoverSize? = null,
    val tags: List<CanonicalPlaylistTag> = emptyList(),
    val song_count: Int = 0,
    val play_count: String = "",
    val collect_count: String = "",
)

data class CanonicalPlaylistTag(
    val name: String,
    val id: String,
)

fun SongType.toCanonicalSource(): String = name.lowercase()

fun SongType.Companion.fromCanonicalSource(source: String): SongType =
    when (source.trim().lowercase()) {
        "wy" -> SongType.WY
        "kw" -> SongType.KW
        "local" -> SongType.LOCAL
        else -> SongType.KG
    }

fun CollectedPlaylistType.toCanonicalSource(): String =
    when (this) {
        CollectedPlaylistType.WY, CollectedPlaylistType.IMPORT_WY -> "wy"
        CollectedPlaylistType.KG, CollectedPlaylistType.IMPORT_KG -> "kg"
        CollectedPlaylistType.LOCAL -> "local"
    }

fun CollectedPlaylistType.Companion.fromCanonicalSource(source: String): CollectedPlaylistType =
    when (source.trim().lowercase()) {
        "wy" -> CollectedPlaylistType.WY
        "local" -> CollectedPlaylistType.LOCAL
        else -> CollectedPlaylistType.KG
    }

fun SongInfo.toCanonicalSong(): CanonicalSong =
    CanonicalSong(
        id = id,
        source = type.toCanonicalSource(),
        urlParam = id,
        name = name,
        singer = artist,
        album = album.orEmpty(),
        cover = coverUrl,
        duration = duration ?: 0,
    )

fun CanonicalSong.toSongInfo(): SongInfo =
    SongInfo(
        id = id,
        type = SongType.fromCanonicalSource(source),
        name = name,
        artist = singer,
        coverUrl = cover,
        album = album,
        duration = duration,
    )

fun CollectedPlaylist.toCanonicalPlaylist(): CanonicalPlaylist =
    CanonicalPlaylist(
        id = id,
        source = type.toCanonicalSource(),
        name = name,
        desc = intro,
        cover = cover,
        song_count = count,
    )

fun CanonicalPlaylist.toCollectedPlaylist(): CollectedPlaylist =
    CollectedPlaylist(
        type = CollectedPlaylistType.fromCanonicalSource(source),
        id = id,
        name = name,
        intro = desc,
        cover = cover,
        count = song_count,
    )
