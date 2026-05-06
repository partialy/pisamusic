package cn.partialy.pm.player

import android.content.Context
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.utils.SettingsPrefs
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 统一播放控制入口（薄 Facade）。
 * 所有 UI / Service 层通过此类操作播放器，内部委托给 PlaylistManager 和 PlayerEngine。
 */
@UnstableApi
@Singleton
class MusicController @Inject constructor(
    @ApplicationContext private val context: Context,
    playUrlGetter: PlayUrlGetter,
) {
    private val factory = MediaItemFactory(playUrlGetter)
    private val playlistManager = PlaylistManager(factory)
    private val engine: PlayerEngine

    init {
        engine = PlayerEngine(
            context = context,
            playlistManager = playlistManager,
            factory = factory,
            onNext = { next() },
            onPrevious = { previous() },
            onTogglePlayPause = { togglePlayPause() },
        )
        engine.init()
    }

    /** 供 MusicService 通知栏绑定 */
    val exoPlayer: ExoPlayer? get() = engine.exoPlayer
    val mediaSession: MediaSession? get() = engine.mediaSession

    // ==================== 状态（直接转发） ====================

    val currentSong: StateFlow<SongInfo?> get() = playlistManager.currentSong
    val isPlaying: StateFlow<Boolean> get() = engine.isPlaying
    val playList: StateFlow<List<SongInfo>> get() = playlistManager.playList
    val currentIndex: StateFlow<Int> get() = playlistManager.currentIndex
    val progress: StateFlow<Long> get() = engine.progress
    val currentPosition: StateFlow<Long> get() = engine.currentPosition
    val duration: StateFlow<Long> get() = engine.duration
    val playNextQueue: StateFlow<List<SongInfo>> get() = playlistManager.playNextQueue

    // ==================== 播放控制 ====================

    fun togglePlayPause() = engine.togglePlayPause()

    @Suppress("UNUSED_PARAMETER")
    fun next(auto: Boolean = true) = engine.next()

    @Suppress("UNUSED_PARAMETER")
    fun previous(auto: Boolean = true) = engine.previous()

    // ==================== 播放模式 ====================

    fun getPlayMode(): SettingsPrefs.PlayMode = engine.getPlayMode()
    fun togglePlayMode(): SettingsPrefs.PlayMode = engine.togglePlayMode()

    // ==================== 列表操作 ====================

    /**
     * 设置播放列表（占位加载），从 [startIndex] 开始播放。
     * [sourceId] 用于同源检测：同一歌单反复点击不同歌曲时直接 seek，避免重建列表。
     */
    fun setPlayListLazy(songs: List<SongInfo>, startIndex: Int = 0, sourceId: String? = null) {
        val result = playlistManager.setPlayListLazy(songs, startIndex, sourceId)
        if (result == null) {
            val song = songs.getOrNull(startIndex) ?: return
            play(song)
            return
        }
        engine.persistState(force = true)
        engine.ensurePlayableAtIndex(startIndex.coerceIn(0, result.size - 1), autoPlay = true)
    }

    /** 追加歌曲到列表尾部 */
    fun appendSongsLazy(songs: List<SongInfo>) {
        playlistManager.appendSongsLazy(songs)
        engine.persistState(force = true)
    }

    /** 播放单曲：设置为当前歌曲，不在列表则追加到尾部 */
    fun play(songInfo: SongInfo) {
        playlistManager.playSingle(songInfo) { index ->
            engine.ensurePlayableAtIndex(index, autoPlay = true)
            engine.persistState(force = true)
        }
    }

    /** 下一首播放：添加到插播队列（FIFO） */
    fun addPlayNext(songInfo: SongInfo) = playlistManager.addPlayNext(songInfo)

    fun removeFromPlayList(songInfo: SongInfo) = playlistManager.removeFromPlayList(songInfo)

    fun clearPlayList() = playlistManager.clearPlayList(engine.getStateStore())

    // ==================== 进度 ====================

    fun seekToProgress(progress: Int) = engine.seekToProgress(progress)

    fun seekToPositionMs(positionMs: Long) = engine.seekToPositionMs(positionMs)

    // ==================== 生命周期 ====================

    fun release() = engine.release()

    // ==================== 向后兼容 ====================

    /** 等价于 [setPlayListLazy] */
    fun setPlayList(songs: List<SongInfo>) = setPlayListLazy(songs)

    /** 添加到播放列表；autoPlay=true 时等价于 [play] */
    fun addToPlayList(songInfo: SongInfo, autoPlay: Boolean = false) {
        if (autoPlay) play(songInfo) else playlistManager.appendSongsLazy(listOf(songInfo))
    }
}
