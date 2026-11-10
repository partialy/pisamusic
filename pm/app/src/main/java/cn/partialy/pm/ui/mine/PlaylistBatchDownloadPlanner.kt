package cn.partialy.pm.ui.mine

import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType

/** 与 UI 无关的批量下载规划：先稳定去重、过滤，再按首次出现的音源分组。 */
data class PlaylistBatchDownloadPlan(
    val groups: List<List<SongInfo>>,
    val localSkipped: Int,
    val unavailableSkipped: Int,
) {
    val validCount: Int get() = groups.sumOf { it.size }
}

fun planPlaylistBatchDownload(songs: List<SongInfo>): PlaylistBatchDownloadPlan {
    val distinct = songs.distinctBy { it.type to it.id }
    val locals = distinct.count { it.type == SongType.LOCAL }
    val unavailable = distinct.count { it.type != SongType.LOCAL && (it.id.isBlank() || !it.playable) }
    val bySource = linkedMapOf<SongType, MutableList<SongInfo>>()
    distinct.filter { it.type != SongType.LOCAL && it.id.isNotBlank() && it.playable }
        .forEach { song -> bySource.getOrPut(song.type) { mutableListOf() }.add(song) }
    return PlaylistBatchDownloadPlan(bySource.values.map { it.toList() }, locals, unavailable)
}
