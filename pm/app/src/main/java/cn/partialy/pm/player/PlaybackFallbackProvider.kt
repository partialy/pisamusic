package cn.partialy.pm.player

import android.content.Context
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.utils.DownloadManager
import cn.partialy.pm.utils.LocalSongProvider
import cn.partialy.pm.utils.SettingsPrefs
import cn.partialy.pm.utils.localdata.CachedPlaybackRecord
import cn.partialy.pm.utils.localdata.CachedPlaybackStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class PlaybackFallbackList(
    val mode: SettingsPrefs.AutoSwitchListMode,
    val songs: List<SongInfo>,
    val cachedRecords: List<CachedPlaybackRecord> = emptyList(),
)

@Singleton
class PlaybackFallbackProvider @Inject constructor(
    @ApplicationContext private val context: Context,
    private val localSongProvider: LocalSongProvider,
    private val cachedPlaybackStore: CachedPlaybackStore,
) {
    fun load(
        mode: SettingsPrefs.AutoSwitchListMode,
        mediaItemFactory: MediaItemFactory,
    ): PlaybackFallbackList {
        return when (mode) {
            SettingsPrefs.AutoSwitchListMode.Off -> PlaybackFallbackList(mode, emptyList())
            SettingsPrefs.AutoSwitchListMode.Local -> PlaybackFallbackList(
                mode = mode,
                songs = localSongProvider.queryLocalSongs(),
            )
            SettingsPrefs.AutoSwitchListMode.Downloaded -> PlaybackFallbackList(
                mode = mode,
                songs = DownloadManager.getInstance(context).getDownloadedFiles(),
            )
            SettingsPrefs.AutoSwitchListMode.Cached -> {
                val records = cachedPlaybackStore.listRecords()
                    .filter { it.qualityKey == mediaItemFactory.playbackQualityKeyOf(it.song) }
                    .filter { it.playUrl.isNotBlank() && it.cacheKey.isNotBlank() && it.cachedBytes > 0L }
                    .filter { PlayerCacheProvider.cachedBytes(context, it.cacheKey) > 0L }
                PlaybackFallbackList(
                    mode = mode,
                    songs = records.map { it.song },
                    cachedRecords = records,
                )
            }
        }
    }
}
