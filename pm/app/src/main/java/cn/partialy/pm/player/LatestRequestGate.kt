package cn.partialy.pm.player

import java.util.concurrent.atomic.AtomicLong

internal class LatestRequestGate {
    private val sequence = AtomicLong(0L)

    fun next(): Long = sequence.incrementAndGet()

    fun isLatest(token: Long): Boolean = sequence.get() == token

    fun invalidate() {
        sequence.incrementAndGet()
    }
}
