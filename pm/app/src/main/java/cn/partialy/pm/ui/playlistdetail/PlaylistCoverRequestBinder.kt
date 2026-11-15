package cn.partialy.pm.ui.playlistdetail

import android.widget.ImageView
import cn.partialy.pm.R
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import coil.load
import coil.request.Disposable
import kotlinx.coroutines.*

/** 每个信息头独立管理请求，Sheet 关闭后不再允许迟到回调重新绑定。 */
class PlaylistCoverRequestBinder(
    private val view: ImageView,
    private val fallbackRes: Int = R.drawable.default_music_cover,
) {
    private val scope=CoroutineScope(SupervisorJob()+Dispatchers.Main.immediate)
    private var fallbackJob: Job? = null
    private var boundCover=""
    private var request: Disposable? = null
    private var generation = 0
    private var disposed = false

    fun bind(source: SongType?, cover: String) {
        val token = ++generation
        boundCover=cover
        fallbackJob?.cancel()
        request?.dispose()
        val local = MinePlaylistCoverResolver.localTemplateRes(cover)
            ?: MinePlaylistCoverResolver.localFileForCover(cover)
        if (local != null) {
            request = view.load(local) { placeholder(fallbackRes); error(fallbackRes) }
        } else {
            loadRemote(requestablePlaylistCoverCandidates(source, cover), 0, token)
        }
    }

    private fun loadRemote(candidates: List<String>, index: Int, token: Int) {
        if (disposed || token != generation) return
        request = view.load(candidates.getOrNull(index)) {
            placeholder(fallbackRes)
            error(fallbackRes)
            fallback(fallbackRes)
            listener(onError = { _, _ ->
                if (index + 1 < candidates.size) view.post { loadRemote(candidates, index + 1, token) }
                else fallbackJob=scope.launch {
                    val accountGeneration=cn.partialy.pm.network.auth.AccountSessionStore.libraryGeneration
                    val local=withContext(Dispatchers.IO) { MinePlaylistCoverResolver.privateFallback(view.context.applicationContext,boundCover) }
                    if(local!=null && !disposed && token==generation && accountGeneration==cn.partialy.pm.network.auth.AccountSessionStore.libraryGeneration)
                        request=view.load(local) { error(fallbackRes) }
                }
            })
        }
    }

    fun dispose() {
        disposed = true
        scope.cancel()
        generation++
        request?.dispose()
        request = null
    }
}
