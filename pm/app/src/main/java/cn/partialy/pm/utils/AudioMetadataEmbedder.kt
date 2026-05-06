package cn.partialy.pm.utils

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.jaudiotagger.audio.AudioFileIO
import org.jaudiotagger.audio.flac.metadatablock.MetadataBlockDataPicture
import org.jaudiotagger.tag.FieldKey
import org.jaudiotagger.tag.Tag
import org.jaudiotagger.tag.flac.FlacTag
import org.jaudiotagger.tag.images.StandardArtwork
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * 使用 jaudiotagger 写入内嵌元数据：MP3（ID3v2 APIC / JPEG）与 FLAC（PICTURE）分支处理；
 * m4a 等尝试通用封面字段；其余格式仅写文本标签。
 */
object AudioMetadataEmbedder {

    @JvmStatic
    @Throws(Exception::class)
    fun embed(
        file: File,
        title: String,
        artist: String,
        album: String?,
        lyric: String?,
        coverBytes: ByteArray?,
    ) {
        val ext = file.extension.lowercase()
        val audioFile = AudioFileIO.read(file)
        val tag = audioFile.tagOrCreateDefault

        val titleStr = title.trim()
        if (titleStr.isNotEmpty()) tag.setField(FieldKey.TITLE, titleStr)
        val artistStr = artist.trim()
        if (artistStr.isNotEmpty()) tag.setField(FieldKey.ARTIST, artistStr)
        val albumStr = album?.trim().orEmpty()
        if (albumStr.isNotEmpty()) {
            tag.setField(FieldKey.ALBUM, albumStr)
        }
        val lyricStr = lyric?.trim().orEmpty()
        if (lyricStr.isNotEmpty()) {
            tag.setField(FieldKey.LYRICS, lyricStr)
        }

        val cover = coverBytes
        if (cover != null && cover.isNotEmpty()) {
            when (ext) {
                "flac" -> attachFlacPicture(tag, cover)
                "mp3" -> attachId3Picture(tag, cover)
                "m4a", "mp4" -> attachId3Picture(tag, cover)
                else -> { /* ogg/wav 等仅写字段，不强行写图 */ }
            }
        }

        audioFile.commit()
    }

    private fun attachId3Picture(tag: Tag, coverBytes: ByteArray) {
        val jpeg = toJpegBytes(coverBytes) ?: return
        tag.deleteArtworkField()
        val artwork = StandardArtwork()
        artwork.setBinaryData(jpeg)
        artwork.mimeType = "image/jpeg"
        artwork.pictureType = 3
        artwork.description = "Cover"
        tag.setField(artwork)
    }

    private fun attachFlacPicture(tag: Tag, coverBytes: ByteArray) {
        val flacTag = tag as? FlacTag ?: return
        val bitmap = BitmapFactory.decodeByteArray(coverBytes, 0, coverBytes.size) ?: return
        val w = bitmap.width
        val h = bitmap.height
        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
        if (!bitmap.isRecycled) bitmap.recycle()
        val png = stream.toByteArray()
        val picture = MetadataBlockDataPicture(
            png,
            3,
            "image/png",
            "",
            w,
            h,
            24,
            0,
        )
        flacTag.deleteArtworkField()
        flacTag.setField(picture)
    }

    private fun toJpegBytes(raw: ByteArray): ByteArray? {
        val decoded = BitmapFactory.decodeByteArray(raw, 0, raw.size) ?: return null
        val out = ByteArrayOutputStream()
        decoded.compress(Bitmap.CompressFormat.JPEG, 90, out)
        if (!decoded.isRecycled) decoded.recycle()
        return out.toByteArray()
    }
}
