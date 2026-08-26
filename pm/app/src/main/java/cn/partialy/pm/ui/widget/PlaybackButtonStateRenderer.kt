package cn.partialy.pm.ui.widget

import android.animation.ObjectAnimator
import android.view.View
import android.view.animation.LinearInterpolator
import android.widget.ImageView
import androidx.media3.common.Player
import cn.partialy.pm.R

/** 统一渲染播放按钮，并负责缓冲图标旋转动画的生命周期。 */
class PlaybackButtonStateRenderer(
    private val imageView: ImageView,
) {
    private var loadingAnimator: ObjectAnimator? = null
    private var currentIconRes: Int? = null

    fun render(playbackState: Int, isPlaying: Boolean) {
        if (playbackState == Player.STATE_BUFFERING) {
            showLoading()
            return
        }

        stopLoading()
        setIcon(if (isPlaying) R.drawable.ic_pause_24 else R.drawable.ic_play_24)
    }

    fun release() {
        stopLoading()
    }

    private fun showLoading() {
        setIcon(R.drawable.ic_loading_loop_24)
        val animator = loadingAnimator ?: ObjectAnimator.ofFloat(
            imageView,
            View.ROTATION,
            0f,
            360f,
        ).apply {
            duration = 1_500L
            repeatCount = ObjectAnimator.INFINITE
            interpolator = LinearInterpolator()
        }.also { loadingAnimator = it }

        if (!animator.isStarted) animator.start()
    }

    private fun stopLoading() {
        loadingAnimator?.cancel()
        loadingAnimator = null
        imageView.rotation = 0f
    }

    private fun setIcon(iconRes: Int) {
        if (currentIconRes == iconRes) return
        currentIconRes = iconRes
        imageView.setImageResource(iconRes)
    }
}
