package cn.partialy.pm.network.cookie

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class ThirdPartyPlaylistCandidate(
    val source: String,
    val id: String,
    val name: String,
    val intro: String = "",
    val cover: String = "",
    val songCount: Int = 0,
    val updatedAt: Long = 0L,
) {
    fun key(): String = "$source:$id"

    fun toCollectedPlaylist(): CollectedPlaylist {
        val type = when (source.lowercase()) {
            MusicCookieManager.SOURCE_KG -> CollectedPlaylistType.KG
            MusicCookieManager.SOURCE_WY -> CollectedPlaylistType.WY
            else -> error("unsupported candidate source: $source")
        }
        return CollectedPlaylist(
            type = type,
            id = id,
            name = name,
            intro = intro,
            cover = cover,
            count = songCount.coerceAtLeast(0),
        )
    }
}

data class ThirdPartyCandidateSnapshot(
    val items: List<ThirdPartyPlaylistCandidate>,
    val updatedAtBySource: Map<String, Long>,
) {
    fun hasCacheFor(source: String): Boolean = updatedAtBySource.containsKey(source)

    fun hasAnyCache(): Boolean = updatedAtBySource.isNotEmpty() || items.isNotEmpty()
}

/**
 * 三方平台（KG/WY）拉取歌单候选列表的 SQLite 本地缓存。
 * 与 [MusicCookieManager] 同作用域，不绑定 pisamusic 主账号；注销或切换三方账号时清空对应来源缓存。
 */
@Singleton
class ThirdPartyPlaylistCandidateStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val helper = LocalMusicDbOpenHelper.shared(context.applicationContext)
    private val lock = Any()

    fun getAll(): ThirdPartyCandidateSnapshot = synchronized(lock) {
        val db = helper.readableDatabase
        val items = ArrayList<ThirdPartyPlaylistCandidate>()
        db.query(
            TABLE_CANDIDATES,
            arrayOf("source", "playlist_id", "name", "intro", "cover", "song_count", "updated_at"),
            null,
            null,
            null,
            null,
            "CASE source WHEN 'kg' THEN 0 WHEN 'wy' THEN 1 ELSE 2 END ASC, sort_order ASC",
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val source = cursor.getString(0).orEmpty()
                val id = cursor.getString(1).orEmpty()
                val name = cursor.getString(2).orEmpty()
                if (source.isBlank() || id.isBlank() || name.isBlank()) continue
                items.add(
                    ThirdPartyPlaylistCandidate(
                        source = source,
                        id = id,
                        name = name,
                        intro = cursor.getString(3).orEmpty(),
                        cover = cursor.getString(4).orEmpty(),
                        songCount = cursor.getInt(5),
                        updatedAt = cursor.getLong(6),
                    )
                )
            }
        }

        val updatedAtBySource = LinkedHashMap<String, Long>()
        db.query(
            TABLE_META,
            arrayOf("source", "updated_at"),
            null,
            null,
            null,
            null,
            null,
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val source = cursor.getString(0).orEmpty()
                if (source.isNotBlank()) {
                    updatedAtBySource[source] = cursor.getLong(1)
                }
            }
        }
        ThirdPartyCandidateSnapshot(items = items, updatedAtBySource = updatedAtBySource)
    }

    fun replaceSource(
        source: String,
        items: List<ThirdPartyPlaylistCandidate>,
        updatedAt: Long = System.currentTimeMillis(),
    ) {
        val normalized = normalizeSource(source)
        synchronized(lock) {
            val db = helper.writableDatabase
            db.beginTransaction()
            try {
                db.delete(TABLE_CANDIDATES, "source = ?", arrayOf(normalized))
                val seenIds = HashSet<String>()
                var sortOrder = 0
                for (item in items) {
                    if (item.id.isBlank() || item.name.isBlank()) continue
                    if (!seenIds.add(item.id)) continue
                    val values = ContentValues().apply {
                        put("source", normalized)
                        put("playlist_id", item.id)
                        put("name", item.name)
                        put("intro", item.intro)
                        put("cover", item.cover)
                        put("song_count", item.songCount.coerceAtLeast(0))
                        put("sort_order", sortOrder++)
                        put("updated_at", updatedAt)
                    }
                    db.insertWithOnConflict(TABLE_CANDIDATES, null, values, SQLiteDatabase.CONFLICT_REPLACE)
                }
                val metaValues = ContentValues().apply {
                    put("source", normalized)
                    put("updated_at", updatedAt)
                    put("item_count", sortOrder)
                }
                db.insertWithOnConflict(TABLE_META, null, metaValues, SQLiteDatabase.CONFLICT_REPLACE)
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        }
    }

    fun clearSource(source: String) {
        val normalized = normalizeSource(source)
        synchronized(lock) {
            clearSourceInDb(helper.writableDatabase, normalized)
        }
    }

    fun clearAll() {
        synchronized(lock) {
            clearAllInDb(helper.writableDatabase)
        }
    }

    private fun normalizeSource(source: String): String =
        when (source.trim().lowercase()) {
            MusicCookieManager.SOURCE_KG -> MusicCookieManager.SOURCE_KG
            MusicCookieManager.SOURCE_WY -> MusicCookieManager.SOURCE_WY
            else -> error("unsupported candidate source: $source")
        }

    companion object {
        private const val TABLE_CANDIDATES = "third_party_playlist_candidates"
        private const val TABLE_META = "third_party_playlist_cache_meta"

        internal fun clearSourceInDb(db: SQLiteDatabase, normalizedSource: String) {
            db.beginTransaction()
            try {
                db.delete(TABLE_CANDIDATES, "source = ?", arrayOf(normalizedSource))
                db.delete(TABLE_META, "source = ?", arrayOf(normalizedSource))
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        }

        internal fun clearAllInDb(db: SQLiteDatabase) {
            db.beginTransaction()
            try {
                db.delete(TABLE_CANDIDATES, null, null)
                db.delete(TABLE_META, null, null)
                db.setTransactionSuccessful()
            } finally {
                db.endTransaction()
            }
        }
    }
}
