package cn.partialy.pm.player.cache

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotSame
import org.junit.Assert.assertSame
import org.junit.Test

class ReopenableSingletonResourceTest {

    @Test
    fun `release closes current resource and next access uses latest setting`() {
        var setting = 100
        val closed = mutableListOf<Int>()
        val resource = ReopenableSingletonResource(
            create = { FakeResource(setting) },
            close = { closed += it.limit },
        )

        val first = resource.get()
        assertSame(first, resource.get())

        setting = 200
        resource.release()
        val second = resource.get()

        assertEquals(listOf(100), closed)
        assertNotSame(first, second)
        assertEquals(200, second.limit)
    }

    @Test
    fun `ordinary use does not release active resource`() {
        var closes = 0
        val resource = ReopenableSingletonResource(
            create = { FakeResource(100) },
            close = { closes += 1 },
        )
        val first = resource.use { it }
        val second = resource.get()

        assertSame(first, second)
        assertEquals(0, closes)
    }

    private data class FakeResource(val limit: Int)
}
