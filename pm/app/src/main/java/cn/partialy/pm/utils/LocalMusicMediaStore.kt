package cn.partialy.pm.utils

import android.content.ContentResolver
import android.content.ContentUris
import android.provider.MediaStore

data class LocalMusicMediaRow(
    val mediaId: Long,
    val title: String,
    val artist: String,
    val dataPath: String,
)

object LocalMusicMediaStore {

    fun queryLocalAudioRows(resolver: ContentResolver): List<LocalMusicMediaRow> {
        val out = mutableListOf<LocalMusicMediaRow>()
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.DATA,
        )
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
        val sortOrder = "${MediaStore.Audio.Media.TITLE} ASC"
        resolver.query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            null,
            sortOrder,
        )?.use { cursor ->
            val idCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
            val titleCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)
            val artistCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)
            val dataCol = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)
            while (cursor.moveToNext()) {
                val id = cursor.getLong(idCol)
                val title = cursor.getString(titleCol).orEmpty()
                val artist = cursor.getString(artistCol).orEmpty()
                val path = cursor.getString(dataCol).orEmpty()
                out.add(LocalMusicMediaRow(id, title, artist, path))
            }
        }
        return out
    }

    fun contentUri(mediaId: Long) =
        ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, mediaId)
}
