package cn.partialy.pm.ui.mine

import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.network.cookie.ThirdPartyPlaylistCandidate
import org.junit.Assert.assertEquals
import org.junit.Test

class ThirdPartyPlaylistImportRulesTest {

    private val kg1 = ThirdPartyPlaylistCandidate("kg", "collection_1", "酷狗跑步歌单", "节奏感强", songCount = 20)
    private val kg2 = ThirdPartyPlaylistCandidate("kg", "collection_2", "夜听纯音乐", "助眠轻音乐", songCount = 15)
    private val wy1 = ThirdPartyPlaylistCandidate("wy", "1001", "网易云华语精选", "经典老歌", songCount = 50)
    private val wy2 = ThirdPartyPlaylistCandidate("wy", "1002", "独立民谣", "民谣吉他", songCount = 12)
    private val all = listOf(kg1, kg2, wy1, wy2)

    @Test
    fun `规范家族归一化识别已导入歌单`() {
        val collected = listOf(
            CollectedPlaylist(CollectedPlaylistType.IMPORT_KG, "collection_1", "酷狗跑步歌单"),
            CollectedPlaylist(CollectedPlaylistType.WY, "1002", "独立民谣"),
            CollectedPlaylist(CollectedPlaylistType.LOCAL, "local-1", "本地歌单"),
        )
        val keys = ThirdPartyPlaylistImportRules.collectedKeySet(collected)
        assertEquals(setOf("kg:collection_1", "wy:1002"), keys)
    }

    @Test
    fun `来源筛选与关键词搜索组合过滤`() {
        val kgOnly = ThirdPartyPlaylistImportRules.filterCandidates(all, ThirdPartySourceFilter.KG, "")
        assertEquals(listOf(kg1, kg2), kgOnly)

        val byIntro = ThirdPartyPlaylistImportRules.filterCandidates(all, ThirdPartySourceFilter.WY, "经典")
        assertEquals(listOf(wy1), byIntro)
    }

    @Test
    fun `全选与反选跳过已导入项并保留筛选外选择`() {
        val imported = setOf("kg:collection_1")
        val initialSelected = setOf("wy:1002")

        // 只在 KG 筛选下全选，应新增 kg2 且保留已选 wy2，跳过已导入 kg1
        val afterSelectAllKg = ThirdPartyPlaylistImportRules.selectAllImportable(
            filtered = listOf(kg1, kg2),
            importedKeys = imported,
            currentSelected = initialSelected,
        )
        assertEquals(setOf("wy:1002", "kg:collection_2"), afterSelectAllKg)

        // 再在 KG 筛选下反选，应移除 kg2 且仍保留筛选外 wy2，跳过 kg1
        val afterInvertKg = ThirdPartyPlaylistImportRules.invertImportable(
            filtered = listOf(kg1, kg2),
            importedKeys = imported,
            currentSelected = afterSelectAllKg,
        )
        assertEquals(setOf("wy:1002"), afterInvertKg)
    }

    @Test
    fun `已导入歌单变更后自动清理无效勾选并保持候选顺序解析`() {
        val imported = setOf("kg:collection_1", "wy:1001")
        val rawSelected = setOf("wy:1002", "wy:1001", "kg:collection_2", "kg:9999")
        val retained = ThirdPartyPlaylistImportRules.retainValidSelection(all, imported, rawSelected)
        assertEquals(setOf("wy:1002", "kg:collection_2"), retained)

        val resolved = ThirdPartyPlaylistImportRules.resolveSelectedCandidates(all, imported, retained)
        assertEquals(listOf(kg2, wy2), resolved)
    }
}
