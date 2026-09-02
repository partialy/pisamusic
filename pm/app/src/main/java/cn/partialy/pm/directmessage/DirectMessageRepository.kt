package cn.partialy.pm.directmessage

import android.content.Context
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.utils.ServerDevicePrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DirectMessageRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val systemApiService: SystemApiService,
) {
    fun captureIdentity(): DirectMessageIdentitySnapshot {
        val session = AccountSessionStore.read(context)
        return DirectMessageIdentitySnapshot(
            authorization = session.token.takeIf { session.loggedIn }?.let { "Bearer $it" },
            deviceToken = ServerDevicePrefs.getMessageToken(context).ifBlank { null },
            accountId = session.user.id.takeIf { session.loggedIn },
        )
    }

    suspend fun getUnread(identity: DirectMessageIdentitySnapshot): DirectMessageUnreadPage {
        if (!identity.hasCredentials()) return DirectMessageUnreadPage()
        val response = systemApiService.getUnreadDirectMessages(
            authorization = identity.authorization,
            deviceToken = identity.deviceToken,
        )
        if (!response.success || response.code != 0) {
            throw DirectMessageApiException(response.code, response.msg.ifBlank { "读取未读消息失败" })
        }
        return response.data ?: DirectMessageUnreadPage()
    }

    suspend fun markRead(
        identity: DirectMessageIdentitySnapshot,
        messageId: String,
    ): DirectMessageReadReceipt? {
        if (!identity.hasCredentials() || messageId.isBlank()) return null
        val response = systemApiService.markDirectMessageRead(
            id = messageId,
            authorization = identity.authorization,
            deviceToken = identity.deviceToken,
        )
        if (!response.success || response.code != 0) {
            throw DirectMessageApiException(response.code, response.msg.ifBlank { "确认消息已读失败" })
        }
        return response.data
    }

    private fun DirectMessageIdentitySnapshot.hasCredentials(): Boolean =
        authorization != null || deviceToken != null
}
