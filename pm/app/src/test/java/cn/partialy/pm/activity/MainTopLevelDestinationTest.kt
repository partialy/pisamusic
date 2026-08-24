package cn.partialy.pm.activity

import org.junit.Assert.assertEquals
import org.junit.Test

class MainTopLevelDestinationTest {

    @Test
    fun `首次启动或无效状态默认恢复首页`() {
        assertEquals(MainTopLevelDestination.HOME, MainTopLevelDestination.restore(null))
        assertEquals(MainTopLevelDestination.HOME, MainTopLevelDestination.restore("unknown"))
    }

    @Test
    fun `保存值恢复对应顶层页面`() {
        MainTopLevelDestination.values().forEach { destination ->
            assertEquals(destination, MainTopLevelDestination.restore(destination.savedValue))
        }
    }
}
