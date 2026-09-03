package cn.partialy.pm.network.repository

import android.content.Context
import cn.partialy.pm.model.AnnouncementResponse
import cn.partialy.pm.model.AnnouncementReadRequest
import cn.partialy.pm.model.AnnouncementReadResponse
import cn.partialy.pm.model.DiscoverResponse
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.utils.ServerDevicePrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SystemRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: SystemApiService
) {
    suspend fun getAnnouncements(): Result<AnnouncementResponse> {
        return try {
            Result.success(api.getAnnouncements())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun markAnnouncementRead(id: String): Result<AnnouncementReadResponse> {
        val deviceToken = ServerDevicePrefs.getMessageToken(context)
        if (deviceToken.isBlank()) {
            return Result.failure(IllegalStateException("设备消息 token 不可用"))
        }
        val session = AccountSessionStore.read(context)
        val authorization = session.token.takeIf { session.loggedIn && it.isNotBlank() }
            ?.let { "Bearer $it" }
            ?: ""
        return try {
            Result.success(
                api.markAnnouncementRead(
                    id = id,
                    authorization = authorization,
                    deviceToken = deviceToken,
                    body = AnnouncementReadRequest(platform = "android"),
                ),
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getDiscover(): Result<DiscoverResponse> {
        return try {
            Result.success(api.getDiscover())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
