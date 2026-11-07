package cn.partialy.pm.ui.player

import android.widget.ImageView
import cn.partialy.pm.R
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.utils.SongCoverUrl
import coil.load
import coil.request.Disposable

/** 与歌单封面一致使用候选请求及代次守卫，快速切歌不允许旧回退覆盖新封面。 */
internal class SongCoverRequestBinder(private val view: ImageView) {
    private var request: Disposable? = null
    private var generation = 0
    private var disposed = false

    fun bind(song: SongInfo?, crossfade: Boolean) {
        val token = ++generation
        request?.dispose()
        load(song?.let(SongCoverUrl::getPlayerCoverCandidates).orEmpty(), 0, token, crossfade)
    }

    private fun load(candidates: List<Any>, index: Int, token: Int, crossfade: Boolean) {
        if (disposed || token != generation) return
        request = view.load(candidates.getOrNull(index)) {
            placeholder(R.drawable.ic_pm_icon)
            error(R.drawable.ic_pm_icon)
            fallback(R.drawable.ic_pm_icon)
            // 播放封面经过圆角遮罩，保持各设备采用一致的位图绘制路径。
            allowHardware(false)
            crossfade(crossfade)
            listener(onError = { _, _ ->
                if (index + 1 < candidates.size) view.post { load(candidates, index + 1, token, crossfade) }
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
