package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.model.SongInfo

fun missingPlayableSongs(loaded: List<SongInfo>, queued: List<SongInfo>): List<SongInfo> {
    val known = queued.mapTo(hashSetOf()) { it.type to it.id }
    return loaded.filter { it.playable && known.add(it.type to it.id) }
}

/**
 * 根据歌单总曲目数动态计算单页/单批拉取大小。
 * 目标是将全量加载平摊为约 3 批次，并强制限制在 [50, 200] 黄金性能区间内：
 * - 小于等于 50 首时单批 50；
 * - 301 首时单批 (301 + 2) / 3 = 101；
 * - 大于等于 600 首时单批 200。
 */
fun resolveDynamicBatchSize(totalCount: Int): Int {
    if (totalCount <= 0) return 50
    return ((totalCount + 2) / 3).coerceIn(50, 200)
}
