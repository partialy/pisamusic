package cn.partialy.pm.download.task

import cn.partialy.pm.model.SongType

enum class DownloadTaskStatus {
    QUEUED,
    PREPARING,
    DOWNLOADING,
    PROCESSING,
    COMPLETED,
    FAILED,
    CANCELLED,
    ;

    val isActive: Boolean
        get() = this == QUEUED || this == PREPARING || this == DOWNLOADING || this == PROCESSING
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
)

data class DownloadTaskRemovalResult(
    val removedCount: Int,
    val failedPaths: List<String>,
)
