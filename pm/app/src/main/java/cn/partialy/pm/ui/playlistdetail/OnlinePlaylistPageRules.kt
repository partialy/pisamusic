package cn.partialy.pm.ui.playlistdetail

internal enum class OnlinePlaylistPageOutcome { CONTINUE, COMPLETE, FAILED }

/** 用原始游标确定结束，并拒绝空缺页及服务端重复返回同一页。 */
internal fun onlinePlaylistPageOutcome(
    total: Int,
    nextOffset: Int,
    rawSize: Int,
    addedCount: Int,
    pageSize: Int,
    totalIsAuthoritative: Boolean = true,
): OnlinePlaylistPageOutcome = when {
    rawSize > 0 && addedCount == 0 -> OnlinePlaylistPageOutcome.FAILED
    totalIsAuthoritative && total > 0 && nextOffset >= total -> OnlinePlaylistPageOutcome.COMPLETE
    (!totalIsAuthoritative || total <= 0) && rawSize < pageSize -> OnlinePlaylistPageOutcome.COMPLETE
    rawSize == 0 -> OnlinePlaylistPageOutcome.FAILED
    else -> OnlinePlaylistPageOutcome.CONTINUE
}
