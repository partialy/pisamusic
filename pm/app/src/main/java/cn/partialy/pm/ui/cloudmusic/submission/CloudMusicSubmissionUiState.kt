package cn.partialy.pm.ui.cloudmusic.submission

import cn.partialy.pm.network.cloudmusic.CloudMusicSubmissionFile
import cn.partialy.pm.network.cloudmusic.CloudMusicTrackDto
import cn.partialy.pm.network.cloudmusic.CloudMusicUploadPhase

enum class CloudMusicSubmissionSection {
    SUBMIT,
    HISTORY,
}

enum class CloudMusicSubmissionEditorMode {
    NEW_SUBMISSION,
    RESUBMISSION,
}

enum class CloudMusicSubmissionStage {
    SELECT_FILES,
    UPLOADING,
    EDIT_METADATA,
    SUCCESS,
}

data class CloudMusicSubmissionUiState(
    val loggedIn: Boolean = false,
    val section: CloudMusicSubmissionSection = CloudMusicSubmissionSection.SUBMIT,
    val stage: CloudMusicSubmissionStage = CloudMusicSubmissionStage.SELECT_FILES,
    val editorMode: CloudMusicSubmissionEditorMode = CloudMusicSubmissionEditorMode.NEW_SUBMISSION,
    val audio: CloudMusicSubmissionFile? = null,
    val cover: CloudMusicSubmissionFile? = null,
    val lyrics: CloudMusicSubmissionFile? = null,
    val audioResolving: Boolean = false,
    val coverResolving: Boolean = false,
    val lyricsResolving: Boolean = false,
    val editingTrack: CloudMusicTrackDto? = null,
    val editorRevision: Long = 0L,
    val uploadPhase: CloudMusicUploadPhase? = null,
    val uploadPercent: Int = 0,
    val historyItems: List<CloudMusicTrackDto> = emptyList(),
    val historyTotal: Int = 0,
    val historyLoading: Boolean = false,
    val historyLoadingMore: Boolean = false,
    val historyError: String? = null,
    val historyRefreshError: String? = null,
    val historyLoadMoreError: String? = null,
    val historyNextOffset: Int = 0,
    val historyHasMore: Boolean = false,
    val operationInProgress: Boolean = false,
)

sealed interface CloudMusicSubmissionEvent {
    data object SubmissionChanged : CloudMusicSubmissionEvent

    data object CloseRequested : CloudMusicSubmissionEvent

    data class ShowMessage(val message: String) : CloudMusicSubmissionEvent
}
