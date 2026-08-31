package cn.partialy.pm.listening

import android.content.Context
import android.os.SystemClock
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.utils.ServerDevicePrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

@Singleton
class ListeningManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val adapter: Media3ListeningAdapter,
    private val store: ListeningStore,
    private val configManager: ConfigManager,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val mutex = Mutex()
    private val _summary = MutableStateFlow<ListeningSummary?>(null)
    val summary: StateFlow<ListeningSummary?> = _summary.asStateFlow()
    private var active: ActiveSegment? = null
    private var serverOffsetMs = 0L
    private var lastFlushAtMs = System.currentTimeMillis()
    private var startupKey: String? = null
    private val started = AtomicBoolean(false)

    init {
        if (started.compareAndSet(false, true)) {
            scope.launch { adapter.observations.collect { observe(it) } }
            scope.launch {
                while (true) {
                    delay(30_000L)
                    checkpointActiveIfNeeded()
                    maybeFlush(force = false)
                }
            }
        }
    }

    fun onAppStarted() {
        val session = AccountSessionStore.read(context)
        if (!session.loggedIn) return
        val key = "${session.user.id}:${session.token.take(12)}"
        if (startupKey == key) return
        startupKey = key
        scope.launch {
            flushPending(session.user.id, session.token)
            refreshSummary(session.token)
        }
    }

    fun onAccountAvailable() {
        startupKey = null
        onAppStarted()
    }

    fun refreshSummary() {
        val session = AccountSessionStore.read(context)
        if (session.loggedIn) scope.launch { refreshSummary(session.token) }
    }

    private suspend fun refreshSummary(token: String) {
        runCatching { configManager.getListeningSummary(token) }.onSuccess { _summary.value = it }
    }

    private suspend fun observe(observation: PlaybackObservation) = mutex.withLock {
        val session = AccountSessionStore.read(context)
        val accountId = session.user.id.takeIf { session.loggedIn } ?: run {
            active = null
            return
        }
        val deviceId = ServerDevicePrefs.getDeviceId(context).trim()
        val track = observation.track
        val current = active
        if (!observation.isPlaying || track == null || deviceId.isBlank()) {
            if (current != null) {
                appendSegment(current, nowMs(), observation.terminalReason)
                store.deleteCheckpoint(current.accountId, current.deviceId, current.playSessionId)
                active = null
                maybeFlush(force = false)
            }
            return
        }
        if (current == null || current.accountId != accountId || current.deviceId != deviceId || current.track != track) {
            current?.let {
                appendSegment(it, nowMs(), "track_changed")
                store.deleteCheckpoint(it.accountId, it.deviceId, it.playSessionId)
            }
            val recovered = if (current == null) {
                store.latestCheckpoint(accountId, deviceId)?.takeIf { it.track == track }
            } else {
                null
            }
            if (recovered != null && recovered.activeElapsedMs >= MIN_FRAGMENT_MS) {
                store.addPending(
                    PendingListeningFragment(
                        eventId = UUID.randomUUID().toString(), accountId = accountId, deviceId = deviceId,
                        fragment = ListeningFragment(
                            eventId = "", playSessionId = recovered.playSessionId, source = recovered.track.source,
                            songId = recovered.track.songId, title = recovered.track.title, artist = recovered.track.artist,
                            album = recovered.track.album, trackDurationMs = recovered.track.trackDurationMs,
                            startedAtMs = recovered.startedAtMs, endedAtMs = recovered.lastCheckpointAtMs,
                            activeDurationMs = recovered.activeElapsedMs, terminalReason = null,
                        ),
                    ).let { value -> value.copy(fragment = value.fragment.copy(eventId = value.eventId)) },
                )
                store.deleteCheckpoint(recovered.accountId, recovered.deviceId, recovered.playSessionId)
            }
            active = ActiveSegment(accountId, deviceId, recovered?.playSessionId ?: UUID.randomUUID().toString(), track, nowMs(), SystemClock.elapsedRealtime())
            saveCheckpoint(active!!)
            return
        }
        val monotonicNow = SystemClock.elapsedRealtime()
        if (monotonicNow - current.lastCheckpointMonotonic >= CHECKPOINT_MS) {
            appendSegment(current, nowMs(), null)
            active = current.copy(startedAtMs = nowMs(), lastCheckpointMonotonic = monotonicNow)
            saveCheckpoint(active!!)
            maybeFlush(force = false)
        }
    }

    private fun appendSegment(segment: ActiveSegment, endedAtMs: Long, terminalReason: String?) {
        val end = endedAtMs.coerceAtLeast(segment.startedAtMs + 1)
        val activeDuration = (SystemClock.elapsedRealtime() - segment.lastCheckpointMonotonic).coerceAtLeast(0L)
        if (activeDuration < MIN_FRAGMENT_MS) return
        store.addPending(
            PendingListeningFragment(
                eventId = UUID.randomUUID().toString(), accountId = segment.accountId, deviceId = segment.deviceId,
                fragment = ListeningFragment(
                    eventId = "", playSessionId = segment.playSessionId, source = segment.track.source, songId = segment.track.songId,
                    title = segment.track.title, artist = segment.track.artist, album = segment.track.album, trackDurationMs = segment.track.trackDurationMs,
                    startedAtMs = segment.startedAtMs, endedAtMs = end, activeDurationMs = activeDuration,
                    terminalReason = terminalReason,
                ),
            ).let { value -> value.copy(fragment = value.fragment.copy(eventId = value.eventId)) },
        )
    }

    private fun nowMs(): Long = System.currentTimeMillis() + serverOffsetMs

    private suspend fun checkpointActiveIfNeeded() = mutex.withLock {
        val current = active ?: return
        if (SystemClock.elapsedRealtime() - current.lastCheckpointMonotonic < CHECKPOINT_MS) return
        appendSegment(current, nowMs(), null)
        active = current.copy(startedAtMs = nowMs(), lastCheckpointMonotonic = SystemClock.elapsedRealtime())
        saveCheckpoint(active!!)
    }

    private fun saveCheckpoint(segment: ActiveSegment) {
        store.saveCheckpoint(
            ListeningCheckpoint(
                accountId = segment.accountId, deviceId = segment.deviceId, playSessionId = segment.playSessionId,
                track = segment.track, startedAtMs = segment.startedAtMs, lastCheckpointAtMs = nowMs(),
                lastMonotonicMs = segment.lastCheckpointMonotonic, activeElapsedMs = (SystemClock.elapsedRealtime() - segment.lastCheckpointMonotonic).coerceAtLeast(0L),
            ),
        )
    }

    private fun maybeFlush(force: Boolean) {
        val session = AccountSessionStore.read(context)
        if (!session.loggedIn) return
        val pending = store.pending(session.user.id, 1)
        if (pending.isEmpty()) return
        val now = System.currentTimeMillis()
        if (!force && now - lastFlushAtMs < FLUSH_INTERVAL_MS) return
        lastFlushAtMs = now
        scope.launch { flushPending(session.user.id, session.token) }
    }

    private suspend fun flushPending(accountId: String, token: String) {
        val deviceId = ServerDevicePrefs.getDeviceId(context).trim()
        if (deviceId.isBlank()) return
        while (true) {
            val pending = store.pending(accountId)
            if (pending.isEmpty()) return
            val result = runCatching {
                configManager.uploadListeningFragments(token, deviceId, ListeningBatchRequest(fragments = pending.map { it.fragment }))
            }.getOrNull() ?: return
            result.serverTimeMs?.let { serverOffsetMs = it - System.currentTimeMillis() }
            store.deletePending(accountId, result.accepted + result.duplicate)
            result.summary?.let { _summary.value = it }
            if (result.accepted.isEmpty() && result.duplicate.isEmpty()) return
        }
    }

    private data class ActiveSegment(
        val accountId: String, val deviceId: String, val playSessionId: String, val track: ListeningTrack,
        val startedAtMs: Long, val lastCheckpointMonotonic: Long,
    )

    private companion object {
        const val CHECKPOINT_MS = 45_000L
        const val MIN_FRAGMENT_MS = 1_000L
        const val FLUSH_INTERVAL_MS = 15 * 60 * 1000L
    }
}
