package cn.partialy.pm.player.cache

import java.net.URI
import java.security.MessageDigest
import java.util.Locale

/** 构造不受临时播放地址影响的规范化缓存身份。 */
object CacheIdentity {

    fun create(
        source: String,
        songId: String,
        qualityKey: String,
    ): PlaybackCacheIdentity {
        val normalizedSource = normalizeRequired(source, "source")
        val normalizedSongId = normalizeRequired(songId, "songId")
        val normalizedQuality = qualityKey.trim()
            .lowercase(Locale.ROOT)
            .ifBlank { DEFAULT_QUALITY_KEY }
        val canonicalIdentity = listOf(
            normalizedSource,
            normalizedSongId,
            normalizedQuality,
        ).joinToString(separator = CANONICAL_SEPARATOR)
        val cacheKey = canonicalIdentity.sha256()

        return PlaybackCacheIdentity(
            source = normalizedSource,
            songId = normalizedSongId,
            qualityKey = normalizedQuality,
            cacheKey = cacheKey,
            logicalUri = URI.create("$LOGICAL_URI_PREFIX$cacheKey"),
        )
    }

    private fun normalizeRequired(value: String, fieldName: String): String {
        val normalized = value.trim().lowercase(Locale.ROOT)
        require(normalized.isNotBlank()) { "$fieldName must not be blank" }
        return normalized
    }

    private fun String.sha256(): String = MessageDigest
        .getInstance("SHA-256")
        .digest(toByteArray(Charsets.UTF_8))
        .joinToString(separator = "") { byte -> "%02x".format(byte.toInt() and 0xff) }

    private const val DEFAULT_QUALITY_KEY = "default"
    private const val CANONICAL_SEPARATOR = "\u0000"
    const val LOGICAL_URI_PREFIX = "pmcache://media/"
}
