package cn.partialy.pm.utils.localdata

import android.content.ContentValues
import android.content.Context
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class CachedPlaybackRecord(
    val song: SongInfo,
    val songKey: String,
    val qualityKey: String,
    val playUrl: String,
    val cacheKey: String,
    val cachedBytes: Long,
    val updatedAt: Long,
)

@Singleton
class CachedPlaybackStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val helper = LocalMusicDbOpenHelper(context)

    fun upsert(
        song: SongInfo,
        songKey: String,
        qualityKey: String,
        playUrl: String,
        cacheKey: String,
        cachedBytes: Long,
    ) {
        if (song.type == SongType.LOCAL || playUrl.isBlank() || cacheKey.isBlank() || cachedBytes <= 0L) return
        val now = System.currentTimeMillis()
        val values = ContentValues().apply {
            put("song_key", songKey)
            put("source", song.type.name)
            put("source_id", song.id)
            put("quality_key", qualityKey)
            put("name", song.name)
            put("artist", song.artist)
            put("album", song.album.orEmpty())
            put("cover_url", song.coverUrl)
            put("duration", song.duration)
            put("play_url", playUrl)
            put("cache_key", cacheKey)
            put("cached_bytes", cachedBytes)
            put("updated_at", now)
            put("payload_json", "{}")
        }
        helper.writableDatabase.insertWithOnConflict(
            TABLE,
            null,
            values,
            android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    fun listRecords(limit: Int = 200): List<CachedPlaybackRecord> {
        val records = mutableListOf<CachedPlaybackRecord>()
        helper.readableDatabase.query(
            TABLE,
            null,
            null,
            null,
            null,
            null,
            "updated_at DESC",
            limit.coerceAtLeast(1).toString(),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val source = cursor.getString(cursor.getColumnIndexOrThrow("source"))
                val type = runCatching { SongType.valueOf(source) }.getOrNull()
                if (type != null && type != SongType.LOCAL) {
                    val sourceId = cursor.getString(cursor.getColumnIndexOrThrow("source_id")).orEmpty()
                    val name = cursor.getString(cursor.getColumnIndexOrThrow("name")).orEmpty()
                    if (sourceId.isNotBlank() && name.isNotBlank()) {
                        records.add(
                            CachedPlaybackRecord(
                                song = SongInfo(
                                    id = sourceId,
                                    type = type,
                                    name = name,
                                    artist = cursor.getString(cursor.getColumnIndexOrThrow("artist")).orEmpty(),
                                    coverUrl = cursor.getString(cursor.getColumnIndexOrThrow("cover_url")).orEmpty(),
                                    album = cursor.getString(cursor.getColumnIndexOrThrow("album")).orEmpty(),
                                    duration = cursor.getInt(cursor.getColumnIndexOrThrow("duration")),
                                ),
                                songKey = cursor.getString(cursor.getColumnIndexOrThrow("song_key")).orEmpty(),
                                qualityKey = cursor.getString(cursor.getColumnIndexOrThrow("quality_key")).orEmpty(),
                                playUrl = cursor.getString(cursor.getColumnIndexOrThrow("play_url")).orEmpty(),
                                cacheKey = cursor.getString(cursor.getColumnIndexOrThrow("cache_key")).orEmpty(),
                                cachedBytes = cursor.getLong(cursor.getColumnIndexOrThrow("cached_bytes")),
                                updatedAt = cursor.getLong(cursor.getColumnIndexOrThrow("updated_at")),
                            ),
                        )
                    }
                }
            }
        }
        return records
    }

    fun clear() {
        helper.writableDatabase.delete(TABLE, null, null)
    }

    companion object {
        const val TABLE = "cached_playback_records"
    }
}
