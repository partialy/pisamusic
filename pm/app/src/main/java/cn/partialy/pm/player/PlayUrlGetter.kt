package cn.partialy.pm.player

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
) {
    suspend fun getUrl(
        songInfo: SongInfo,
        choice: DownloadQualityChoice? = null,
        allowFallback: Boolean = true,
    ): String {
        if (choice != null && !choice.matchesSongType(songInfo.type)) {
            return if (allowFallback) getUrl(songInfo, choice = null, allowFallback = true) else "error"
        }
        if (choice != null) {
            val selectedUrl = getUrlForChoice(songInfo, choice)
            if (isValidUrl(selectedUrl)) return selectedUrl
            if (!allowFallback) return "error"
        }

        return when (songInfo.type) {
            SongType.KG -> getKgUrl(songInfo)
            SongType.WY -> getWyUrl(songInfo)
            SongType.KW -> getKwUrl(songInfo)
            SongType.LOCAL -> songInfo.id
        }
    }

    private suspend fun getUrlForChoice(
        songInfo: SongInfo,
        choice: DownloadQualityChoice,
    ): String = try {
        when (choice) {
            is DownloadQualityChoice.Kugou ->
                kgRepository.getDownloadUrl(songInfo, choice.quality)["url"].orEmpty()
            is DownloadQualityChoice.NeteaseBr ->
                wyRepository.getDownloadUrlWithBr(songInfo, choice.br)["url"].orEmpty()
            is DownloadQualityChoice.NeteaseLevel ->
                wyRepository.getDownloadUrlWithLevel(songInfo, choice.level)["url"].orEmpty()
            is DownloadQualityChoice.Kuwo ->
                kwRepository.getDownloadUrl(songInfo, choice.quality)["url"].orEmpty()
        }
    } catch (e: Exception) {
        e.printStackTrace()
        "error"
    }

    suspend fun getKgUrl(songInfo: SongInfo): String {
        return try {
            val qualities = listOf("320", "128")
            for (quality in qualities) {
                val res = kgRepository.getDownloadUrl(songInfo, quality)["url"]
                if (isValidUrl(res)) return res!!
            }
            "error"
        } catch (e: Exception) {
            e.printStackTrace()
            "error"
        }
    }

    suspend fun getKwUrl(songInfo: SongInfo): String {
        return try {
            val id = songInfo.id.toLongOrNull() ?: return "error"
            fun pickFrom(result: KwUrlResponse): String? =
                result.pickUrl()?.takeIf { it.startsWith("http") }

            val exhigh = kwRepository.getPlayUrl(id, quality = "exhigh").getOrNull()?.let { pickFrom(it) }
            if (exhigh != null) return exhigh
            val standard = kwRepository.getPlayUrl(id, quality = "standard").getOrNull()?.let { pickFrom(it) }
            standard ?: "error"
        } catch (e: Exception) {
            e.printStackTrace()
            "error"
        }
    }

    suspend fun getWyUrl(songInfo: SongInfo): String {
        return try {
            val levelCandidates = listOf("jymaster", "hires", "lossless", "exhigh", "standard")
            for (level in levelCandidates) {
                val byLevel = wyRepository.getSongUrlV1(songInfo.id, level).getOrNull()
                val byLevelUrl = byLevel?.data?.asSequence()
                    ?.mapNotNull { it.url }
                    ?.firstOrNull { isValidUrl(it) }
                if (isValidUrl(byLevelUrl)) return byLevelUrl!!
            }

            val bitrateCandidates = listOf(320000, 128000)
            for (br in bitrateCandidates) {
                val body = wyRepository.getSongUrl(songInfo.id, br).getOrNull() ?: continue
                val url = body.data.asSequence()
                    .mapNotNull { it.url }
                    .firstOrNull { isValidUrl(it) }
                if (isValidUrl(url)) return url!!
            }
            "error"
        } catch (e: Exception) {
            e.printStackTrace()
            "error"
        }
    }

    private fun isValidUrl(value: String?): Boolean = value?.startsWith("http") == true
}
