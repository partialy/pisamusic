package cn.partialy.pm.player

import android.content.Context
import androidx.annotation.OptIn
import androidx.media3.common.util.UnstableApi
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SleepTimerState(
    val enabled: Boolean = false,
    val durationMinutes: Int = 30,
    val targetEpochMs: Long = 0L,
    val remainingSeconds: Long = 0L,
    val waitCurrentSong: Boolean = false,
    val waitingForSongEnd: Boolean = false,
) {
    val active: Boolean
        get() = enabled || waitingForSongEnd
}

@OptIn(UnstableApi::class)
@Singleton
class SleepTimerManager @Inject constructor(
    @ApplicationContext context: Context,
    private val musicController: MusicController,
) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val mutableState = MutableStateFlow(SleepTimerState())
    private val mutablePresets = MutableStateFlow(loadPresets())
    private var countdownJob: Job? = null

    val state: StateFlow<SleepTimerState> = mutableState.asStateFlow()
    val presets: StateFlow<List<Int>> = mutablePresets.asStateFlow()

    init {
        restoreTimer()
        musicController.setSongEndedInterceptor {
            if (!mutableState.value.waitingForSongEnd) {
                false
            } else {
                completeTimerAndPause()
                true
            }
        }
    }

    fun startTimer(minutes: Int, waitCurrentSong: Boolean = false) {
        val safeMinutes = SleepTimerRules.clampMinutes(minutes)
        val targetEpochMs = System.currentTimeMillis() + safeMinutes * MILLIS_PER_MINUTE
        preferences.edit()
            .putInt(KEY_DURATION_MINUTES, safeMinutes)
            .putLong(KEY_TARGET_EPOCH_MS, targetEpochMs)
            .putBoolean(KEY_WAIT_CURRENT_SONG, waitCurrentSong)
            .putBoolean(KEY_WAITING_FOR_SONG_END, false)
            .apply()
        beginCountdown(safeMinutes, targetEpochMs, waitCurrentSong)
    }

    fun setPresets(values: List<Int>) {
        val normalized = SleepTimerRules.normalizePresets(values)
        preferences.edit()
            .putString(KEY_PRESETS, normalized.joinToString(PRESET_SEPARATOR))
            .apply()
        mutablePresets.value = normalized
    }

    fun cancelTimer() {
        countdownJob?.cancel()
        countdownJob = null
        clearPersistedTimer()
        mutableState.value = SleepTimerState()
    }

    private fun restoreTimer() {
        val durationMinutes = preferences.getInt(KEY_DURATION_MINUTES, 30)
        val targetEpochMs = preferences.getLong(KEY_TARGET_EPOCH_MS, 0L)
        val waitCurrentSong = preferences.getBoolean(KEY_WAIT_CURRENT_SONG, false)
        val waitingForSongEnd = preferences.getBoolean(KEY_WAITING_FOR_SONG_END, false)
        if (durationMinutes !in SleepTimerRules.MIN_MINUTES..SleepTimerRules.MAX_MINUTES) {
            clearPersistedTimer()
            return
        }
        if (waitingForSongEnd && waitCurrentSong) {
            mutableState.value = SleepTimerState(
                durationMinutes = durationMinutes,
                targetEpochMs = targetEpochMs,
                waitCurrentSong = true,
                waitingForSongEnd = true,
            )
            return
        }
        if (targetEpochMs <= System.currentTimeMillis()) {
            clearPersistedTimer()
            return
        }
        beginCountdown(durationMinutes, targetEpochMs, waitCurrentSong)
    }

    private fun beginCountdown(
        durationMinutes: Int,
        targetEpochMs: Long,
        waitCurrentSong: Boolean,
    ) {
        countdownJob?.cancel()
        countdownJob = scope.launch {
            while (true) {
                val remainingSeconds = SleepTimerRules.remainingSeconds(
                    targetEpochMs = targetEpochMs,
                    nowEpochMs = System.currentTimeMillis(),
                )
                if (remainingSeconds <= 0L) break
                mutableState.value = SleepTimerState(
                    enabled = true,
                    durationMinutes = durationMinutes,
                    targetEpochMs = targetEpochMs,
                    remainingSeconds = remainingSeconds,
                    waitCurrentSong = waitCurrentSong,
                )
                delay(TICK_INTERVAL_MS)
            }
            countdownJob = null
            if (waitCurrentSong &&
                musicController.isPlaying.value &&
                musicController.currentSong.value != null
            ) {
                preferences.edit()
                    .putBoolean(KEY_WAIT_CURRENT_SONG, true)
                    .putBoolean(KEY_WAITING_FOR_SONG_END, true)
                    .apply()
                mutableState.value = SleepTimerState(
                    durationMinutes = durationMinutes,
                    targetEpochMs = targetEpochMs,
                    waitCurrentSong = true,
                    waitingForSongEnd = true,
                )
            } else {
                completeTimerAndPause()
            }
        }
    }

    private fun completeTimerAndPause() {
        musicController.pauseCurrent()
        clearPersistedTimer()
        mutableState.value = SleepTimerState()
    }

    private fun loadPresets(): List<Int> {
        val storedValues = preferences.getString(KEY_PRESETS, null)
            ?.split(PRESET_SEPARATOR)
            ?.map { it.toIntOrNull() ?: Int.MIN_VALUE }
            .orEmpty()
        return SleepTimerRules.normalizePresets(storedValues)
    }

    private fun clearPersistedTimer() {
        preferences.edit()
            .remove(KEY_DURATION_MINUTES)
            .remove(KEY_TARGET_EPOCH_MS)
            .remove(KEY_WAIT_CURRENT_SONG)
            .remove(KEY_WAITING_FOR_SONG_END)
            .apply()
    }

    private companion object {
        const val PREFERENCES_NAME = "pm_sleep_timer"
        const val KEY_DURATION_MINUTES = "duration_minutes"
        const val KEY_TARGET_EPOCH_MS = "target_epoch_ms"
        const val KEY_WAIT_CURRENT_SONG = "wait_current_song"
        const val KEY_WAITING_FOR_SONG_END = "waiting_for_song_end"
        const val KEY_PRESETS = "preset_minutes"
        const val PRESET_SEPARATOR = ","
        const val MILLIS_PER_MINUTE = 60_000L
        const val TICK_INTERVAL_MS = 1_000L
    }
}
