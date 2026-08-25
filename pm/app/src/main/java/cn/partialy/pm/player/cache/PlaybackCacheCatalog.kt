package cn.partialy.pm.player.cache

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 缓存目录的纯值映射。
 *
 * 真实播放 URL 不属于持久化目录，禁止在这里添加源站地址字段。
 */
object PlaybackCacheCatalogValues {

    fun from(
        song: SongInfo,
        identity: PlaybackCacheIdentity,
        nowMillis: Long = System.currentTimeMillis(),
    ): Map<String, Any?> = linkedMapOf(
        "song_key" to legacySongKey(song),
        "source" to identity.source,
        "source_id" to song.id.trim(),
        "quality_key" to identity.qualityKey,
        "name" to song.name,
        "artist" to song.artist,
        "album" to song.album.orEmpty(),
        "cover_url" to song.coverUrl,
        "duration" to song.duration,
        "cache_key" to identity.cacheKey,
        "cached_bytes" to 0L,
        "total_bytes" to 0L,
        "status" to PlaybackCacheStatus.PARTIAL.storageValue,
        "last_accessed_at" to nowMillis,
        "updated_at" to nowMillis,
        "payload_json" to "{}",
    )

    private fun legacySongKey(song: SongInfo): String = "${song.type.name}_${song.id.trim()}"
}

/** 不依赖 Android 的目录候选规则，供 JVM 单测与 SQLite 映射共同复用。 */
object PlaybackCacheCatalogRules {

    fun isReady(status: String?, totalBytes: Long, cachedBytes: Long): Boolean =
        status?.trim()?.equals(PlaybackCacheStatus.READY.storageValue, ignoreCase = true) == true &&
            totalBytes > 0L &&
            cachedBytes == totalBytes
}

/** 仅包含歌曲描述和稳定缓存身份；不包含任何源站 URL。 */
data class PlaybackCacheCatalogCandidate(
    val song: SongInfo,
    val identity: PlaybackCacheIdentity,
    val totalBytes: Long,
    val cachedBytes: Long,
    val status: PlaybackCacheStatus,
    val lastAccessedAt: Long,
    val updatedAt: Long,
)

/**
 * 播放缓存的 SQLite 目录。
 *
 * Media3 仍是真实缓存 Span 的唯一事实来源；目录中的 READY 只能作为待实时复核的候选。
 */
@Singleton
class PlaybackCacheCatalog @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val helper = LocalMusicDbOpenHelper(context)

    /** 播放前登记/刷新歌曲描述，保留已有缓存完整性快照。 */
    fun register(song: SongInfo, identity: PlaybackCacheIdentity) {
        require(song.type != SongType.LOCAL) { "local song must not enter playback cache catalog" }
        require(identity.source == song.type.name.lowercase(Locale.ROOT)) {
            "cache identity source does not match song type"
        }
        require(identity.songId == song.id.trim().lowercase(Locale.ROOT)) {
            "cache identity song id does not match song"
        }

        val mappedValues = PlaybackCacheCatalogValues.from(song, identity)
        val database = helper.writableDatabase
        database.beginTransaction()
        try {
            database.insertWithOnConflict(
                TABLE,
                null,
                mappedValues.toContentValues(),
                SQLiteDatabase.CONFLICT_IGNORE,
            )
            database.update(
                TABLE,
                mappedValues
                    .filterKeys { it in REGISTER_UPDATE_COLUMNS }
                    .toContentValues(),
                "song_key = ? AND quality_key = ?",
                arrayOf(
                    mappedValues.getValue("song_key").toString(),
                    identity.qualityKey,
                ),
            )
            database.setTransactionSuccessful()
        } finally {
            database.endTransaction()
        }
    }

    /** 单条 UPDATE 原子写入实时覆盖快照与访问时间。 */
    fun updateSnapshot(
        cacheKey: String,
        totalBytes: Long,
        cachedBytes: Long,
        status: PlaybackCacheStatus,
    ) {
        if (cacheKey.isBlank()) return
        val safeTotalBytes = totalBytes.coerceAtLeast(0L)
        val safeCachedBytes = cachedBytes.coerceAtLeast(0L)
        val safeStatus = if (
            status == PlaybackCacheStatus.READY &&
            PlaybackCacheCatalogRules.isReady(status.storageValue, safeTotalBytes, safeCachedBytes)
        ) {
            PlaybackCacheStatus.READY
        } else {
            PlaybackCacheStatus.PARTIAL
        }
        val now = System.currentTimeMillis()
        helper.writableDatabase.update(
            TABLE,
            contentValuesOf(
                "cached_bytes" to safeCachedBytes,
                "total_bytes" to safeTotalBytes,
                "status" to safeStatus.storageValue,
                "last_accessed_at" to now,
                "updated_at" to now,
            ),
            "cache_key = ?",
            arrayOf(cacheKey),
        )
    }

    /** 返回待 Media3 实时复核的完整缓存候选，查询投影明确排除旧版 URL 列。 */
    fun listCandidates(limit: Int = 200): List<PlaybackCacheCatalogCandidate> {
        val candidates = mutableListOf<PlaybackCacheCatalogCandidate>()
        helper.readableDatabase.query(
            TABLE,
            CANDIDATE_COLUMNS,
            "status = ? AND total_bytes > 0 AND cached_bytes = total_bytes",
            arrayOf(PlaybackCacheStatus.READY.storageValue),
            null,
            null,
            "last_accessed_at DESC, updated_at DESC",
            limit.coerceIn(1, MAX_CANDIDATES).toString(),
        ).use { cursor ->
            while (cursor.moveToNext()) {
                cursor.toCandidateOrNull()?.let(candidates::add)
            }
        }
        return candidates
    }

    fun clear() {
        helper.writableDatabase.delete(TABLE, null, null)
    }

    private fun Cursor.toCandidateOrNull(): PlaybackCacheCatalogCandidate? {
        val source = nullableString("source").orEmpty()
        val sourceId = nullableString("source_id").orEmpty()
        val qualityKey = nullableString("quality_key").orEmpty()
        val name = nullableString("name").orEmpty()
        if (source.isBlank() || sourceId.isBlank() || qualityKey.isBlank() || name.isBlank()) return null

        val songType = runCatching {
            SongType.valueOf(source.trim().uppercase(Locale.ROOT))
        }.getOrNull()?.takeUnless { it == SongType.LOCAL } ?: return null
        val identity = runCatching {
            CacheIdentity.create(source, sourceId, qualityKey)
        }.getOrNull() ?: return null
        if (nullableString("cache_key") != identity.cacheKey) return null

        val totalBytes = nullableLong("total_bytes") ?: 0L
        val cachedBytes = nullableLong("cached_bytes") ?: 0L
        val storedStatus = nullableString("status")
        if (!PlaybackCacheCatalogRules.isReady(storedStatus, totalBytes, cachedBytes)) return null

        return PlaybackCacheCatalogCandidate(
            song = SongInfo(
                id = sourceId,
                type = songType,
                name = name,
                artist = nullableString("artist").orEmpty(),
                coverUrl = nullableString("cover_url").orEmpty(),
                album = nullableString("album"),
                duration = nullableInt("duration"),
            ),
            identity = identity,
            totalBytes = totalBytes,
            cachedBytes = cachedBytes,
            status = PlaybackCacheStatus.READY,
            lastAccessedAt = nullableLong("last_accessed_at") ?: 0L,
            updatedAt = nullableLong("updated_at") ?: 0L,
        )
    }

    private fun Cursor.nullableString(column: String): String? {
        val index = getColumnIndexOrThrow(column)
        return if (isNull(index)) null else getString(index)
    }

    private fun Cursor.nullableLong(column: String): Long? {
        val index = getColumnIndexOrThrow(column)
        return if (isNull(index)) null else getLong(index)
    }

    private fun Cursor.nullableInt(column: String): Int? {
        val index = getColumnIndexOrThrow(column)
        return if (isNull(index)) null else getInt(index)
    }

    companion object {
        private const val TABLE = "cached_playback_records"
        private const val MAX_CANDIDATES = 1_000
        private val REGISTER_UPDATE_COLUMNS = setOf(
            "source",
            "source_id",
            "name",
            "artist",
            "album",
            "cover_url",
            "duration",
            "cache_key",
            "last_accessed_at",
            "updated_at",
            "payload_json",
        )
        private val CANDIDATE_COLUMNS = arrayOf(
            "source",
            "source_id",
            "quality_key",
            "name",
            "artist",
            "album",
            "cover_url",
            "duration",
            "cache_key",
            "cached_bytes",
            "total_bytes",
            "status",
            "last_accessed_at",
            "updated_at",
        )
    }
}

private val PlaybackCacheStatus.storageValue: String
    get() = name.lowercase(Locale.ROOT)

private fun Map<String, Any?>.toContentValues(): ContentValues = ContentValues(size).apply {
    forEach { (key, value) ->
        when (value) {
            null -> putNull(key)
            is String -> put(key, value)
            is Int -> put(key, value)
            is Long -> put(key, value)
            else -> error("unsupported catalog value for $key: ${value::class.java.name}")
        }
    }
}

private fun contentValuesOf(vararg pairs: Pair<String, Any?>): ContentValues =
    pairs.toMap().toContentValues()
