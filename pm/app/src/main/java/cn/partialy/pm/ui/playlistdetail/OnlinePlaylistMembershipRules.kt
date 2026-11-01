package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.network.cookie.model.WyPlaylistDetailAuthorityResponse

/** 缺字段或截断身份列表不能证明空歌单。 */
internal fun WyPlaylistDetailAuthorityResponse.requireCompleteMembership(playlistId: String): List<Long?> {
    check(code == 200) { "Playlist detail was not successful" }
    val detail = playlist ?: error("Missing playlist detail")
    check(detail.id != null && detail.id == playlistId.toLongOrNull()) { "Playlist identity mismatch" }
    val count = detail.trackCount ?: error("Missing playlist total")
    val ids = detail.trackIds ?: error("Missing playlist membership")
    check(count >= 0 && count == ids.size) { "Partial playlist membership" }
    return ids.map { it?.id }
}

internal fun matchesPlaylistMembershipPage(expected: List<Long?>, offset: Int, actual: List<Long?>): Boolean =
    offset >= 0 && offset <= expected.size && actual.size <= expected.size - offset &&
        expected.subList(offset, offset + actual.size) == actual
