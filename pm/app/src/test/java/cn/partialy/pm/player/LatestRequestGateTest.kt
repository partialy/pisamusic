package cn.partialy.pm.player

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LatestRequestGateTest {
    @Test
    fun onlyNewestRequestCanApply() {
        val gate = LatestRequestGate()
        val requestB = gate.next()
        val requestC = gate.next()

        assertFalse(gate.isLatest(requestB))
        assertTrue(gate.isLatest(requestC))
    }

    @Test
    fun repeatedTransitionsAlwaysInvalidatePreviousToken() {
        val gate = LatestRequestGate()
        var previous = gate.next()

        repeat(20) {
            val current = gate.next()
            assertFalse(gate.isLatest(previous))
            assertTrue(gate.isLatest(current))
            previous = current
        }
    }
}
