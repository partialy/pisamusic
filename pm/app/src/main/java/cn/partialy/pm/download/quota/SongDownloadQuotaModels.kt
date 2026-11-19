package cn.partialy.pm.download.quota

data class SongDownloadItemDto(
    val source: String,
    val songId: String,
    val name: String,
    val singer: String,
    val album: String,
    val cover: String,
    val durationMs: Long?,
    val qualityKey: String,
)

data class SongDownloadAcquireRequest(
    val clientBatchId: String,
    val platform: String = "android",
    val items: List<SongDownloadItemDto>,
)

data class SongDownloadQuotaDimension(
    val limit: Long? = null,
    val used: Long = 0L,
    val remaining: Long? = null,
)

data class SongDownloadQuotaSnapshot(
    val subjectType: String = "device",
    val subjectKey: String = "",
    val overrideEnabled: Boolean = false,
    val daily: SongDownloadQuotaDimension = SongDownloadQuotaDimension(),
    val weekly: SongDownloadQuotaDimension = SongDownloadQuotaDimension(),
    val monthly: SongDownloadQuotaDimension = SongDownloadQuotaDimension(),
    val total: SongDownloadQuotaDimension = SongDownloadQuotaDimension(),
)

data class SongDownloadAcquireData(
    val allowed: Boolean = false,
    val deduplicated: Boolean = false,
    val batchId: String? = null,
    val chargedCount: Int = 0,
    val requiredCount: Int = 0,
    val quota: SongDownloadQuotaSnapshot = SongDownloadQuotaSnapshot(),
)

data class SongDownloadAcquireResponse(
    val msg: String = "",
    val code: Int = -1,
    val data: SongDownloadAcquireData? = null,
    val success: Boolean = false,
)
