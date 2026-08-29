package cn.partialy.pm.ui.mine

import cn.partialy.pm.ui.collapsing.CollapsingHeaderPolicy

internal data class MineHeaderLayoutMetrics(
    val overlayHeightPx: Int,
    val contentPaddingTopPx: Int,
    val collapsingMinimumHeightPx: Int,
)

internal object MineHeaderLayoutPolicy {

    fun resolve(
        baseHeaderHeightPx: Int,
        statusBarTopPx: Int,
    ): MineHeaderLayoutMetrics {
        val metrics = CollapsingHeaderPolicy.resolveLayout(
            baseHeaderHeightPx = baseHeaderHeightPx,
            statusBarTopPx = statusBarTopPx,
        )
        return MineHeaderLayoutMetrics(
            overlayHeightPx = metrics.overlayHeightPx,
            contentPaddingTopPx = metrics.contentPaddingTopPx,
            collapsingMinimumHeightPx = metrics.collapsingMinimumHeightPx,
        )
    }
}
