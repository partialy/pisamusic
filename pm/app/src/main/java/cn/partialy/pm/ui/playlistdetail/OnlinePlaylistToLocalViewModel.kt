package cn.partialy.pm.ui.playlistdetail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

enum class PlaylistConversionStage { IDLE, CONFIRMING, LOADING, SAVING, SUCCESS, FAILED }

data class PlaylistConversionState(
    val stage: PlaylistConversionStage = PlaylistConversionStage.IDLE,
    val readCount: Int = 0,
    val skippedCount: Int = 0,
    val createdId: String? = null,
    val songCount: Int = 0,
)

/** 会话仅存在 ViewModel 内，不把整首列表放入 Intent/SavedState；进程重建不会自动重提。 */
@HiltViewModel
class OnlinePlaylistToLocalViewModel @Inject constructor(
    private val loader: OnlinePlaylistBatchTrackLoader,
    private val manager: PlaylistCollectionManager,
) : ViewModel() {
    private val mutableState = MutableStateFlow(PlaylistConversionState())
    val state = mutableState.asStateFlow()
    private var playlist: CanonicalPlaylist? = null
    private var initial = emptyList<SongInfo>()
    private var job: Job? = null

    fun request(playlist: CanonicalPlaylist, initial: List<SongInfo>) {
        if (mutableState.value.stage != PlaylistConversionStage.IDLE) return
        if (playlist.id.isBlank() || playlist.source.lowercase() !in listOf("kg", "wy")) return
        this.playlist = playlist.copy()
        this.initial = initial.map { it.copy() }
        mutableState.value = PlaylistConversionState(PlaylistConversionStage.CONFIRMING)
    }

    fun confirm() {
        if (mutableState.value.stage != PlaylistConversionStage.CONFIRMING) return
        val metadata = playlist ?: return
        val seed = initial
        val source = SongType.valueOf(metadata.source.uppercase())
        // 主线程同步切换状态即为提交门禁，重复点击和新订阅不会启动第二个任务。
        mutableState.value = PlaylistConversionState(PlaylistConversionStage.LOADING)
        job = viewModelScope.launch {
            try {
                var result: OnlinePlaylistLoadState? = null
                loader.load(source, metadata.id, metadata.song_count, seed) { loaded ->
                    withContext(Dispatchers.Main.immediate) {
                        result = loaded
                        mutableState.value = PlaylistConversionState(PlaylistConversionStage.LOADING,
                            loaded.readCount, loaded.skippedCount)
                    }
                }
                ensureActive()
                val complete = result?.takeIf { it.complete && !it.failed }
                    ?: error("Playlist was not completely loaded")
                check(complete.readCount == 0 || complete.songs.isNotEmpty()) {
                    "Nonempty source contained no valid song identifiers"
                }
                mutableState.value = PlaylistConversionState(PlaylistConversionStage.SAVING,
                    complete.readCount, complete.skippedCount)
                // SQLite 事务很短，进入保存后必须完成，离页/旋转不得留下未知提交状态。
                withContext(NonCancellable + Dispatchers.IO) {
                    val id = manager.createLocalPlaylistWithSongs(metadata.name, complete.songs,
                        metadata.desc, rawRemotePlaylistCoverOrNull(source, metadata.cover).orEmpty())
                    mutableState.value = PlaylistConversionState(PlaylistConversionStage.SUCCESS,
                        complete.readCount, complete.skippedCount, id, complete.songs.size)
                }
            } catch (cancel: CancellationException) {
                throw cancel
            } catch (_: Exception) {
                mutableState.value = mutableState.value.copy(stage = PlaylistConversionStage.FAILED)
            }
        }
    }

    fun cancel() {
        if (mutableState.value.stage !in listOf(PlaylistConversionStage.CONFIRMING, PlaylistConversionStage.LOADING)) return
        job?.cancel()
        reset()
    }

    /** 主线程消费终态后再导航，旋转后的新 observer 不会再次打开详情。 */
    fun consumeResult(): PlaylistConversionState? {
        val result = mutableState.value
        if (result.stage !in listOf(PlaylistConversionStage.SUCCESS, PlaylistConversionStage.FAILED)) return null
        reset()
        return result
    }

    private fun reset() {
        playlist = null
        initial = emptyList()
        mutableState.value = PlaylistConversionState()
    }
}
