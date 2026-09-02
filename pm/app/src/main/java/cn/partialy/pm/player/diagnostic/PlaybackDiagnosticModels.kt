package cn.partialy.pm.player.diagnostic

enum class PlaybackDiagnosticEventType {
    CONTROL_REQUEST,
    PLAY_WHEN_READY_CHANGED,
    IS_PLAYING_CHANGED,
    PLAYBACK_STATE_CHANGED,
    SUPPRESSION_CHANGED,
    MEDIA_BUTTON,
    MEDIA_SESSION_COMMAND,
    AUDIO_COEXISTENCE_BLOCKING,
    ASYNC_PLAY_APPLIED,
    ASYNC_PLAY_DROPPED,
}

enum class PlaybackControlSource {
    APP_UI,
    MEDIA_BUTTON,
    MEDIA_SESSION,
    EXTERNAL_DIRECT_PLAYER,
    AUDIO_COEXISTENCE,
    AUDIO_FOCUS,
    AUDIO_BECOMING_NOISY,
    LISTEN_TOGETHER,
    SLEEP_TIMER,
    ASYNC_MEDIA_REFRESH,
    PLAYBACK_FAILURE,
    INTERNAL_TRANSITION,
    UNKNOWN,
}

data class PlaybackPlayerSnapshot(
    val songSource: String = "",
    val songId: String = "",
    val playWhenReady: Boolean = false,
    val isPlaying: Boolean = false,
    val playbackState: Int = 0,
    val suppressionReason: Int = 0,
    val positionMs: Long = 0L,
)

data class PlaybackDiagnosticEvent(
    val eventType: PlaybackDiagnosticEventType,
    val action: String = "",
    val reason: String = "",
    val controlSource: PlaybackControlSource = PlaybackControlSource.UNKNOWN,
    val controllerPackage: String = "",
    val snapshot: PlaybackPlayerSnapshot,
    val details: Map<String, String> = emptyMap(),
)

data class PlaybackDiagnosticRow(
    val id: String,
    val sessionId: String,
    val occurredAt: Long,
    val elapsedRealtime: Long,
    val event: PlaybackDiagnosticEvent,
    val coexistenceMode: String,
    val screenInteractive: Boolean,
    val outputDeviceTypesJson: String,
    val detailsJson: String,
)
