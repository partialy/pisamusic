package cn.partialy.pm.network.cloudmusic

import android.content.Context
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.IOException
import javax.inject.Inject
import javax.inject.Named
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import retrofit2.HttpException

@Singleton
class CloudMusicRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val systemApiService: SystemApiService,
    private val configManager: ConfigManager,
    @Named("cloud_asset_okhttp") private val cloudAssetClient: OkHttpClient,
) {
    suspend fun getSummary(): CloudMusicSummary = apiCall("获取网盘音乐概览失败") {
        val session = AccountSessionStore.read(context)
        val auth = if (session.loggedIn && session.token.isNotBlank()) "Bearer ${session.token}" else null
        systemApiService.getCloudMusicSummary(auth)
    }.requireData("获取网盘音乐概览失败").let { dto ->
        CloudMusicSummary(
            total = dto.total.coerceAtLeast(0),
            latestUpdatedAt = dto.latestUpdatedAt,
            myContributions = dto.myContributions.coerceAtLeast(0),
        )
    }

    suspend fun search(keyword: String, offset: Int, limit: Int): CloudMusicPage =
        apiCall("搜索网盘音乐失败") {
            systemApiService.searchCloudMusic(
                keyword = keyword.trim(),
                offset = offset.coerceAtLeast(0),
                limit = limit.coerceIn(1, MAX_PAGE_SIZE),
            )
        }.requireData("搜索网盘音乐失败").let { dto ->
            CloudMusicPage(
                items = dto.items.map(::toSongInfo),
                total = dto.total.coerceAtLeast(0),
                offset = dto.offset.coerceAtLeast(0),
            )
        }

    suspend fun getTrack(uuid: String): SongInfo = apiCall("获取网盘音乐详情失败") {
        systemApiService.getCloudMusicTrack(uuid)
    }.requireData("获取网盘音乐详情失败").let(::toSongInfo)

    suspend fun getTrackFormat(uuid: String): String? = apiCall("获取网盘音乐详情失败") {
        systemApiService.getCloudMusicTrack(uuid)
    }.requireData("获取网盘音乐详情失败").format
        ?.trim()
        ?.lowercase()
        ?.takeIf { it.matches(Regex("[a-z0-9]{1,8}")) }

    /** 供下一阶段播放链路按需调用；返回的临时 URL 不持久化。 */
    suspend fun getPlayResource(uuid: String): CloudMusicSignedResource = apiCall("获取网盘音乐播放地址失败") {
        systemApiService.getCloudMusicPlayUrl(uuid)
    }.requireData("获取网盘音乐播放地址失败").toSignedResource()

    /** 供下一阶段歌词链路按需调用；返回的临时 URL 不持久化。 */
    suspend fun getLyricsResource(uuid: String): CloudMusicSignedResource = apiCall("获取网盘音乐歌词地址失败") {
        systemApiService.getCloudMusicLyricsUrl(uuid)
    }.requireData("获取网盘音乐歌词地址失败").toSignedResource()

    /** 已签发歌词资源只能以 HTTPS 通过无 AES/网关 header 的专用 client 拉取。 */
    suspend fun fetchLyricsText(resource: CloudMusicSignedResource): String {
        val url = resource.url.toHttpUrlOrNull()
            ?.takeIf { it.isHttps }
            ?: throw CloudMusicApiException(-1, "网盘歌词地址必须为 HTTPS")
        val request = Request.Builder().url(url).get().build()
        return suspendCancellableCoroutine { continuation ->
            val call = cloudAssetClient.newCall(request)
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, error: IOException) {
                    if (continuation.isActive) continuation.resumeWithException(error)
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use {
                        if (!continuation.isActive) return
                        if (!response.isSuccessful) {
                            continuation.resumeWithException(
                                IOException("网盘歌词下载失败：HTTP ${response.code}"),
                            )
                            return
                        }
                        try {
                            continuation.resume(response.body?.string().orEmpty())
                        } catch (error: IOException) {
                            if (continuation.isActive) continuation.resumeWithException(error)
                        }
                    }
                }
            })
        }
    }

    private fun toSongInfo(dto: CloudMusicTrackDto): SongInfo = SongInfo(
        id = dto.uuid,
        type = SongType.CLOUD,
        name = dto.title,
        artist = dto.artist,
        coverUrl = resolveStableCover(dto.cover),
        album = dto.album,
        duration = dto.durationMs.coerceIn(0L, Int.MAX_VALUE.toLong()).toInt(),
        playable = dto.playable,
    )

    private fun resolveStableCover(cover: CloudMusicCoverDto?): String {
        if (cover == null || cover.source.equals("default", ignoreCase = true)) return ""
        return configManager.resolveSystemUrl(cover.url).orEmpty()
    }

    private fun CloudMusicSignedResourceDto.toSignedResource(): CloudMusicSignedResource = CloudMusicSignedResource(
        uuid = uuid,
        url = url,
        expiresAt = expiresAt,
        format = format,
    )

    private suspend fun <T> apiCall(fallback: String, block: suspend () -> CloudMusicEnvelope<T>): CloudMusicEnvelope<T> {
        return try {
            block()
        } catch (error: HttpException) {
            throw CloudMusicApiException(error.code(), error.message().ifBlank { fallback })
        }
    }

    private fun <T> CloudMusicEnvelope<T>.requireData(fallback: String): T {
        if (!success || code != 0) throw CloudMusicApiException(code, msg.ifBlank { fallback })
        return data ?: throw CloudMusicApiException(code, fallback)
    }

    private companion object {
        const val MAX_PAGE_SIZE = 100
    }
}

data class CloudMusicSummary(
    val total: Int,
    val latestUpdatedAt: Long?,
    val myContributions: Int = 0,
)

data class CloudMusicPage(
    val items: List<SongInfo>,
    val total: Int,
    val offset: Int,
)

data class CloudMusicSignedResource(
    val uuid: String,
    val url: String,
    val expiresAt: Long,
    val format: String?,
)

class CloudMusicApiException(
    val code: Int,
    override val message: String,
) : RuntimeException(message)
