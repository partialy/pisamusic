package cn.partialy.pm.lyric

import android.content.Context
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.repository.KgRepository
import cn.partialy.pm.network.wy.WyRepository
import cn.partialy.pm.utils.LocalMediaIndexDbStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
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
) {
    suspend fun loadLyrics(song: SongInfo): String = withContext(Dispatchers.IO) {
        if (song.type == SongType.LOCAL) {
            loadLocalLyrics(song)
        } else {
            loadRemoteLyrics(song)
        }
    }

    private suspend fun loadLocalLyrics(song: SongInfo): String {
        readEmbeddedLyrics(song)?.let { return it }
        readSiblingLrc(song)?.let { return it }
        mediaIndexDb.getLyric(song)?.let { return it }
        readLegacyLocalCache(song)?.let { return it }
        fetchLocalLyricsByKeywords(song)?.let { return it }
        return NO_LYRIC_TEXT
    }

    private fun readEmbeddedLyrics(song: SongInfo): String? {
        val text = try {
            AudioFileIO.read(File(song.id)).tag?.getFirst(FieldKey.LYRICS).orEmpty().trim()
        } catch (_: Exception) {
            ""
        }
        if (text.isBlank()) return null
        mediaIndexDb.upsertLyric(song, text, source = "embedded")
        return text
    }

    private fun readSiblingLrc(song: SongInfo): String? {
        val text = try {
            val file = File(song.id)
            val lrc = File(file.parentFile, "${file.nameWithoutExtension}.lrc")
            if (lrc.exists()) lrc.readText() else ""
        } catch (_: Exception) {
            ""
        }.trim()
        if (text.isBlank()) return null
        mediaIndexDb.upsertLyric(song, text, source = "sibling_lrc")
        return text
    }

    private fun readLegacyLocalCache(song: SongInfo): String? {
        val text = try {
            val file = File(song.id)
            val cacheFile = File(context.cacheDir, "local_${file.name}")
            if (cacheFile.exists()) cacheFile.readText() else ""
        } catch (_: Exception) {
            ""
        }.trim()
        if (text.isBlank()) return null
        mediaIndexDb.upsertLyric(song, text, source = "legacy_file")
        return text
    }

    private suspend fun fetchLocalLyricsByKeywords(song: SongInfo): String? {
        val file = File(song.id)
        val keywords = buildLocalLyricKeywords(file)
        if (keywords.isBlank()) return null
        val text = try {
            kgRepository.getLyricByKeywords(keywords).getOrNull().orEmpty().trim()
        } catch (_: Exception) {
            ""
        }
        if (text.isBlank()) return null
        runCatching {
            File(context.cacheDir, "local_${file.name}").writeText(text)
            mediaIndexDb.upsertLyric(song, text, source = "network_kg")
        }
        return text
    }

    private suspend fun loadRemoteLyrics(song: SongInfo): String {
        readLegacyRemoteCache(song)?.let { return it }
        mediaIndexDb.getLyric(song)?.let { return it }
        return fetchRemoteLyrics(song)
    }

    private fun readLegacyRemoteCache(song: SongInfo): String? {
        val cacheFile = File(context.cacheDir, "${song.type.name}_${song.id}")
        if (!cacheFile.exists()) return null
        val text = runCatching { cacheFile.readText() }.getOrDefault("").trim()
        if (text.isBlank()) return null
        mediaIndexDb.upsertLyric(song, text, source = "legacy_file")
        return text
    }

    private suspend fun fetchRemoteLyrics(song: SongInfo): String {
        val lyric = try {
            when (song.type) {
                SongType.KG -> kgRepository.getLyric(song.id).getOrElse { ERROR_TEXT }
                SongType.WY -> {
                    val id = song.id.toLongOrNull() ?: return ERROR_TEXT
                    wyRepository.getLyric(id).getOrElse { ERROR_TEXT }
                }
                SongType.KW, SongType.LOCAL -> ""
            }
        } catch (_: Exception) {
            ERROR_TEXT
        }
        if (lyric.isNotBlank() && lyric != ERROR_TEXT) {
            runCatching {
                File(context.cacheDir, "${song.type.name}_${song.id}").writeText(lyric)
                mediaIndexDb.upsertLyric(song, lyric, source = "network_${song.type.name.lowercase()}")
            }
        }
        return lyric
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

    companion object {
        private const val ERROR_TEXT = "error"
        private const val NO_LYRIC_TEXT = "暂无歌词"
    }
}
