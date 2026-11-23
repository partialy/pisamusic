package cn.partialy.pm.ui.mine

import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.network.cookie.MusicCookieManager
import cn.partialy.pm.network.cookie.ThirdPartyPlaylistCandidate

enum class ThirdPartySourceFilter(val sourceKey: String?) {
    ALL(null),
    KG(MusicCookieManager.SOURCE_KG),
    WY(MusicCookieManager.SOURCE_WY),
}

data class ThirdPartyPlaylistCandidateRow(
    val candidate: ThirdPartyPlaylistCandidate,
    val imported: Boolean,
    val selected: Boolean,
)

/**
 * 三方候选歌单筛选、增量标记与批量选择纯逻辑（独立于 Android 视图以便单元测试）。
 */
object ThirdPartyPlaylistImportRules {

    fun collectedKeySet(playlists: List<CollectedPlaylist>): Set<String> {
        val keys = HashSet<String>(playlists.size)
        for (playlist in playlists) {
            if (playlist.id.isBlank()) continue
            val source = when (playlist.type) {
                CollectedPlaylistType.KG, CollectedPlaylistType.IMPORT_KG -> MusicCookieManager.SOURCE_KG
                CollectedPlaylistType.WY, CollectedPlaylistType.IMPORT_WY -> MusicCookieManager.SOURCE_WY
                CollectedPlaylistType.LOCAL -> null
            } ?: continue
            keys.add("$source:${playlist.id}")
        }
        return keys
    }

    fun filterCandidates(
        items: List<ThirdPartyPlaylistCandidate>,
        sourceFilter: ThirdPartySourceFilter,
        query: String,
    ): List<ThirdPartyPlaylistCandidate> {
        val trimmedQuery = query.trim()
        val requiredSource = sourceFilter.sourceKey
        return items.filter { item ->
            val sourceMatches = requiredSource == null || item.source.equals(requiredSource, ignoreCase = true)
            if (!sourceMatches) return@filter false
            if (trimmedQuery.isEmpty()) return@filter true
            item.name.contains(trimmedQuery, ignoreCase = true) ||
                item.intro.contains(trimmedQuery, ignoreCase = true) ||
                item.source.contains(trimmedQuery, ignoreCase = true)
        }
    }

    fun selectAllImportable(
        filtered: List<ThirdPartyPlaylistCandidate>,
        importedKeys: Set<String>,
        currentSelected: Set<String>,
    ): Set<String> {
        val next = LinkedHashSet(currentSelected)
        for (item in filtered) {
            val key = item.key()
            if (key !in importedKeys) {
                next.add(key)
            }
        }
        return next
    }

    fun invertImportable(
        filtered: List<ThirdPartyPlaylistCandidate>,
        importedKeys: Set<String>,
        currentSelected: Set<String>,
    ): Set<String> {
        val next = LinkedHashSet(currentSelected)
        for (item in filtered) {
            val key = item.key()
            if (key in importedKeys) continue
            if (!next.add(key)) {
                next.remove(key)
            }
        }
        return next
    }

    fun retainValidSelection(
        allCandidates: List<ThirdPartyPlaylistCandidate>,
        importedKeys: Set<String>,
        currentSelected: Set<String>,
    ): Set<String> {
        if (currentSelected.isEmpty()) return emptySet()
        val importableKeys = HashSet<String>()
        for (item in allCandidates) {
            val key = item.key()
            if (key !in importedKeys) {
                importableKeys.add(key)
            }
        }
        return currentSelected.filterTo(LinkedHashSet()) { it in importableKeys }
    }

    fun resolveSelectedCandidates(
        allCandidates: List<ThirdPartyPlaylistCandidate>,
        importedKeys: Set<String>,
        selectedKeys: Set<String>,
    ): List<ThirdPartyPlaylistCandidate> {
        if (selectedKeys.isEmpty()) return emptyList()
        return allCandidates.filter { item ->
            val key = item.key()
            key in selectedKeys && key !in importedKeys
        }
    }

    fun buildRows(
        filtered: List<ThirdPartyPlaylistCandidate>,
        importedKeys: Set<String>,
        selectedKeys: Set<String>,
    ): List<ThirdPartyPlaylistCandidateRow> =
        filtered.map { item ->
            val key = item.key()
            val imported = key in importedKeys
            ThirdPartyPlaylistCandidateRow(
                candidate = item,
                imported = imported,
                selected = !imported && key in selectedKeys,
            )
        }
}
