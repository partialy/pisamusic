package cn.partialy.pm.download

import cn.partialy.pm.lyric.LyricFormat
import cn.partialy.pm.lyric.LyricParser
import cn.partialy.pm.lyric.LyricVariants
import cn.partialy.pm.lyric.RawLyric
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.cloudmusic.CloudMusicRepository
import cn.partialy.pm.network.repository.KgRepository
import cn.partialy.pm.network.wy.WyRepository
import cn.partialy.pm.utils.SettingsPrefs
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException

data class DownloadLyricAsset(
    val text: String,
    val extension: String,
)

data class ResolvedDownloadLyrics(
    val embeddedText: String = "",
    val originalWordAsset: DownloadLyricAsset? = null,
    val sidecars: List<DownloadLyricAsset> = emptyList(),
    val sidecarsRequested: Boolean = false,
) {
    companion object {
        val NONE = ResolvedDownloadLyrics()
    }
}

@Singleton
class DownloadLyricResolver @Inject constructor(
    private val kgRepository: KgRepository,
    private val wyRepository: WyRepository,
    private val cloudMusicRepository: CloudMusicRepository,
) {
    suspend fun resolve(
        song: SongInfo,
        embedLyrics: Boolean,
        mode: SettingsPrefs.DownloadLyricMode,
    ): ResolvedDownloadLyrics {
        val sidecarsRequested = mode != SettingsPrefs.DownloadLyricMode.Off
        if (!embedLyrics && !sidecarsRequested) return ResolvedDownloadLyrics.NONE

        val variants = try {
            fetchVariants(song)
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            DownloadLyricVariants.EMPTY
        }
        val embeddedText = if (embedLyrics) {
            EmbeddedLyricFormatter.standardLrc(variants.line, variants.word)
        } else {
            ""
        }
        return ResolvedDownloadLyrics(
            embeddedText = embeddedText,
            originalWordAsset = variants.word,
            sidecars = DownloadLyricSelector.select(mode, variants.word, variants.line),
            sidecarsRequested = sidecarsRequested,
        )
    }

    private suspend fun fetchVariants(song: SongInfo): DownloadLyricVariants = when (song.type) {
        SongType.KG -> kgRepository.getLyricVariants(song.id)
            .getOrNull()
            .orEmpty()
            .toDownloadVariants()

        SongType.WY -> song.id.toLongOrNull()
            ?.let { wyRepository.getLyricVariants(it).getOrNull() }
            .orEmpty()
            .toDownloadVariants()

        SongType.CLOUD -> fetchCloudVariants(song)
        SongType.KW, SongType.LOCAL -> DownloadLyricVariants.EMPTY
    }

    private suspend fun fetchCloudVariants(song: SongInfo): DownloadLyricVariants {
        if (!song.playable) return DownloadLyricVariants.EMPTY
        val resource = cloudMusicRepository.getLyricsResource(song.id)
        val text = cloudMusicRepository.fetchLyricsText(resource).trim()
        if (text.isEmpty()) return DownloadLyricVariants.EMPTY
        val raw = when (resource.format?.trim()?.lowercase()) {
            "krc" -> RawLyric(text, LyricFormat.KRC, "cloud_krc")
            "yrc" -> RawLyric(text, LyricFormat.YRC, "cloud_yrc")
            "lrc" -> RawLyric(text, LyricFormat.LRC, "cloud_lrc")
            "txt" -> null
            else -> inferRawLyric(text)
        }
        if (raw == null) {
            return DownloadLyricVariants(
                line = DownloadLyricAsset(text, "txt"),
            )
        }
        val content = LyricParser.parseContent(raw)
        if (!content.hasLyrics) return DownloadLyricVariants.EMPTY
        val asset = raw.toDownloadAsset()
        return if (content.hasWordTiming) {
            DownloadLyricVariants(word = asset)
        } else {
            DownloadLyricVariants(line = asset)
        }
    }

    private fun inferRawLyric(text: String): RawLyric? {
        val content = LyricParser.parseBest(text, source = "cloud_unknown")
        if (!content.hasLyrics) return null
        return RawLyric(text, content.format, "cloud_unknown")
    }

    private fun LyricVariants?.orEmpty(): LyricVariants = this ?: LyricVariants.EMPTY

    private fun LyricVariants.toDownloadVariants(): DownloadLyricVariants = DownloadLyricVariants(
        word = word?.toDownloadAsset(),
        line = line?.toDownloadAsset(),
    )

    private fun RawLyric.toDownloadAsset(): DownloadLyricAsset = DownloadLyricAsset(
        text = text,
        extension = when (format) {
            LyricFormat.KRC -> "krc"
            LyricFormat.YRC -> "yrc"
            LyricFormat.LRC -> "lrc"
            LyricFormat.NONE -> "txt"
        },
    )

    private data class DownloadLyricVariants(
        val word: DownloadLyricAsset? = null,
        val line: DownloadLyricAsset? = null,
    ) {
        companion object {
            val EMPTY = DownloadLyricVariants()
        }
    }
}

internal object DownloadLyricSelector {
    fun select(
        mode: SettingsPrefs.DownloadLyricMode,
        word: DownloadLyricAsset?,
        line: DownloadLyricAsset?,
    ): List<DownloadLyricAsset> = when (mode) {
        SettingsPrefs.DownloadLyricMode.Off -> emptyList()
        SettingsPrefs.DownloadLyricMode.Word -> listOfNotNull(word ?: line)
        SettingsPrefs.DownloadLyricMode.Line -> listOfNotNull(line)
        SettingsPrefs.DownloadLyricMode.All -> listOfNotNull(word, line)
    }.distinctBy { it.extension }
}
