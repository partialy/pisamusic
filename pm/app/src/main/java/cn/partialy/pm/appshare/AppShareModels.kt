package cn.partialy.pm.appshare

data class AppShareResponse(
    val success: Boolean = false,
    val code: Int = -1,
    val msg: String = "",
    val data: AppShareConfig? = null,
)

data class AppShareConfig(
    val appName: String = "",
    val version: String = "",
    val iconUrl: String = "",
    val description: String = "",
    val qrCodeText: String = "",
    val copyText: String = "",
    val updatedAt: Long = 0,
    val shareCode: String? = null,
    val trackingEnabled: Boolean = false,
)
