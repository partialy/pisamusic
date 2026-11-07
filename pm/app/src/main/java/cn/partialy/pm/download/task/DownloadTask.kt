package cn.partialy.pm.download.task

import cn.partialy.pm.model.SongType

enum class DownloadTaskStatus {
    QUEUED,
    PREPARING,
    DOWNLOADING,
    PAUSING,
    PAUSED,
    PROCESSING,
    COMPLETED,
    FAILED,
    CANCELLED,
    ;

    val isActive: Boolean
        get() = !isTerminal
    val isTerminal get() = this in setOf(COMPLETED, FAILED, CANCELLED)
    val canPause get() = this in setOf(QUEUED, PREPARING, DOWNLOADING)
    val canResume get() = this == PAUSED
    val ownsWorker get() = this in setOf(PREPARING, DOWNLOADING, PAUSING, PROCESSING)
    val hasUnfinishedIntent get() = !isTerminal
}

data class DownloadTask(
    val id: String,
    val songId: String,
    val source: SongType,
    val title: String,
    val artist: String,
    val album: String?,
    val coverUrl: String,
    val qualityKey: String,
    val fileName: String?,
    val targetPath: String?,
    val sidecarPaths: List<String>,
    val status: DownloadTaskStatus,
    val progress: Int,
    val downloadedBytes: Long,
    val totalBytes: Long,
    val errorMessage: String?,
    val createdAt: Long,
    val updatedAt: Long,
    val completedAt: Long?,
    val metadataStatus: cn.partialy.pm.download.MetadataWriteStatus = cn.partialy.pm.download.MetadataWriteStatus.UNKNOWN,
    val metadataWarning: String? = null,
    val attemptGeneration: Long = 0,
    val resumeEtag: String? = null,
    val resumeLastModified: String? = null,
    val resumeTotalBytes: Long? = null,
    val resumeQualityKey: String? = null,
    val resumeResourceIdentity: String? = null,
    val resumeFileModified: Long? = null,
    val pauseReason: String? = null,
)

data class DownloadTaskRemovalResult(
    val removedCount: Int,
    val failedPaths: List<String>,
    val deletedFileCount: Int = 0,
    val sharedFileCount: Int = 0,
    val skippedInUseCount: Int = 0,
    val failedCount: Int = 0,
)
