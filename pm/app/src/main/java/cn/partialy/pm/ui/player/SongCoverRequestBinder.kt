package cn.partialy.pm.ui.player

import android.graphics.drawable.Drawable
import android.widget.ImageView
import androidx.appcompat.content.res.AppCompatResources
import cn.partialy.pm.R
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.utils.SongCoverUrl
import coil.load
import coil.request.Disposable
import coil.target.ImageViewTarget

/** 与歌单封面一致使用候选请求及代次守卫，快速切歌不允许旧回退覆盖新封面。 */
internal class SongCoverRequestBinder(
    private val view: ImageView,
    private val onArtworkChanged: (Drawable?) -> Unit,
) {
    private var request: Disposable? = null
    private var generation = 0
    private var disposed = false

    fun bind(song: SongInfo?, crossfade: Boolean) {
        if (disposed) return
        val token = ++generation
        request?.dispose()
        val candidates = song?.let(SongCoverUrl::getPlayerCoverCandidates).orEmpty()
        if (candidates.isEmpty()) {
            showFallback(token)
        } else {
            if (view.drawable == null) showFallback(token)
            load(candidates, 0, token, crossfade)
        }
    }

    private fun load(candidates: List<Any>, index: Int, token: Int, crossfade: Boolean) {
        if (disposed || token != generation) return
        request = view.load(candidates[index]) {
            // 请求开始和中间候选失败时均保留当前封面，成功后才替换；CD 同步接收最终原图。
            target(object : ImageViewTarget(view) {
                override fun onStart(placeholder: Drawable?) = Unit
                override fun onError(error: Drawable?) = Unit
                override fun onSuccess(result: Drawable) {
                    if (!disposed && token == generation) super.onSuccess(result)
                }
            })
            // 播放封面经过圆角遮罩，保持各设备采用一致的位图绘制路径。
            allowHardware(false)
            crossfade(crossfade)
            listener(
                onSuccess = { _, result ->
                    if (!disposed && token == generation) onArtworkChanged(result.drawable)
                },
                onError = { _, _ ->
                    if (!disposed && token == generation) {
                        if (index + 1 < candidates.size) {
                            view.post { load(candidates, index + 1, token, crossfade) }
                        } else {
                            showFallback(token)
                        }
                    }
                },
            )
        }
    }

    private fun showFallback(token: Int) {
        if (disposed || token != generation) return
        val drawable = AppCompatResources.getDrawable(view.context, R.drawable.default_music_cover)
        view.setImageDrawable(drawable)
        onArtworkChanged(drawable)
    }

    fun dispose() {
        disposed = true
        generation++
        request?.dispose()
        request = null
    }
}
