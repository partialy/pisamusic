package cn.partialy.pm.lyric

import android.content.Context
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.cloudmusic.CloudMusicRepository
import cn.partialy.pm.network.repository.KgRepository
import cn.partialy.pm.network.wy.WyRepository
import cn.partialy.pm.utils.LocalMediaIndexDbStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withContext
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LyricRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val mediaIndexDb: LocalMediaIndexDbStore,
    private val kgRepository: KgRepository,
    private val wyRepository: WyRepository,
    private val cloudMusicRepository: CloudMusicRepository,
) {
    suspend fun loadLyrics(song: SongInfo): LyricContent = withContext(Dispatchers.IO) {
        if (song.type == SongType.LOCAL) loadLocalLyrics(song) else loadRemoteLyrics(song)
    }

    private suspend fun loadLocalLyrics(song: SongInfo): LyricContent {
        readEmbeddedLyrics(song)?.let { return it }
        readSiblingLrc(song)?.let { return it }
        readIndexedLyrics(song)?.let { return it }
        readLegacyLocalCache(song)?.let { return it }
        fetchLocalLyricsByKeywords(song)?.let { return it }
        return LyricContent.noLyrics()
    }

    private fun readEmbeddedLyrics(song: SongInfo): LyricContent? {
        val text = try {
            AudioFileIO.read(File(song.id)).tag?.getFirst(FieldKey.LYRICS).orEmpty().trim()
        } catch (_: Exception) {
            ""
        }
        val content = LyricParser.parseBest(text, source = "embedded")
        if (!content.hasLyrics) return null
        mediaIndexDb.upsertLyric(song, text, source = "embedded")
        return content
    }

    private fun readSiblingLrc(song: SongInfo): LyricContent? {
        val text = try {
            val file = File(song.id)
            val lrc = File(file.parentFile, "${file.nameWithoutExtension}.lrc")
            if (lrc.exists()) lrc.readText() else ""
        } catch (_: Exception) {
            ""
        }.trim()
        val content = LyricParser.parseContent(RawLyric(text, LyricFormat.LRC, "sibling_lrc"))
        if (!content.hasLyrics) return null
        mediaIndexDb.upsertLyric(song, text, source = "sibling_lrc")
        return content
    }

    private fun readIndexedLyrics(song: SongInfo): LyricContent? {
        val entry = mediaIndexDb.getLyricIndex(song) ?: return null
        val content = LyricParser.parseBest(entry.lyric, entry.source)
        return content.takeIf { it.hasLyrics }
    }

    private fun readLegacyLocalCache(song: SongInfo): LyricContent? {
        val text = try {
            val file = File(song.id)
            val cacheFile = File(context.cacheDir, "local_${file.name}")
            if (cacheFile.exists()) cacheFile.readText() else ""
        } catch (_: Exception) {
            ""
        }.trim()
        val content = LyricParser.parseBest(text, source = "legacy_file")
        if (!content.hasLyrics) return null
        mediaIndexDb.upsertLyric(song, text, source = content.source)
        return content
    }

    private suspend fun fetchLocalLyricsByKeywords(song: SongInfo): LyricContent? {
        val file = File(song.id)
        val keywords = buildLocalLyricKeywords(file)
        if (keywords.isBlank()) return null
        val raw = try {
            kgRepository.getBestLyricByKeywords(keywords).getOrNull()
        } catch (_: Exception) {
            null
        } ?: return null
        val content = LyricParser.parseContent(raw)
        if (!content.hasLyrics) return null
        runCatching {
            File(context.cacheDir, "local_${file.name}").writeText(raw.text)
            mediaIndexDb.upsertLyric(song, raw.text, source = raw.source)
        }
        return content
    }

    private suspend fun loadRemoteLyrics(song: SongInfo): LyricContent {
        val cached = readBestRemoteCache(song)
        if (cached?.hasWordTiming == true) return cached

        val fetched = fetchRemoteLyrics(song)
        if (fetched.hasLyrics) return fetched

        return cached ?: LyricContent.noLyrics()
    }

    private fun readBestRemoteCache(song: SongInfo): LyricContent? {
        val indexed = readIndexedLyrics(song)
        if (indexed?.hasWordTiming == true) return indexed

        val legacy = readLegacyRemoteCache(song)
        return indexed ?: legacy
    }

    private fun readLegacyRemoteCache(song: SongInfo): LyricContent? {
        val cacheFile = File(context.cacheDir, "${song.type.name}_${song.id}")
        if (!cacheFile.exists()) return null
        val text = runCatching { cacheFile.readText() }.getOrDefault("").trim()
        val content = LyricParser.parseBest(text, source = "legacy_file")
        if (!content.hasLyrics) return null
        mediaIndexDb.upsertLyric(song, text, source = content.source)
        return content
    }

    private suspend fun fetchRemoteLyrics(song: SongInfo): LyricContent {
        if (song.type == SongType.CLOUD) return fetchCloudLyrics(song)
        val raw = try {
            when (song.type) {
                SongType.KG -> kgRepository.getBestLyric(song.id).getOrNull()
                SongType.WY -> {
                    val id = song.id.toLongOrNull() ?: return LyricContent.noLyrics()
                    wyRepository.getBestLyric(id).getOrNull()
                }
                SongType.KW, SongType.CLOUD, SongType.LOCAL -> null
            }
        } catch (_: Exception) {
            null
        } ?: return LyricContent.noLyrics()

        val content = LyricParser.parseContent(raw)
        if (content.hasLyrics) {
            runCatching {
                File(context.cacheDir, "${song.type.name}_${song.id}").writeText(raw.text)
                mediaIndexDb.upsertLyric(song, raw.text, source = raw.source)
            }
        }
        return content
    }

    private suspend fun fetchCloudLyrics(song: SongInfo): LyricContent {
        if (!song.playable) return LyricContent.noLyrics()
        return try {
            val resource = cloudMusicRepository.getLyricsResource(song.id)
            val text = cloudMusicRepository.fetchLyricsText(resource).trim()
            if (text.isBlank()) return LyricContent.noLyrics()
            when (resource.format?.lowercase()) {
                "txt" -> parseCloudPlainText(text)
                else -> LyricParser.parseBest(text, source = "cloud_lrc").also { content ->
                    if (content.hasLyrics) {
                        runCatching {
                            File(context.cacheDir, "${song.type.name}_${song.id}").writeText(text)
                            mediaIndexDb.upsertLyric(song, text, source = "cloud_lrc")
                        }
                    }
                }
            }
        } catch (error: CancellationException) {
            throw error
        } catch (_: Exception) {
            LyricContent.noLyrics()
        }
    }

    /** 纯文本歌词没有时间轴，按行合成稳定的 5 秒区间以复用现有歌词组件。 */
    private fun parseCloudPlainText(text: String): LyricContent {
        val lines = text.lineSequence()
            .map(String::trim)
            .filter(String::isNotBlank)
            .mapIndexed { index, line ->
                val start = index * CLOUD_TEXT_LINE_DURATION_MS
                val end = start + CLOUD_TEXT_LINE_DURATION_MS
                LyricLine(
                    words = listOf(LyricWord(start, end, line)),
                    startTime = start,
                    endTime = end,
                )
            }
            .toList()
        return if (lines.isEmpty()) {
            LyricContent.noLyrics()
        } else {
            LyricContent(
                rawText = text,
                format = LyricFormat.NONE,
                source = "cloud_txt",
                lines = lines,
            )
        }
    }

    private fun buildLocalLyricKeywords(file: File): String {
        val raw = file.nameWithoutExtension.trim()
        if (raw.isEmpty()) return ""
        val sep = " - "
        val index = raw.indexOf(sep)
        if (index > 0) {
            val artist = raw.substring(0, index).trim()
            val title = raw.substring(index + sep.length).trim()
            return listOf(artist, title).filter { it.isNotEmpty() }.joinToString(" ").ifBlank { raw }
        }
        return raw
    }

    private companion object {
        const val CLOUD_TEXT_LINE_DURATION_MS = 5_000L
    }
}
