package cn.partialy.pm.ui.widget

import android.animation.ObjectAnimator
import android.view.View
import android.view.animation.LinearInterpolator
import android.widget.ImageView
import android.widget.TextView
import androidx.core.view.isVisible
import cn.partialy.pm.R

/** 文本操作按钮的统一等待态，复用现有 loading 图标并旋转显示。 */
class LoadingTextButtonRenderer(
    private val button: TextView,
    private val loadingIcon: ImageView,
) {
    private var animator: ObjectAnimator? = null
    private var textBeforeLoading: CharSequence = button.text

    fun setLoading(loading: Boolean) {
        if (loading) {
            if (!loadingIcon.isVisible) textBeforeLoading = button.text
            button.text = ""
            button.isEnabled = false
            loadingIcon.isVisible = true
            val next = animator ?: ObjectAnimator.ofFloat(loadingIcon, View.ROTATION, 0f, 360f).apply {
                duration = 900L
                repeatCount = ObjectAnimator.INFINITE
                interpolator = LinearInterpolator()
            }.also { animator = it }
            if (!next.isStarted) next.start()
        } else {
            animator?.cancel()
            animator = null
            loadingIcon.rotation = 0f
            loadingIcon.isVisible = false
            button.text = textBeforeLoading
            button.isEnabled = true
        }
    }

    fun syncText() {
        if (!loadingIcon.isVisible) textBeforeLoading = button.text
    }

    fun release() = setLoading(false)
}
