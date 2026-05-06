package cn.partialy.pm.model

/**
 * 搜索单曲列表统一行模型（酷狗 / 网易 / 酷我）。
 */
data class SearchTrackRow(
    val stableId: String,
    val title: String,
    val artist: String,
    val coverUrl: String,
    val durationSec: Int?,
    val source: SongType,
    /** KG: hash；WY/KW: 数字 id 字符串 */
    val playRef: String,
    val album: String? = null,
) {
    fun toSongInfo(): SongInfo = SongInfo(
        id = playRef,
        type = source,
        name = title,
        artist = artist,
        coverUrl = coverUrl.ifBlank { "" },
        album = album,
        lyric = null,
        duration = durationSec,
    )
}
