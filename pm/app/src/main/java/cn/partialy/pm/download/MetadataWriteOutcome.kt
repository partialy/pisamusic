package cn.partialy.pm.download

enum class MetadataWriteStatus {
    UNKNOWN, PENDING, SUCCESS, PARTIAL, FAILED, SKIPPED, INTERRUPTED,
}

data class MetadataWriteResult(
    val status: MetadataWriteStatus = MetadataWriteStatus.UNKNOWN,
    val warning: String? = null,
) {
    companion object {
        fun fromRaw(status: String?, warning: String?): MetadataWriteResult {
            val kind = runCatching { MetadataWriteStatus.valueOf(status.orEmpty()) }
                .getOrDefault(MetadataWriteStatus.UNKNOWN)
            return MetadataWriteResult(kind, warning?.take(500))
        }
    }
}
