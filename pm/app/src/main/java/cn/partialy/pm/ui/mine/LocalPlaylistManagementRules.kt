package cn.partialy.pm.ui.mine

import cn.partialy.pm.model.CollectedPlaylist

/**
 * 本地歌单批量管理的无状态规则。
 *
 * 所有选择操作只变更当前筛选结果中的 ID，筛选外的既有选择会被保留。
 */
fun filter(source: List<CollectedPlaylist>, query: String): List<CollectedPlaylist> =
    source.filter { playlist ->
        query.isBlank() ||
            playlist.name.contains(query, ignoreCase = true) ||
            playlist.intro.contains(query, ignoreCase = true)
    }

/** 返回当前已展示数量基础上新增一页后的可见窗口。 */
fun window(
    filtered: List<CollectedPlaylist>,
    shown: Int,
    pageSize: Int = 40,
): List<CollectedPlaylist> {
    require(pageSize > 0) { "pageSize must be positive" }

    val limit = (shown.coerceAtLeast(0).toLong() + pageSize)
        .coerceAtMost(filtered.size.toLong())
        .toInt()
    return filtered.take(limit)
}

/** 选中当前筛选结果中的全部歌单，并保留筛选外的选择。 */
fun selectAllFiltered(
    filtered: List<CollectedPlaylist>,
    selectedIds: Set<String>,
): Set<String> = selectedIds + filtered.mapTo(linkedSetOf()) { it.id }

/** 反选当前筛选结果中的歌单，并保留筛选外的选择。 */
fun invertFiltered(
    filtered: List<CollectedPlaylist>,
    selectedIds: Set<String>,
): Set<String> {
    val filteredIds = filtered.mapTo(linkedSetOf()) { it.id }
    return (selectedIds - filteredIds) + (filteredIds - selectedIds)
}
