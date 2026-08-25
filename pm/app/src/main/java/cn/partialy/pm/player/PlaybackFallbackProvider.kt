package cn.partialy.pm.player

import android.content.Context
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.player.cache.PlaybackMediaCache
import cn.partialy.pm.utils.DownloadManager
import cn.partialy.pm.utils.LocalSongProvider
import cn.partialy.pm.utils.SettingsPrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class PlaybackFallbackList(
    val mode: SettingsPrefs.AutoSwitchListMode,
    val songs: List<SongInfo>,
)

@Singleton
class PlaybackFallbackProvider @Inject constructor(
    @ApplicationContext private val context: Context,
    private val localSongProvider: LocalSongProvider,
    private val playbackMediaCache: PlaybackMediaCache,
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
                PlaybackFallbackList(
                    mode = mode,
                    songs = playbackMediaCache.readySongs(mediaItemFactory::playbackQualityKeyOf),
                )
            }
        }
    }
}
