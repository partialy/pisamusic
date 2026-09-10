package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongInfo

fun missingPlayableSongs(loaded: List<SongInfo>, queued: List<SongInfo>): List<SongInfo> {
    val known = queued.mapTo(hashSetOf()) { it.type to it.id }
    return loaded.filter { it.playable && known.add(it.type to it.id) }
}
