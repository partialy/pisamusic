package cn.partialy.pm.download

import cn.partialy.pm.model.*
import cn.partialy.pm.network.cloudmusic.CloudMusicRepository
import cn.partialy.pm.network.kw.KwRepository
import cn.partialy.pm.network.kw.pickUrl
import cn.partialy.pm.network.repository.KgRepository
import cn.partialy.pm.network.wy.WyRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import retrofit2.HttpException
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

enum class DownloadFailureKind(val description: String) {
    ACCESS("当前账号无权使用所选音质"), AUTH("音乐源鉴权失败"), PAID("音乐源要求购买或授权"),
    UNAVAILABLE("所选及可用较低音质均无资源"), NETWORK("取链网络请求失败"),
    INVALID_URL("音乐源返回无效下载地址"), INVALID_SONG("歌曲标识无效"), STORAGE("文件下载或处理失败"),
}

class DownloadResolutionException(val kind: DownloadFailureKind) : Exception(kind.description)

data class ResolvedDownloadUrl(val url: String, val choice: DownloadQualityChoice, val extension: String)

/** 下载直接访问源仓库，不经过播放缓存 URI；错误只保留安全类别。 */
@Singleton
class DownloadUrlResolver @Inject constructor(
    private val kgRepository: KgRepository,
    private val wyRepository: WyRepository,
    private val kwRepository: KwRepository,
    private val cloudRepository: CloudMusicRepository,
) {
    suspend fun resolve(song: SongInfo, requested: DownloadQualityChoice, access: MusicQualityAccessState): ResolvedDownloadUrl {
        val candidates = downloadQualityCandidates(song.type, requested, access)
        if (candidates.isEmpty()) throw DownloadResolutionException(DownloadFailureKind.ACCESS)
        var failure = DownloadFailureKind.UNAVAILABLE
        for (choice in candidates) {
            currentCoroutineContext().ensureActive()
            try {
                return resolveChoice(song, choice)
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                val kind = when (error) {
                    is DownloadResolutionException -> error.kind
                    is HttpException -> if (error.code() == 401 || error.code() == 403) DownloadFailureKind.AUTH else DownloadFailureKind.NETWORK
                    is IOException -> DownloadFailureKind.NETWORK
                    is IllegalArgumentException -> DownloadFailureKind.INVALID_SONG
                    else -> DownloadFailureKind.UNAVAILABLE
                }
                // 优先保留明确的鉴权/付费/网络原因，而不是被下一档空资源覆盖。
                if (failure == DownloadFailureKind.UNAVAILABLE || kind != DownloadFailureKind.UNAVAILABLE) failure = kind
            }
        }
        throw DownloadResolutionException(failure)
    }

    suspend fun resolveExact(song: SongInfo, choice: DownloadQualityChoice, access: MusicQualityAccessState): ResolvedDownloadUrl {
        if (!MusicQualityAccessPolicy.isChoiceAllowed(song.type, choice, access)) throw DownloadResolutionException(DownloadFailureKind.ACCESS)
        val result = resolveChoice(song, choice)
        if (result.choice.toPlaybackQualityKey() != choice.toPlaybackQualityKey()) throw DownloadResolutionException(DownloadFailureKind.UNAVAILABLE)
        return result
    }

    private suspend fun resolveChoice(song: SongInfo, choice: DownloadQualityChoice): ResolvedDownloadUrl {
        val raw: String?
        val extension: String
        var actual = choice
        when (choice) {
            is DownloadQualityChoice.Kugou -> {
                val response = kgRepository.getSongUrl(song.id, choice.quality).getOrThrow()
                if (response.failProcess?.contains("buy") == true) throw DownloadResolutionException(DownloadFailureKind.PAID)
                raw = response.pickKgStreamUrl()
                extension = response.extName ?: if (choice.quality == "128" || choice.quality == "320") "mp3" else "flac"
            }
            is DownloadQualityChoice.NeteaseBr, is DownloadQualityChoice.NeteaseLevel -> {
                val response = when (choice) {
                    is DownloadQualityChoice.NeteaseBr -> wyRepository.getSongUrl(song.id, choice.br).getOrThrow()
                    is DownloadQualityChoice.NeteaseLevel -> wyRepository.getSongUrlV1(song.id, choice.level).getOrThrow()
                    else -> error("unreachable")
                }
                val item = response.data.firstOrNull { !it.url.isNullOrBlank() }
                if (item == null && (response.code == 401 || response.code == 403)) throw DownloadResolutionException(DownloadFailureKind.AUTH)
                if (item == null && response.data.any { it.code == -110 || it.code == 403 }) throw DownloadResolutionException(DownloadFailureKind.PAID)
                raw = item?.url
                if (item != null) actual = reportedWyDownloadChoice(choice, item.br, item.level)
                extension = item?.type?.takeIf { it.isNotBlank() }
                    ?: if (downloadQualityRank(actual) >= 3) "flac" else "mp3"
            }
            is DownloadQualityChoice.Kuwo -> {
                val response = kwRepository.getPlayUrl(song.id.toLong(), choice.quality).getOrThrow()
                raw = response.pickUrl()
                response.quality?.let { value ->
                    val reported = DownloadQualityChoice.Kuwo(value)
                    if (downloadQualityRank(reported) > downloadQualityRank(choice)) throw DownloadResolutionException(DownloadFailureKind.UNAVAILABLE)
                    if (downloadQualityRank(reported) in 0..downloadQualityRank(choice)) actual = reported
                }
                extension = if ((actual as DownloadQualityChoice.Kuwo).quality == "lossless") "flac" else "mp3"
            }
            DownloadQualityChoice.CloudDefault -> {
                val resource = cloudRepository.getPlayResource(song.id)
                raw = resource.url
                extension = resource.format.orEmpty().ifBlank { "mp3" }
            }
        }
        currentCoroutineContext().ensureActive()
        if (raw.isNullOrBlank() || raw == "error") throw DownloadResolutionException(DownloadFailureKind.UNAVAILABLE)
        if (raw == "buy") throw DownloadResolutionException(DownloadFailureKind.PAID)
        val url = raw.toHttpUrlOrNull() ?: throw DownloadResolutionException(DownloadFailureKind.INVALID_URL)
        if (url.username.isNotEmpty() || url.password.isNotEmpty()) throw DownloadResolutionException(DownloadFailureKind.INVALID_URL)
        val safeExtension = extension.lowercase().removePrefix(".").takeIf { it in setOf("mp3", "flac", "wav", "m4a", "aac", "ogg", "opus", "ape", "wma", "aiff") } ?: "mp3"
        return ResolvedDownloadUrl(raw, actual, safeExtension)
    }
}
