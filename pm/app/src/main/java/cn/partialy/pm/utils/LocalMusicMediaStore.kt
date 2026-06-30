package cn.partialy.pm.utils

import android.content.ContentUris
import android.provider.MediaStore

data class LocalMusicMediaRow(
    val recordId: String,
    val origin: String,
    val mediaId: Long?,
    val contentUri: String,
    val filePath: String,
    val title: String,
    val artist: String,
    val displayName: String,
    val duration: Long?,
    val size: Long?,
)

object LocalMusicMediaStore {
    fun contentUri(mediaId: Long) =
        ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, mediaId)
}
