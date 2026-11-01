package cn.partialy.pm.ui.playlistdetail

import android.widget.ImageView
import cn.partialy.pm.R
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import coil.load
import coil.request.Disposable

/** 每个信息头独立管理请求，Sheet 关闭后不再允许迟到回调重新绑定。 */
class PlaylistCoverRequestBinder(private val view: ImageView) {
    private var request: Disposable? = null
    private var generation = 0
    private var disposed = false

    fun bind(source: SongType?, cover: String) {
        val token = ++generation
        request?.dispose()
        val local = MinePlaylistCoverResolver.localTemplateRes(cover)
            ?: MinePlaylistCoverResolver.localFileForCover(cover)
        if (local != null) {
            request = view.load(local) { placeholder(R.drawable.ic_pm_icon); error(R.drawable.ic_pm_icon) }
        } else {
            loadRemote(requestablePlaylistCoverCandidates(source, cover), 0, token)
        }
    }

    private fun loadRemote(candidates: List<String>, index: Int, token: Int) {
        if (disposed || token != generation) return
        request = view.load(candidates.getOrNull(index)) {
            placeholder(R.drawable.ic_pm_icon)
            error(R.drawable.ic_pm_icon)
            fallback(R.drawable.ic_pm_icon)
            listener(onError = { _, _ ->
                if (index + 1 < candidates.size) view.post { loadRemote(candidates, index + 1, token) }
            })
        }
    }

    fun dispose() {
        disposed = true
        generation++
        request?.dispose()
        request = null
    }
}
