package cn.partialy.pm.model

data class DeviceReportRequest(
    val deviceName: String,
    val brand: String,
    val model: String,
    val osVersion: String,
    val sdkVersion: Int,
    val appVersion: String,
    val appVersionCode: Long,
    val androidId: String,
    val certModel: String? = null,
    val countryCode: String? = null,
    val timezone: String? = null,
    val locale: String? = null,
    val extras: Map<String, @JvmSuppressWildcards Any?>? = null,
)

data class DeviceReportResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: DeviceReportResult,
)

data class DeviceReportResult(
    val id: String,
    val locked: Boolean,
    val lockEndTime: Long? = null,
    val lastActiveAt: Long,
    val firstSeenAt: Long,
)

data class DeviceLookupResponse(
    val msg: String,
    val code: Int,
    val success: Boolean = true,
    val data: DeviceLookupResult,
)

data class DeviceLookupResult(
    val id: String,
    val locked: Boolean,
    val lockEndTime: Long? = null,
    val lastActiveAt: Long,
    val firstSeenAt: Long,
    val brand: String,
    val model: String,
    val appVersion: String,
)
