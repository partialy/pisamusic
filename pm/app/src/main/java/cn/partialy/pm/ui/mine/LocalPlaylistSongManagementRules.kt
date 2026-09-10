package cn.partialy.pm.ui.mine

import cn.partialy.pm.model.SongInfo

fun filterPlaylistSongs(source: List<SongInfo>, query: String): List<SongInfo> {
    val normalized = query.trim()
    return source.filter {
        normalized.isBlank() ||
            it.name.contains(normalized, ignoreCase = true) ||
            it.artist.contains(normalized, ignoreCase = true)
    }
}

fun playlistSongWindow(filtered: List<SongInfo>, shown: Int, pageSize: Int = 40): List<SongInfo> {
    require(pageSize > 0) { "pageSize must be positive" }
    return filtered.take((shown.coerceAtLeast(0) + pageSize).coerceAtMost(filtered.size))
}

fun selectAllPlaylistSongs(filtered: List<SongInfo>, selectedKeys: Set<String>): Set<String> =
    selectedKeys + filtered.mapTo(linkedSetOf(), ::playlistSongKey)

fun invertPlaylistSongs(filtered: List<SongInfo>, selectedKeys: Set<String>): Set<String> {
    val keys = filtered.mapTo(linkedSetOf(), ::playlistSongKey)
    return (selectedKeys - keys) + (keys - selectedKeys)
}

fun resolveSelectedPlaylistSongs(source: List<SongInfo>, selectedKeys: Set<String>): List<SongInfo> =
    source.filter { playlistSongKey(it) in selectedKeys }

fun playlistSongKey(song: SongInfo): String = "${song.type.name}:\u0000${song.id}"
