package cn.partialy.pm.listening

data class ListeningTrack(
    val source: String,
    val songId: String,
    val title: String,
    val artist: String,
    val album: String?,
    val trackDurationMs: Long?,
)

data class ListeningFragment(
    val eventId: String,
    val playSessionId: String,
    val source: String,
    val songId: String,
    val title: String,
    val artist: String,
    val album: String?,
    val trackDurationMs: Long?,
    val startedAtMs: Long,
    val endedAtMs: Long,
    val activeDurationMs: Long,
    val terminalReason: String?,
)

data class ListeningBatchRequest(
    val schemaVersion: Int = 1,
    val platform: String = "android",
    val fragments: List<ListeningFragment>,
)

data class ListeningLevel(
    val level: Int,
    val minMinutes: Long,
    val maxMinutes: Long?,
)

data class ListeningSummary(
    val totalMs: Long,
    val totalMinutes: Long,
    val level: ListeningLevel,
)

data class ListeningBatchResult(
    val accepted: List<String> = emptyList(),
    val duplicate: List<String> = emptyList(),
    val rejected: List<ListeningRejected> = emptyList(),
    val summary: ListeningSummary?,
    val serverTimeMs: Long?,
)

data class ListeningBatchResponse(
    val msg: String = "",
    val code: Int = 0,
    val success: Boolean = true,
    val data: ListeningBatchResult,
)

data class ListeningRejected(
    val eventId: String,
    val reason: String,
)

data class ListeningSummaryResponse(
    val msg: String = "",
    val code: Int = 0,
    val success: Boolean = true,
    val data: ListeningSummary,
)

data class ListeningCheckpoint(
    val accountId: String,
    val deviceId: String,
    val playSessionId: String,
    val track: ListeningTrack,
    val startedAtMs: Long,
    val lastCheckpointAtMs: Long,
    val lastMonotonicMs: Long,
    val activeElapsedMs: Long,
)

data class PendingListeningFragment(
    val eventId: String,
    val accountId: String,
    val deviceId: String,
    val fragment: ListeningFragment,
)

fun ListeningSummary?.orEmpty(): ListeningSummary = this ?: ListeningSummary(
    totalMs = 0,
    totalMinutes = 0,
    level = ListeningLevel(level = 1, minMinutes = 0, maxMinutes = null),
)

fun formatListeningDuration(totalMinutes: Long): String {
    if (totalMinutes < 1000) return "${totalMinutes.coerceAtLeast(0)} 分钟"
    val hours = totalMinutes / 60.0
    val text = "%.1f".format(java.util.Locale.CHINA, hours).removeSuffix(".0")
    return "$text 小时"
}
