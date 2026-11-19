package cn.partialy.pm.download.quota

import android.content.Context
import cn.partialy.pm.model.DownloadQualityChoice
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.toPlaybackQualityKey
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.util.DeviceInfoCollector
import cn.partialy.pm.utils.ServerDevicePrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

/** 下载前向服务端校验配额并记录批次；必须联网校验通过才允许入队。 */
@Singleton
class SongDownloadQuotaRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: SystemApiService,
    private val configManager: ConfigManager,
) {
    private val authMutex = Mutex()

    suspend fun acquire(
        clientBatchId: String,
        songs: List<SongInfo>,
        choice: DownloadQualityChoice,
    ): SongDownloadAcquireData = withContext(Dispatchers.IO) {
        val qualityKey = choice.toPlaybackQualityKey()
        val items = songs.map { song ->
            val source = when (song.type) {
                SongType.KG -> "kg"
                SongType.WY -> "wy"
                SongType.KW -> "kw"
                SongType.CLOUD -> "cloud"
                SongType.LOCAL -> error("本地歌曲不支持在线下载校验")
            }
            SongDownloadItemDto(
                source = source,
                songId = song.id,
                name = song.name.ifBlank { "未知歌曲" },
                singer = song.artist,
                album = song.album.orEmpty(),
                cover = song.coverUrl,
                durationMs = song.durationMs ?: song.duration?.takeIf { it >= 0 }?.toLong()?.times(1000L),
                qualityKey = qualityKey,
            )
        }
        val requestBody = SongDownloadAcquireRequest(
            clientBatchId = clientBatchId,
            platform = "android",
            items = items,
        )

        val expectedUserId = AccountSessionStore.read(context).user.id
        authMutex.withLock {
            if (ServerDevicePrefs.getMessageToken(context).isBlank() || ServerDevicePrefs.getDeviceId(context).isBlank()) {
                refreshDevice(expectedUserId)
            }
            val session = AccountSessionStore.read(context)
            check(session.user.id == expectedUserId) { "账号状态已变更，请重试下载" }
            if (session.loggedIn && session.expiresAt <= System.currentTimeMillis() + 60_000) {
                refreshAccount(expectedUserId)
            }
        }

        val response = try {
            sendAcquire(expectedUserId, requestBody)
        } catch (error: Exception) {
            if (error is CancellationException) throw error
            val unauthorized = (error is HttpException && error.code() == 401) ||
                (error is ConfigManager.ApiException && error.code == 401)
            if (!unauthorized) throw error
            authMutex.withLock {
                refreshDevice(expectedUserId)
                if (expectedUserId.isNotBlank()) refreshAccount(expectedUserId)
            }
            sendAcquire(expectedUserId, requestBody)
        }

        if (!response.success || response.code != 0 || response.data == null) {
            throw ConfigManager.ApiException(
                response.code,
                response.msg.ifBlank { "校验下载配额失败" },
            )
        }
        response.data
    }

    private suspend fun sendAcquire(
        expectedUserId: String,
        body: SongDownloadAcquireRequest,
    ): SongDownloadAcquireResponse {
        val session = AccountSessionStore.read(context)
        check(session.user.id == expectedUserId) { "账号状态已变更，请重试下载" }
        check(session.user.id.isBlank() || session.loggedIn) { "登录已失效，请重新登录" }
        val deviceToken = ServerDevicePrefs.getMessageToken(context)
        check(deviceToken.isNotBlank()) { "设备身份不可用，请联网后重试" }
        val authHeader = session.token.takeIf { expectedUserId.isNotBlank() }?.let { "Bearer $it" }
        val result = api.acquireSongDownloadQuota(authHeader, deviceToken, body)
        if (result.code == 401) throw ConfigManager.ApiException(401, result.msg)
        return result
    }

    private suspend fun refreshDevice(expectedUserId: String) {
        val report = configManager.reportDevice(DeviceInfoCollector.build(context))
        check(AccountSessionStore.read(context).user.id == expectedUserId) { "账号状态已变更，请重试下载" }
        check(!report.locked) { "当前设备不可用" }
        require(report.id.isNotBlank() && report.messageToken.isNotBlank()) { "设备凭证无效" }
        ServerDevicePrefs.saveReportIdentity(context, report.id, report.messageToken)
    }

    private suspend fun refreshAccount(expectedUserId: String) {
        val session = AccountSessionStore.read(context)
        check(session.user.id == expectedUserId && session.loggedIn) { "登录已失效，请重新登录" }
        val refreshed = configManager.refreshAccountToken(session.token)
        check(refreshed.user.id == expectedUserId) { "账号状态已变更，请重试下载" }
        AccountSessionStore.save(context, refreshed)
    }
}
