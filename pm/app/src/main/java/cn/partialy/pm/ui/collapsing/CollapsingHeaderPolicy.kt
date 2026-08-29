package cn.partialy.pm.ui.collapsing

internal data class CollapsingHeaderLayoutMetrics(
    val overlayHeightPx: Int,
    val contentPaddingTopPx: Int,
    val collapsingMinimumHeightPx: Int,
)

internal data class CollapsingHeaderChromeState(
    val progress: Float,
    val useSurfaceIcons: Boolean,
    val showTitle: Boolean,
)

/** 统一管理推拉门页面的 Header 尺寸和折叠态视觉阈值。 */
internal object CollapsingHeaderPolicy {

    fun resolveLayout(
        baseHeaderHeightPx: Int,
        statusBarTopPx: Int,
    ): CollapsingHeaderLayoutMetrics {
        require(baseHeaderHeightPx > 0) { "baseHeaderHeightPx must be positive" }
        require(statusBarTopPx >= 0) { "statusBarTopPx must not be negative" }

        val totalHeaderHeightPx = baseHeaderHeightPx + statusBarTopPx
        return CollapsingHeaderLayoutMetrics(
            overlayHeightPx = totalHeaderHeightPx,
            contentPaddingTopPx = statusBarTopPx,
            collapsingMinimumHeightPx = totalHeaderHeightPx,
        )
    }

    fun resolveChrome(
        verticalOffset: Int,
        triggerPx: Int,
    ): CollapsingHeaderChromeState {
        require(triggerPx > 0) { "triggerPx must be positive" }

        val progress = (-verticalOffset.toFloat() / triggerPx).coerceIn(0f, 1f)
        return CollapsingHeaderChromeState(
            progress = progress,
            useSurfaceIcons = progress >= ICON_SURFACE_THRESHOLD,
            showTitle = progress >= TITLE_VISIBLE_THRESHOLD,
        )
    }

    private const val ICON_SURFACE_THRESHOLD = 0.5f
    private const val TITLE_VISIBLE_THRESHOLD = 0.9f
}
