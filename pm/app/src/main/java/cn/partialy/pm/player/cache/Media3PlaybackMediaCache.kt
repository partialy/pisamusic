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
    private val operationGate = TerminalOperationGate(
        closedMessage = "playback media cache has been shut down",
    )

    override fun mediaItem(song: SongInfo, qualityKey: String): MediaItem =
        operationGate.runOpen {
            val identity = registerInternal(song, qualityKey)
            mediaItemBuilder(song)
                .setUri(identity.logicalUri.toString())
                .setMediaId(mediaIdOf(song))
                .setCustomCacheKey(identity.cacheKey)
                .setTag(PlaybackMediaItemTag(identity.qualityKey))
                .build()
        }

    override fun placeholderMediaItem(song: SongInfo): MediaItem = operationGate.runOpen {
        mediaItemBuilder(song)
            .setUri("$PLACEHOLDER_URI_PREFIX${mediaIdOf(song)}")
            .setMediaId(mediaIdOf(song))
            .build()
    }

    override fun qualityKeyOf(song: SongInfo, mediaItem: MediaItem): String? =
        operationGate.runOpen { qualityKeyOfInternal(song, mediaItem) }

    private fun qualityKeyOfInternal(song: SongInfo, mediaItem: MediaItem): String? {
        if (song.type == SongType.LOCAL) return null
        val configuration = mediaItem.localConfiguration ?: return null
        val logicalCacheKey = LogicalMediaUri.parse(configuration.uri.toString()) ?: return null
        val qualityKey = (configuration.tag as? PlaybackMediaItemTag)?.qualityKey ?: return null
        val identity = runCatching {
            CacheIdentity.create(song.sourceName(), song.id, qualityKey)
        }.getOrNull() ?: return null
        return identity.qualityKey.takeIf {
            identity.cacheKey == logicalCacheKey &&
                identity.cacheKey == configuration.customCacheKey
        }
    }

    override fun mediaSourceFactory(): MediaSource.Factory =
        operationGate.runOpen { cacheStore.mediaSourceFactory(registry) }

    override fun cacheKeyOf(song: SongInfo, qualityKey: String): String =
        operationGate.runOpen {
            CacheIdentity.create(song.sourceName(), song.id, qualityKey).cacheKey
        }

    override fun register(song: SongInfo, qualityKey: String): PlaybackCacheIdentity =
        operationGate.runOpen { registerInternal(song, qualityKey) }

    private fun registerInternal(song: SongInfo, qualityKey: String): PlaybackCacheIdentity {
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

    override fun syncEntry(song: SongInfo, qualityKey: String): PlaybackCacheEntry =
        operationGate.runOpen {
            val identity = registerInternal(song, qualityKey)
            val actual = cacheStore.snapshot(identity.cacheKey)
            catalog.updateSnapshot(
                cacheKey = identity.cacheKey,
                totalBytes = actual.totalBytes,
                cachedBytes = actual.cachedBytes,
                status = actual.status,
            )
            actual.toPlaybackEntry(identity)
        }

    override fun readySongs(
        qualityKeyOf: (SongInfo) -> String,
        limit: Int,
    ): List<SongInfo> = operationGate.runOpen {
        val result = PlaybackCacheReadyCandidateScanner.scan(
            limit = limit.coerceAtMost(MAX_READY_SONGS),
            pageSize = READY_SCAN_PAGE_SIZE,
            loadPage = catalog::listCandidatePage,
            qualityKeyOf = qualityKeyOf,
            snapshotOf = cacheStore::snapshot,
        )
        // 扫描结束后再回写，避免更新时间改变排序或 PARTIAL 行退出查询导致 offset 跳项。
        result.snapshots.forEach { actual ->
            catalog.updateSnapshot(
                cacheKey = actual.cacheKey,
                totalBytes = actual.totalBytes,
                cachedBytes = actual.cachedBytes,
                status = actual.status,
            )
        }
        result.songs
    }

    override fun snapshot(): PlaybackCacheSnapshot =
        operationGate.runOpen { cacheStore.snapshot() }

    override fun clear(): PlaybackCacheSnapshot = operationGate.runOpen {
        val cleared = cacheStore.clear()
        catalog.clear()
        cleared
    }

    override fun release() {
        operationGate.runOpen { cacheStore.release() }
    }

    override fun shutdown() {
        operationGate.shutdown {
            registry.clear()
            cacheStore.release()
        }
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
        private const val READY_SCAN_PAGE_SIZE = 100
        private const val MAX_READY_SONGS = 1_000
    }
}

/** 只跟随进程内 MediaItem 传递实际音质身份，不包含源站 URL。 */
private data class PlaybackMediaItemTag(val qualityKey: String)

internal data class PlaybackCacheReadyScanResult(
    val songs: List<SongInfo>,
    val snapshots: List<Media3CacheResourceSnapshot>,
)

/** 分页执行当前音质身份校验与 Media3 实时完整性复核。 */
internal object PlaybackCacheReadyCandidateScanner {
    fun scan(
        limit: Int,
        pageSize: Int,
        loadPage: (offset: Int, limit: Int) -> PlaybackCacheCatalogPage,
        qualityKeyOf: (SongInfo) -> String,
        snapshotOf: (cacheKey: String) -> Media3CacheResourceSnapshot,
    ): PlaybackCacheReadyScanResult {
        if (limit <= 0) return PlaybackCacheReadyScanResult(emptyList(), emptyList())
        require(pageSize > 0) { "pageSize must be positive" }

        val songs = ArrayList<SongInfo>(limit)
        val snapshots = mutableListOf<Media3CacheResourceSnapshot>()
        var offset = 0
        while (songs.size < limit) {
            val page = loadPage(offset, pageSize)
            for (candidate in page.candidates) {
                if (!PlaybackCacheCatalogRules.isReady(
                        status = candidate.status.name,
                        totalBytes = candidate.totalBytes,
                        cachedBytes = candidate.cachedBytes,
                    )
                ) {
                    continue
                }
                val currentIdentity = runCatching {
                    CacheIdentity.create(
                        candidate.identity.source,
                        candidate.identity.songId,
                        qualityKeyOf(candidate.song),
                    )
                }.getOrNull() ?: continue
                if (currentIdentity.cacheKey != candidate.identity.cacheKey) continue

                val actual = snapshotOf(candidate.identity.cacheKey)
                snapshots += actual
                if (PlaybackCacheCatalogRules.isReady(
                        status = actual.status.name,
                        totalBytes = actual.totalBytes,
                        cachedBytes = actual.cachedBytes,
                    )
                ) {
                    songs += candidate.song
                    if (songs.size == limit) break
                }
            }
            if (songs.size == limit || page.exhausted || page.nextOffset <= offset) break
            offset = page.nextOffset
        }
        return PlaybackCacheReadyScanResult(songs, snapshots)
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
