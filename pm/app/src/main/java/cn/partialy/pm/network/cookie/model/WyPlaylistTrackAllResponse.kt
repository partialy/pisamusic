package cn.partialy.pm.network.cookie.model

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType

/** `/playlist/track/all` 响应（节选字段）。 */
data class WyPlaylistTrackAllResponse(
    val songs: List<WyPlaylistTrackSong>? = null,
    val code: Int? = null,
)

data class WyPlaylistTrackSong(
    val name: String? = null,
    val id: Long? = null,
    val ar: List<WyPlaylistTrackArtist>? = null,
    val al: WyPlaylistTrackAlbum? = null,
    /** 时长（毫秒） */
    val dt: Int? = null,
)

data class WyPlaylistTrackArtist(
    val id: Long? = null,
    val name: String? = null,
)

data class WyPlaylistTrackAlbum(
    val id: Long? = null,
    val name: String? = null,
    val picUrl: String? = null,
)

fun WyPlaylistTrackSong.toSongInfoOrNull(): SongInfo? {
    val sid = id ?: return null
    val songName = name?.trim().orEmpty()
    if (songName.isEmpty()) return null
    val artist = ar.orEmpty()
        .mapNotNull { it.name?.trim()?.takeIf { n -> n.isNotEmpty() } }
        .joinToString("、")
    val cover = al?.picUrl?.trim().orEmpty()
    val album = al?.name?.trim()?.takeIf { it.isNotEmpty() }
    val durationSec = ((dt ?: 0) / 1000).coerceAtLeast(0)
    return SongInfo(
        id = sid.toString(),
        type = SongType.WY,
        name = songName,
        artist = artist,
        album = album,
        coverUrl = cover,
        duration = durationSec,
        lyric = null,
    )
}
