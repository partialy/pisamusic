package cn.partialy.pm.directmessage

import kotlinx.serialization.Serializable

@Serializable
data class DirectMessageItem(
    val id: String,
    val targetKind: String,
    val content: String,
    val createdAt: Long,
)

data class DirectMessageIdentitySnapshot(
    val authorization: String?,
    val deviceToken: String?,
    val accountId: String?,
)

data class DirectMessageUnreadPage(
    val items: List<DirectMessageItem> = emptyList(),
    val hasMore: Boolean = false,
)

data class DirectMessageUnreadResponse(
    val msg: String = "",
    val code: Int = 0,
    val success: Boolean = true,
    val data: DirectMessageUnreadPage? = null,
)

data class DirectMessageReadReceipt(
    val id: String = "",
    val readAt: Long = 0L,
)

data class DirectMessageReadResponse(
    val msg: String = "",
    val code: Int = 0,
    val success: Boolean = true,
    val data: DirectMessageReadReceipt? = null,
)

class DirectMessageApiException(
    val apiCode: Int,
    override val message: String,
) : RuntimeException(message)
