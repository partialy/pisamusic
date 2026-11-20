package cn.partialy.pm.model

data class SyncChangesResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: SyncChangesResult,
)

data class SyncChangesResult(
    val version: Long,
    val changes: List<SyncChange> = emptyList(),
    val mode: String = "delta",
    val items: List<SyncChange>? = null,
    val snapshotVersion: Long? = null,
    val cursor: String? = null,
    val hasMore: Boolean = false,
    val serverTime: Long? = null,
    val logFloor: Long? = null,
)

data class SyncPushRequest(
    val changes: List<SyncChangeInput>,
)

data class SyncPushResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: SyncPushResult,
)

data class SyncAppliedItem(
    val opId: String = "",
    val itemType: String = "",
    val itemKey: String = "",
    val version: Long = 0L,
    val noop: Boolean = false,
)

data class SyncRejectedItem(
    val opId: String = "",
    val itemType: String = "",
    val itemKey: String = "",
    val reason: String = "",
    val serverVersion: Long = 0L,
)

data class SyncPushResult(
    val version: Long,
    val accepted: Int,
    val skipped: Int,
    val serverTime: Long? = null,
    val conflicts: Int = 0,
    val appliedItems: List<SyncAppliedItem> = emptyList(),
    val rejectedItems: List<SyncRejectedItem> = emptyList(),
)

data class SyncChangeInput(
    val opId: String,
    val itemType: String,
    val itemKey: String,
    val action: String,
    val payload: Any = emptyMap<String, Any>(),
    val clientUpdatedAt: String = "",
    val baseVersion: Long? = null,
)

data class SyncChange(
    val version: Long,
    val opId: String,
    val deviceId: String,
    val itemType: String,
    val itemKey: String,
    val action: String,
    val payload: Any?,
    val clientUpdatedAt: String = "",
    val serverUpdatedAt: Long,
)
