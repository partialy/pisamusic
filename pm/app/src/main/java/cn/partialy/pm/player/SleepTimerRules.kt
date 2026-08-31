package cn.partialy.pm.player

import kotlin.math.ceil

object SleepTimerRules {
    const val MIN_MINUTES = 1
    const val MAX_MINUTES = 23 * 60 + 59
    const val PRESET_SLOT_COUNT = 4
    val DEFAULT_PRESETS_MINUTES = listOf(5, 15, 30, 60)

    fun clampMinutes(minutes: Int): Int = minutes.coerceIn(MIN_MINUTES, MAX_MINUTES)

    fun toMinutes(hours: Int, minutes: Int): Int {
        val safeHours = hours.coerceIn(0, 23)
        val safeMinutes = minutes.coerceIn(0, 59)
        return clampMinutes(safeHours * 60 + safeMinutes)
    }

    fun splitMinutes(totalMinutes: Int): Pair<Int, Int> {
        val safeTotal = clampMinutes(totalMinutes)
        return safeTotal / 60 to safeTotal % 60
    }

    fun normalizePresets(values: List<Int>): List<Int> =
        List(PRESET_SLOT_COUNT) { index ->
            values.getOrNull(index)
                ?.takeIf { it in MIN_MINUTES..MAX_MINUTES }
                ?: DEFAULT_PRESETS_MINUTES[index]
        }

    fun remainingSeconds(targetEpochMs: Long, nowEpochMs: Long): Long {
        val remainingMs = targetEpochMs - nowEpochMs
        if (remainingMs <= 0L) return 0L
        return ceil(remainingMs / 1000.0).toLong()
    }

    fun formatRemaining(remainingSeconds: Long): String {
        val safeSeconds = remainingSeconds.coerceAtLeast(0L)
        val hours = safeSeconds / 3600
        val minutes = (safeSeconds % 3600) / 60
        val seconds = safeSeconds % 60
        return if (hours > 0) {
            "%02d:%02d:%02d".format(hours, minutes, seconds)
        } else {
            "%02d:%02d".format(minutes, seconds)
        }
    }
}
