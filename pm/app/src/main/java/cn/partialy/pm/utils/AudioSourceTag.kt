package cn.partialy.pm.utils

import cn.partialy.pm.model.SongType
import org.jaudiotagger.tag.Tag
import org.jaudiotagger.tag.TagTextField
import org.jaudiotagger.tag.asf.AsfTag
import org.jaudiotagger.tag.asf.AsfTagTextField
import org.jaudiotagger.tag.flac.FlacTag
import org.jaudiotagger.tag.id3.AbstractID3v2Frame
import org.jaudiotagger.tag.id3.AbstractID3v2Tag
import org.jaudiotagger.tag.id3.ID3v22Tag
import org.jaudiotagger.tag.id3.ID3v23Tag
import org.jaudiotagger.tag.id3.Id3SupportingTag
import org.jaudiotagger.tag.id3.framebody.FrameBodyTXXX
import org.jaudiotagger.tag.mp4.Mp4Tag
import org.jaudiotagger.tag.mp4.field.Mp4TagReverseDnsField
import org.jaudiotagger.tag.vorbiscomment.VorbisCommentTag
import org.jaudiotagger.tag.wav.WavTag

/** 来源只写独立自定义字段，不占用用户的备注、标题等标准标签。 */
object AudioSourceTag {
    const val KEY = "pm-info"
    private const val MP4_ISSUER = "cn.partialy.pm"
    private const val MP4_KEY = "----:$MP4_ISSUER:$KEY"

    @JvmStatic
    fun value(source: SongType, songId: String): String? {
        val id = songId.trim()
        if (source == SongType.LOCAL || id.isEmpty()) return null
        return "${source.name.lowercase(java.util.Locale.ROOT)}:$id"
    }

    @JvmStatic
    fun read(tag: Tag?): String? = runCatching {
        when (tag) {
            is AbstractID3v2Tag -> readId3(tag)
            is Id3SupportingTag -> tag.getID3Tag()?.let(::readId3)
            is Mp4Tag -> tag.getFirst(MP4_KEY)
            else -> tag?.fields?.asSequence()
                ?.filter { it.id.equals(KEY, ignoreCase = true) }
                ?.mapNotNull { (it as? TagTextField)?.content }
                ?.firstOrNull()
        }?.trim()?.takeIf(String::isNotEmpty)
    }.getOrNull()

    @JvmStatic
    fun write(tag: Tag, value: String) {
        require(value.isNotBlank()) { "来源标识为空" }
        when (tag) {
            is AbstractID3v2Tag -> writeId3(tag, value)
            is Id3SupportingTag -> {
                val original = tag.getID3Tag()
                val id3 = when (original) {
                    null -> ID3v23Tag()
                    is ID3v22Tag -> ID3v23Tag(original)
                    else -> original
                }
                tag.setID3Tag(id3)
                writeId3(id3, value)
                // WAV 的 INFO 块不支持任意长度键，确保独立 ID3 块实际写入。
                if (tag is WavTag) {
                    tag.syncToId3FromInfoIfEmpty()
                    tag.setExistingId3Tag(true)
                }
            }
            is FlacTag -> tag.setField(KEY, value)
            is VorbisCommentTag -> tag.setField(KEY, value)
            is Mp4Tag -> tag.setField(Mp4TagReverseDnsField(MP4_KEY, MP4_ISSUER, KEY, value))
            is AsfTag -> tag.setField(AsfTagTextField(KEY, value))
            else -> error("当前格式不支持来源字段")
        }
    }

    private fun readId3(tag: AbstractID3v2Tag): String? {
        val key = if (tag is ID3v22Tag) "TXX" else "TXXX"
        return tag.getFields(key).asSequence()
            .mapNotNull { (it as? AbstractID3v2Frame)?.body as? FrameBodyTXXX }
            .firstOrNull { it.description.equals(KEY, ignoreCase = true) }
            ?.firstTextValue
    }

    private fun writeId3(tag: AbstractID3v2Tag, value: String) {
        val frame = tag.createFrame(if (tag is ID3v22Tag) "TXX" else "TXXX")
        // UTF-16 同时兼容 ID3v2.3 / 2.4，保留其他描述的 TXXX 帧。
        frame.body = FrameBodyTXXX(1.toByte(), KEY, value)
        tag.setField(frame)
    }
}
