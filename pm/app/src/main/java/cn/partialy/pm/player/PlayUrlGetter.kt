package cn.partialy.pm.player

import cn.partialy.pm.fault.PlaybackDiagnosticRequest
import cn.partialy.pm.fault.PlaybackFaultRecorder
import cn.partialy.pm.fault.PlaybackTraceInterceptor
import cn.partialy.pm.fault.PlaybackTraceRegistry
import cn.partialy.pm.fault.ResolvedPlayUrl
import cn.partialy.pm.model.DownloadQualityChoice
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.matchesSongType
import cn.partialy.pm.network.kw.KwRepository
import cn.partialy.pm.network.kw.KwUrlResponse
import cn.partialy.pm.network.kw.pickUrl
import cn.partialy.pm.network.repository.KgRepository
import cn.partialy.pm.network.wy.WyRepository
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PlayUrlGetter @Inject constructor(
    private val kgRepository: KgRepository,
    private val wyRepository: WyRepository,
    private val kwRepository: KwRepository,
    private val traceRegistry: PlaybackTraceRegistry,
    private val faultRecorder: PlaybackFaultRecorder,
) {
    suspend fun getUrl(
        songInfo: SongInfo,
        choice: DownloadQualityChoice? = null,
        allowFallback: Boolean = true,
    ): ResolvedPlayUrl {
        if (choice != null && !choice.matchesSongType(songInfo.type)) {
            return if (allowFallback) getUrl(songInfo, choice = null, allowFallback = true) else ResolvedPlayUrl("error")
        }
        if (choice != null) {
            val selected = getUrlForChoice(songInfo, choice)
            if (isValidUrl(selected.url)) return selected
            if (!allowFallback) return selected
        }
        return when (songInfo.type) {
            SongType.KG -> getKgUrl(songInfo)
            SongType.WY -> getWyUrl(songInfo)
            SongType.KW -> getKwUrl(songInfo)
            SongType.LOCAL -> ResolvedPlayUrl(songInfo.id)
        }
    }

    private suspend fun getUrlForChoice(songInfo: SongInfo, choice: DownloadQualityChoice): ResolvedPlayUrl = when (choice) {
        is DownloadQualityChoice.Kugou -> attempt(songInfo, choice.quality, "PlayUrlGetter.getUrlForChoice.KG") { diagnostic ->
            kgRepository.getDownloadUrl(songInfo, choice.quality, diagnostic)["url"].orEmpty()
        }
        is DownloadQualityChoice.NeteaseBr -> attempt(songInfo, choice.br.toString(), "PlayUrlGetter.getUrlForChoice.WY.br") { diagnostic ->
            wyRepository.getDownloadUrlWithBr(songInfo, choice.br, diagnostic)["url"].orEmpty()
        }
        is DownloadQualityChoice.NeteaseLevel -> attempt(songInfo, choice.level, "PlayUrlGetter.getUrlForChoice.WY.level") { diagnostic ->
            wyRepository.getDownloadUrlWithLevel(songInfo, choice.level, diagnostic)["url"].orEmpty()
        }
        is DownloadQualityChoice.Kuwo -> attempt(songInfo, choice.quality, "PlayUrlGetter.getUrlForChoice.KW") { diagnostic ->
            kwRepository.getDownloadUrl(songInfo, choice.quality, diagnostic)["url"].orEmpty()
        }
    }

    private suspend fun getKgUrl(songInfo: SongInfo): ResolvedPlayUrl {
        for (quality in listOf("320", "128")) {
            val result = attempt(songInfo, quality, "PlayUrlGetter.getKgUrl") { diagnostic ->
                kgRepository.getDownloadUrl(songInfo, quality, diagnostic)["url"].orEmpty()
            }
            if (isValidUrl(result.url)) return result
        }
        return ResolvedPlayUrl("error")
    }

    private suspend fun getKwUrl(songInfo: SongInfo): ResolvedPlayUrl {
        val id = songInfo.id.toLongOrNull()
        if (id == null) {
            faultRecorder.recordResolutionFailure(songInfo, "", "error", null, "PlayUrlGetter.getKwUrl")
            return ResolvedPlayUrl("error")
        }
        fun pickFrom(result: KwUrlResponse): String? = result.pickUrl()?.takeIf { isValidUrl(it) }
        for (quality in listOf("exhigh", "standard")) {
            val result = attempt(songInfo, quality, "PlayUrlGetter.getKwUrl") { diagnostic ->
                kwRepository.getPlayUrl(id, quality, diagnostic).getOrNull()?.let(::pickFrom).orEmpty()
            }
            if (isValidUrl(result.url)) return result
        }
        return ResolvedPlayUrl("error")
    }

    private suspend fun getWyUrl(songInfo: SongInfo): ResolvedPlayUrl {
        for (level in listOf("jymaster", "hires", "lossless", "exhigh", "standard")) {
            val result = attempt(songInfo, level, "PlayUrlGetter.getWyUrl.level") { diagnostic ->
                wyRepository.getSongUrlV1(songInfo.id, level, diagnostic).getOrNull()?.data
                    ?.asSequence()?.mapNotNull { it.url }?.firstOrNull(::isValidUrl).orEmpty()
            }
            if (isValidUrl(result.url)) return result
        }
        for (bitrate in listOf(320000, 128000)) {
            val result = attempt(songInfo, bitrate.toString(), "PlayUrlGetter.getWyUrl.bitrate") { diagnostic ->
                wyRepository.getSongUrl(songInfo.id, bitrate, diagnostic).getOrNull()?.data
                    ?.asSequence()?.mapNotNull { it.url }?.firstOrNull(::isValidUrl).orEmpty()
            }
            if (isValidUrl(result.url)) return result
        }
        return ResolvedPlayUrl("error")
    }

    private suspend fun attempt(
        songInfo: SongInfo,
        quality: String,
        methodName: String,
        request: suspend (PlaybackDiagnosticRequest) -> String,
    ): ResolvedPlayUrl {
        val diagnostic = PlaybackTraceInterceptor.request(methodName)
        var thrown: Throwable? = null
        val url = try {
            request(diagnostic)
        } catch (error: Throwable) {
            thrown = error
            "error"
        }
        val trace = traceRegistry.take(diagnostic.traceId)
        if (isValidUrl(url)) return ResolvedPlayUrl(url, trace)
        faultRecorder.recordResolutionFailure(songInfo, quality, url, trace, methodName, thrown)
        return ResolvedPlayUrl(url.ifBlank { "error" }, trace)
    }

    private fun isValidUrl(value: String?): Boolean = value?.startsWith("http") == true
}
