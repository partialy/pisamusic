package cn.partialy.pm.model

data class SyncBindRequest(
    val syncCode: String? = null,
    val deviceName: String,
    val platform: String = "pm",
)

data class SyncBindResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: SyncBindResult,
)

data class SyncBindResult(
    val spaceId: String,
    val deviceId: String,
    val syncCode: String,
    val token: String,
    val version: Long,
)

data class SyncChangesResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: SyncChangesResult,
)

data class SyncChangesResult(
    val version: Long,
    val changes: List<SyncChange>,
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

data class SyncPushResult(
    val version: Long,
    val accepted: Int,
    val skipped: Int,
)

data class SyncUnbindResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: SyncUnbindResult,
)

data class SyncUnbindResult(
    val unbound: Boolean,
)

data class SyncChangeInput(
    val opId: String,
    val itemType: String,
    val itemKey: String,
    val action: String,
    val payload: Any = emptyMap<String, Any>(),
    val clientUpdatedAt: String = "",
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
