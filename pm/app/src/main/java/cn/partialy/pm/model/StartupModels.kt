package cn.partialy.pm.model

import cn.partialy.pm.directmessage.DirectMessageUnreadPage

data class AndroidStartupRequest(
    val device: DeviceReportRequest,
    val agreementVersion: Long? = null,
    val unreadMessageLimit: Int = 20,
)

data class AndroidStartupResponse(
    val msg: String = "",
    val code: Int = 0,
    val success: Boolean = true,
    val data: AndroidStartupData,
)

data class StartupAgreementPayload(
    val version: Long = 1L,
    val acceptedUpToDate: Boolean = false,
    val title: String = "",
    val content: String = "",
)

data class StartupAccountPayload(
    val status: String = "none",
    val session: AccountAuthResult? = null,
)

data class AndroidStartupData(
    val bootstrap: BootstrapConfigData,
    val update: UpdateInfo,
    val agreement: StartupAgreementPayload,
    val device: DeviceReportResult,
    val announcements: List<AnnouncementItem> = emptyList(),
    val account: StartupAccountPayload = StartupAccountPayload(),
    val unreadMessages: DirectMessageUnreadPage = DirectMessageUnreadPage(),
)
