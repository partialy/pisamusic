package cn.partialy.pm.fault

import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackTraceRegistry @Inject constructor() {
    private data class Entry(val trace: PlaybackRequestTrace, val savedAt: Long)
    private val traces = ConcurrentHashMap<String, Entry>()

    fun put(trace: PlaybackRequestTrace) {
        val now = System.currentTimeMillis()
        traces.entries.removeIf { now - it.value.savedAt > TRACE_TTL_MS }
        traces[trace.traceId] = Entry(trace, now)
    }

    fun take(traceId: String): PlaybackRequestTrace? = traces.remove(traceId)?.trace

    companion object {
        private const val TRACE_TTL_MS = 60_000L
    }
}
