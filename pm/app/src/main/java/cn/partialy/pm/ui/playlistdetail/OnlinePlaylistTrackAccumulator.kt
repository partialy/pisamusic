package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.mine.playlistSongKey

/** 稳定保留首条记录，并保留快照中已知的不可播放状态。 */
internal class OnlinePlaylistTrackAccumulator(initial: List<SongInfo>) {
    private val seed = initial.groupBy(::playlistSongKey)
    private val loaded = linkedMapOf<String, SongInfo>()
    var skippedCount: Int = 0
        private set

    fun append(rows: List<SongInfo?>) {
        rows.forEach { song ->
            if (song == null || song.id.isBlank() ||
                (song.type == SongType.WY && (song.id.toLongOrNull() ?: 0) <= 0)) {
                skippedCount++
                return@forEach
            }
            val key = playlistSongKey(song)
            if (key in loaded) skippedCount++ else {
                loaded[key] = if (seed[key].orEmpty().any { !it.playable }) song.copy(playable = false) else song
            }
        }
    }

    fun songs(): List<SongInfo> = loaded.values.toList()
    fun partialWithSeed(): List<SongInfo> = songs() + seed.filterKeys { it !in loaded }.values.map { it.first() }
}
