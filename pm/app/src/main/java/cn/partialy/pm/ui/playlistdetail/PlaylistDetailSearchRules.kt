package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongInfo

internal data class PlaylistDetailSongRow(
    val song: SongInfo,
    val originalIndex: Int,
)

internal fun filterPlaylistSongRows(
    songs: List<SongInfo>,
    rawQuery: String,
): List<PlaylistDetailSongRow> {
    val query = rawQuery.trim()
    return songs.mapIndexedNotNull { index, song ->
        val matched = query.isEmpty() ||
            song.name.contains(query, ignoreCase = true) ||
            song.artist.contains(query, ignoreCase = true)
        if (matched) PlaylistDetailSongRow(song, index) else null
    }
}
