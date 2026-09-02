package cn.partialy.pm.player.diagnostic

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.PowerManager
import android.os.SystemClock
import cn.partialy.pm.utils.SettingsPrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlaybackDiagnosticRecorder @Inject constructor(
    @ApplicationContext private val context: Context,
    private val store: PlaybackDiagnosticStore,
) {
    private val sessionId = UUID.randomUUID().toString()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val queue = Channel<PlaybackDiagnosticEvent>(capacity = 256)
    private val droppedEvents = AtomicInteger(0)
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    init {
        scope.launch {
            for (event in queue) {
                val dropped = droppedEvents.getAndSet(0)
                runCatching { store.insert(enrich(event, dropped)) }
            }
        }
    }

    fun record(event: PlaybackDiagnosticEvent) {
        if (queue.trySend(event).isFailure) {
            droppedEvents.incrementAndGet()
        }
    }

    private fun enrich(event: PlaybackDiagnosticEvent, dropped: Int): PlaybackDiagnosticRow {
        val safeDetails = LinkedHashMap(event.details)
        if (dropped > 0) {
            safeDetails["dropped_since_last"] = dropped.toString()
        }
        val outputDevices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
            .map { audioDeviceTypeName(it.type) }
            .distinct()
            .sorted()

        val safeEvent = event.copy(
            action = event.action.take(MAX_ACTION_LENGTH),
            reason = event.reason.take(MAX_REASON_LENGTH),
            controllerPackage = event.controllerPackage.take(MAX_CONTROLLER_PACKAGE_LENGTH),
            snapshot = event.snapshot.copy(
                songSource = event.snapshot.songSource.take(MAX_SONG_SOURCE_LENGTH),
                songId = event.snapshot.songId.take(MAX_SONG_ID_LENGTH),
            ),
            details = emptyMap(),
        )
        return PlaybackDiagnosticRow(
            id = UUID.randomUUID().toString(),
            sessionId = sessionId,
            occurredAt = System.currentTimeMillis(),
            elapsedRealtime = SystemClock.elapsedRealtime(),
            event = safeEvent,
            coexistenceMode = SettingsPrefs.getAudioCoexistenceMode(context).name.lowercase(),
            screenInteractive = powerManager.isInteractive,
            outputDeviceTypesJson = JSONArray(outputDevices).toString(),
            detailsJson = encodeDetails(safeDetails),
        )
    }

    private fun encodeDetails(details: Map<String, String>): String {
        val json = JSONObject()
        for ((rawKey, rawValue) in details.entries.take(MAX_DETAIL_ENTRIES)) {
            val key = rawKey.take(MAX_DETAIL_KEY_LENGTH)
            json.put(key, rawValue.take(MAX_DETAIL_VALUE_LENGTH))
            if (json.toString().length > MAX_DETAILS_JSON_LENGTH) {
                json.remove(key)
                break
            }
        }
        return json.toString()
    }

    private fun audioDeviceTypeName(type: Int): String = when (type) {
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "bluetooth_a2dp"
        AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "bluetooth_sco"
        AudioDeviceInfo.TYPE_BLE_HEADSET -> "ble_headset"
        AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "wired_headphones"
        AudioDeviceInfo.TYPE_WIRED_HEADSET -> "wired_headset"
        AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "builtin_speaker"
        AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "builtin_earpiece"
        else -> "unknown_$type"
    }

    private companion object {
        const val MAX_ACTION_LENGTH = 128
        const val MAX_REASON_LENGTH = 128
        const val MAX_CONTROLLER_PACKAGE_LENGTH = 128
        const val MAX_SONG_SOURCE_LENGTH = 32
        const val MAX_SONG_ID_LENGTH = 256
        const val MAX_DETAIL_ENTRIES = 32
        const val MAX_DETAIL_KEY_LENGTH = 64
        const val MAX_DETAIL_VALUE_LENGTH = 256
        const val MAX_DETAILS_JSON_LENGTH = 2_048
    }
}
