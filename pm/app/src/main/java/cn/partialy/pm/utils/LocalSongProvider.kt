package cn.partialy.pm.utils

import android.content.ContentUris
import android.content.Context
import android.provider.MediaStore
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class LocalSongProvider @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    fun queryLocalSongs(): List<SongInfo> {
        val songs = mutableListOf<SongInfo>()
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.TITLE,
            MediaStore.Audio.Media.ARTIST,
            MediaStore.Audio.Media.DATA,
            MediaStore.Audio.Media.DURATION,
        )
        val selection = "${MediaStore.Audio.Media.IS_MUSIC} != 0"
        val sortOrder = "${MediaStore.Audio.Media.TITLE} ASC"

        context.contentResolver.query(
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
            projection,
            selection,
            null,
            sortOrder,
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val mediaId = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID))
                val title = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE)).orEmpty()
                val artist = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST)).orEmpty()
                val path = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA)).orEmpty()
                if (path.isNotBlank()) {
                    val duration = cursor.getInt(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION))
                    val contentUri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, mediaId)
                    var coverBytes = AudioEmbeddedArtReader.readEmbeddedCoverBytes(context, contentUri)
                    if (coverBytes == null) {
                        val file = File(path)
                        if (file.exists()) {
                            coverBytes = AudioEmbeddedArtReader.readEmbeddedCoverBytes(context, file)
                        }
                    }
                    songs.add(
                        SongInfo(
                            id = path,
                            type = SongType.LOCAL,
                            name = title.ifBlank { File(path).nameWithoutExtension },
                            artist = artist,
                            coverUrl = "",
                            embeddedCoverArt = coverBytes,
                            duration = duration,
                        ),
                    )
                }
            }
        }
        return songs
    }
}
