package cn.partialy.pm.network.repository

import android.content.Context
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.announcement.ANNOUNCEMENT_VERSION
import cn.partialy.pm.model.AnnouncementItem
import cn.partialy.pm.model.AnnouncementResponse
import cn.partialy.pm.model.AnnouncementReadRequest
import cn.partialy.pm.model.AnnouncementReadResponse
import cn.partialy.pm.model.DiscoverResponse
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.utils.ServerDevicePrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SystemRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: SystemApiService
) {
    private val receiptScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val announcementPrefs by lazy {
        context.getSharedPreferences("app_notice_prefs", Context.MODE_PRIVATE)
    }

    fun confirmedAnnouncementIds(): Set<String> =
        announcementPrefs.getStringSet(KEY_READ_ANNOUNCEMENT_IDS, emptySet()).orEmpty()

    fun confirmAnnouncement(item: AnnouncementItem, rememberLocally: Boolean = false) {
        if (rememberLocally && !item.showEveryTime) {
            val confirmed = confirmedAnnouncementIds()
            if (item.id !in confirmed) {
                announcementPrefs.edit()
                    .putStringSet(KEY_READ_ANNOUNCEMENT_IDS, confirmed + item.id)
                    .apply()
            }
        }
        receiptScope.launch { markAnnouncementRead(item.id) }
    }

    suspend fun getAnnouncements(): Result<AnnouncementResponse> {
        return try {
            Result.success(
                api.getAnnouncements(
                    announcementVersion = ANNOUNCEMENT_VERSION,
                    appVersion = BuildConfig.VERSION_NAME,
                    type = "mobile",
                ),
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun markAnnouncementRead(id: String): Result<AnnouncementReadResponse> {
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

    private companion object {
        const val KEY_READ_ANNOUNCEMENT_IDS = "read_announcement_ids"
    }
}
