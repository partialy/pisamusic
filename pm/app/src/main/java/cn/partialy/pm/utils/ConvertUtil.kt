package cn.partialy.pm.utils

import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.HomeRecommendPlaylist
import cn.partialy.pm.model.KgPlaylistDetailItem
import cn.partialy.pm.model.TopPlaylistSpecialItem
object ConvertUtil {

    private fun normalizeKgPlaylistCoverUrl(url: String): String =
        url.replace("{size}", "240")

    /** 首页 top/playlist 单条 → 收藏结构（id 优先 global_collection_id）。 */
    fun convertKgTopPlaylistItemToCollected(item: TopPlaylistSpecialItem): CollectedPlaylist {
        val coverRaw = item.flexibleCover.ifBlank { item.imgUrl }.ifBlank { item.pic }
        val cover = if (coverRaw.isNotBlank()) normalizeKgPlaylistCoverUrl(coverRaw) else ""
        val countLong = item.playCount.takeIf { it > 0 } ?: item.collectCount
        val count = countLong.coerceIn(0L, Int.MAX_VALUE.toLong()).toInt()
        val title = item.specialName.ifBlank { item.show }
        val id = item.globalCollectionId.ifBlank {
            "pl_${title.hashCode()}_${count}_${coverRaw.hashCode()}"
        }
        return CollectedPlaylist(
            type = CollectedPlaylistType.KG,
            id = id,
            name = title,
            intro = item.intro,
            cover = cover,
            count = count,
        )
    }

    /** 批量：推荐歌单列表 → 收藏结构列表。 */
    fun convertKGPlaylistToCollectList(items: List<TopPlaylistSpecialItem>): List<CollectedPlaylist> =
        items.map { convertKgTopPlaylistItemToCollected(it) }

    /** 歌单详情 /playlist/detail 单条 → 收藏结构。 */
    fun convertKgPlaylistDetailToCollected(item: KgPlaylistDetailItem): CollectedPlaylist {
        val cover = if (item.pic.isNotBlank()) normalizeKgPlaylistCoverUrl(item.pic) else ""
        val title = item.name
        val id = item.globalCollectionId.ifBlank {
            "pl_${title.hashCode()}_${item.count}_${item.pic.hashCode()}"
        }
        return CollectedPlaylist(
            type = CollectedPlaylistType.KG,
            id = id,
            name = title,
            intro = item.intro,
            cover = cover,
            count = item.count.coerceAtLeast(0),
        )
    }

    /** 已映射过的首页卡片模型 → 收藏结构（intro 无则空，count 从播放文案无法可靠解析则 0）。 */
    fun convertHomeRecommendPlaylistToCollected(item: HomeRecommendPlaylist): CollectedPlaylist =
        CollectedPlaylist(
            type = CollectedPlaylistType.KG,
            id = item.id,
            name = item.name,
            intro = "",
            cover = item.coverUrl,
            count = 0,
        )

    /**
     * 网易歌单：待接入 Wy 歌单接口模型后实现映射。
     */
    @Suppress("UNUSED_PARAMETER")
    fun convertWYPlaylistToCollectList(items: List<Any>): List<CollectedPlaylist> = emptyList()
}
