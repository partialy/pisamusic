package cn.partialy.pm.player.cache

import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.source.MediaSource
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.utils.SongCoverUrl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/** 播放器只接触该门面，不感知临时 URL、Span 或 SQLite 细节。 */
@Singleton
@UnstableApi
class Media3PlaybackMediaCache @Inject constructor(
    private val registry: OriginUrlRegistry,
    private val cacheStore: Media3CacheStore,
    private val catalog: PlaybackCacheCatalog,
) : PlaybackMediaCache {

    override fun mediaItem(song: SongInfo, qualityKey: String): MediaItem {
        val identity = register(song, qualityKey)
        return mediaItemBuilder(song)
            .setUri(identity.logicalUri.toString())
            .setMediaId(mediaIdOf(song))
            .setCustomCacheKey(identity.cacheKey)
            .build()
    }

    override fun placeholderMediaItem(song: SongInfo): MediaItem = mediaItemBuilder(song)
        .setUri("$PLACEHOLDER_URI_PREFIX${mediaIdOf(song)}")
        .setMediaId(mediaIdOf(song))
        .build()

    override fun mediaSourceFactory(): MediaSource.Factory =
        cacheStore.mediaSourceFactory(registry)

    override fun cacheKeyOf(song: SongInfo, qualityKey: String): String =
        CacheIdentity.create(song.sourceName(), song.id, qualityKey).cacheKey

    override fun register(song: SongInfo, qualityKey: String): PlaybackCacheIdentity {
        require(song.type != SongType.LOCAL) { "local song must not enter playback media cache" }
        val identity = CacheIdentity.create(song.sourceName(), song.id, qualityKey)
        val descriptor = OriginUrlDescriptor(
            song = song,
            qualityKey = identity.qualityKey,
        )
        registry.register(identity.cacheKey, descriptor)
        catalog.register(song, identity)
        return identity
    }

    override fun syncEntry(song: SongInfo, qualityKey: String): PlaybackCacheEntry {
        val identity = register(song, qualityKey)
        val actual = cacheStore.snapshot(identity.cacheKey)
        catalog.updateSnapshot(
            cacheKey = identity.cacheKey,
            totalBytes = actual.totalBytes,
            cachedBytes = actual.cachedBytes,
            status = actual.status,
        )
        return actual.toPlaybackEntry(identity)
    }

    override fun readySongs(
        qualityKeyOf: (SongInfo) -> String,
        limit: Int,
    ): List<SongInfo> = catalog.listCandidates(limit)
        .mapNotNull { candidate ->
            val currentIdentity = runCatching {
                CacheIdentity.create(
                    candidate.identity.source,
                    candidate.identity.songId,
                    qualityKeyOf(candidate.song),
                )
            }.getOrNull() ?: return@mapNotNull null
            if (currentIdentity.cacheKey != candidate.identity.cacheKey) return@mapNotNull null

            val actual = cacheStore.snapshot(candidate.identity.cacheKey)
            catalog.updateSnapshot(
                cacheKey = candidate.identity.cacheKey,
                totalBytes = actual.totalBytes,
                cachedBytes = actual.cachedBytes,
                status = actual.status,
            )
            candidate.song.takeIf { actual.status == PlaybackCacheStatus.READY }
        }

    override fun snapshot(): PlaybackCacheSnapshot = cacheStore.snapshot()

    override fun clear(): PlaybackCacheSnapshot {
        val cleared = cacheStore.clear()
        catalog.clear()
        return cleared
    }

    override fun release() {
        cacheStore.release()
    }

    private fun mediaItemBuilder(song: SongInfo): MediaItem.Builder {
        val metadata = MediaMetadata.Builder()
            .setTitle(song.name)
            .setArtist(song.artist)
            .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
        SongCoverUrl.getSongCover(song, SongCoverUrl.SIZE_XLARGE)
            .takeIf(String::isNotBlank)
            ?.let { metadata.setArtworkUri(android.net.Uri.parse(it)) }
        return MediaItem.Builder().setMediaMetadata(metadata.build())
    }

    private fun mediaIdOf(song: SongInfo): String = "${song.type}_${song.id}"

    private fun SongInfo.sourceName(): String = type.name.lowercase(Locale.ROOT)

    private fun Media3CacheResourceSnapshot.toPlaybackEntry(
        identity: PlaybackCacheIdentity,
    ): PlaybackCacheEntry = PlaybackCacheEntry(
        identity = identity,
        totalBytes = totalBytes,
        cachedBytes = cachedBytes,
        status = status,
    )

    companion object {
        private const val PLACEHOLDER_URI_PREFIX = "pm://placeholder/"
    }
}

@Module
@InstallIn(SingletonComponent::class)
abstract class PlaybackMediaCacheModule {
    @Binds
    @Singleton
    abstract fun bindPlaybackMediaCache(
        implementation: Media3PlaybackMediaCache,
    ): PlaybackMediaCache
}
