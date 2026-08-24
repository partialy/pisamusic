package cn.partialy.pm.ui.mine

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
        require(baseHeaderHeightPx > 0) { "baseHeaderHeightPx must be positive" }
        require(statusBarTopPx >= 0) { "statusBarTopPx must not be negative" }

        val totalHeaderHeightPx = baseHeaderHeightPx + statusBarTopPx
        return MineHeaderLayoutMetrics(
            overlayHeightPx = totalHeaderHeightPx,
            contentPaddingTopPx = statusBarTopPx,
            collapsingMinimumHeightPx = totalHeaderHeightPx,
        )
    }
}
