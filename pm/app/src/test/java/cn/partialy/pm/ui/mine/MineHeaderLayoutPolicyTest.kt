package cn.partialy.pm.ui.mine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class MineHeaderLayoutPolicyTest {

    @Test
    fun `状态栏高度同时计入固定 Header 和折叠最小高度`() {
        val result = MineHeaderLayoutPolicy.resolve(
            baseHeaderHeightPx = 144,
            statusBarTopPx = 72,
        )

        assertEquals(216, result.overlayHeightPx)
        assertEquals(72, result.contentPaddingTopPx)
        assertEquals(216, result.collapsingMinimumHeightPx)
    }

    @Test
    fun `无状态栏 inset 时仍保留基础 Header 高度`() {
        val result = MineHeaderLayoutPolicy.resolve(
            baseHeaderHeightPx = 144,
            statusBarTopPx = 0,
        )

        assertEquals(144, result.overlayHeightPx)
        assertEquals(0, result.contentPaddingTopPx)
        assertEquals(144, result.collapsingMinimumHeightPx)
    }

    @Test
    fun `拒绝非法高度避免折叠区退化为零`() {
        assertThrows(IllegalArgumentException::class.java) {
            MineHeaderLayoutPolicy.resolve(baseHeaderHeightPx = 0, statusBarTopPx = 72)
        }
        assertThrows(IllegalArgumentException::class.java) {
            MineHeaderLayoutPolicy.resolve(baseHeaderHeightPx = 144, statusBarTopPx = -1)
        }
    }
}
