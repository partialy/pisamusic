package cn.partialy.pm.ui.mine

import cn.partialy.pm.model.SongInfo

/**
 * 本地歌单歌曲批量管理的无状态规则。
 *
 * 所有选择操作只变更当前筛选结果中的歌曲标识，筛选外的既有选择会被保留。
 */
fun filterPlaylistSongs(source: List<SongInfo>, query: String): List<SongInfo> {
    val normalized = query.trim()
    return source.filter {
        normalized.isBlank() ||
            it.name.contains(normalized, ignoreCase = true) ||
            it.artist.contains(normalized, ignoreCase = true)
    }
}

/** 返回当前已展示数量基础上新增一页后的可见窗口。 */
fun playlistSongWindow(
    filtered: List<SongInfo>,
    shown: Int,
    pageSize: Int = 40,
): List<SongInfo> {
    require(pageSize > 0) { "pageSize must be positive" }
    val limit = (shown.coerceAtLeast(0).toLong() + pageSize)
        .coerceAtMost(filtered.size.toLong())
        .toInt()
    return filtered.take(limit)
}

/** 选中当前筛选结果中的全部歌曲，并保留筛选外的选择。 */
fun selectAllPlaylistSongs(
    filtered: List<SongInfo>,
    selectedKeys: Set<String>,
): Set<String> = selectedKeys + filtered.mapTo(linkedSetOf(), ::playlistSongKey)

/** 反选当前筛选结果中的歌曲，并保留筛选外的选择。 */
fun invertPlaylistSongs(
    filtered: List<SongInfo>,
    selectedKeys: Set<String>,
): Set<String> {
    val keys = filtered.mapTo(linkedSetOf(), ::playlistSongKey)
    return (selectedKeys - keys) + (keys - selectedKeys)
}

/** 从完整来源快照按原顺序解析选中的歌曲。 */
fun resolveSelectedPlaylistSongs(
    source: List<SongInfo>,
    selectedKeys: Set<String>,
): List<SongInfo> = source.filter { playlistSongKey(it) in selectedKeys }

/** 歌曲在批量管理中的唯一稳定键。 */
fun playlistSongKey(song: SongInfo): String = "${song.type.name}:\u0000${song.id}"
