package cn.partialy.pm.download

import java.io.File
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.tag.FieldKey

object AudioMetadataVerifier {
    @JvmStatic
    fun isReadable(file: File): Boolean = runCatching {
        file.isFile && file.length() > 0 && AudioFileIO.read(file).audioHeader != null
    }.getOrDefault(false)

    @JvmStatic
    fun verify(
        file: File,
        title: String?,
        artist: String?,
        album: String?,
        lyric: String?,
        expectedCover: Boolean,
    ): Boolean = runCatching {
        val audio = AudioFileIO.read(file)
        val tag = audio.tag
        fun check(key: FieldKey, expected: String?): Boolean =
            expected.isNullOrBlank() || tag?.getFirst(key)?.trim() == expected.trim()
        file.length() > 0 && audio.audioHeader != null &&
            check(FieldKey.TITLE, title) &&
            check(FieldKey.ARTIST, artist) &&
            check(FieldKey.ALBUM, album) &&
            check(FieldKey.LYRICS, lyric) &&
            (!expectedCover || tag?.firstArtwork != null)
    }.getOrDefault(false)
}
