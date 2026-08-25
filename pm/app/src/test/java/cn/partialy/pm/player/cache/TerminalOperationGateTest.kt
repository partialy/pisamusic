package cn.partialy.pm.player.cache

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

class TerminalOperationGateTest {

    @Test
    fun `shutdown waits for active operation and rejects late operation`() {
        val gate = TerminalOperationGate("closed")
        val operationEntered = CountDownLatch(1)
        val allowOperationToFinish = CountDownLatch(1)
        val shutdownAttempted = CountDownLatch(1)
        val cleanupCount = AtomicInteger()
        val executor = Executors.newFixedThreadPool(2)

        try {
            val operation = executor.submit {
                gate.runOpen {
                    operationEntered.countDown()
                    allowOperationToFinish.await()
                }
            }
            assertTrue(operationEntered.await(1, TimeUnit.SECONDS))

            val shutdown = executor.submit {
                shutdownAttempted.countDown()
                gate.shutdown { cleanupCount.incrementAndGet() }
            }
            assertTrue(shutdownAttempted.await(1, TimeUnit.SECONDS))
            assertFalse(shutdown.isDone)

            allowOperationToFinish.countDown()
            operation.get(1, TimeUnit.SECONDS)
            shutdown.get(1, TimeUnit.SECONDS)

            gate.shutdown { cleanupCount.incrementAndGet() }
            assertEquals(1, cleanupCount.get())
            assertThrows(IllegalStateException::class.java) {
                gate.runOpen { Unit }
            }
        } finally {
            allowOperationToFinish.countDown()
            executor.shutdownNow()
        }
    }
}
