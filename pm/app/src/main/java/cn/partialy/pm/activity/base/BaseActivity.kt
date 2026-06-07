package cn.partialy.pm.activity.base

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.TextUtils
import android.view.Gravity
import android.view.ViewGroup
import android.view.animation.Animation
import android.view.animation.AnimationUtils
import android.widget.FrameLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import cn.partialy.pm.R
import cn.partialy.pm.activity.AppActivityTransitions
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.utils.loveUtil.LoveManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
open class BaseActivity : AppCompatActivity() {

    @Inject
    lateinit var loveManager: LoveManager

    @Inject
    lateinit var musicController: MusicController

    private val messageHandler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
    }

    fun showMessage(content: String, durationMs: Long = 2000L): () -> Unit {
        val container = findViewById<ViewGroup>(android.R.id.content) ?: return {}
        val density = resources.displayMetrics.density
        val horizontalPadding = (20 * density).toInt()
        val verticalPadding = (10 * density).toInt()
        val maxMessageWidth = minOf(
            (280 * density).toInt(),
            resources.displayMetrics.widthPixels - (48 * density).toInt()
        )

        val capsuleView = TextView(this).apply {
            text = content
            setTextColor(0xFFFFFFFF.toInt())
            textSize = 14f
            includeFontPadding = false
            gravity = Gravity.CENTER
            setBackgroundResource(R.drawable.bg_capsule_message)
            setPadding(horizontalPadding, verticalPadding, horizontalPadding, verticalPadding)
            maxWidth = maxMessageWidth
            ellipsize = TextUtils.TruncateAt.END
            isSingleLine = true
        }

        val layoutParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
            topMargin = (resources.displayMetrics.heightPixels * 0.25f).toInt()
        }

        container.addView(capsuleView, layoutParams)
        capsuleView.startAnimation(AnimationUtils.loadAnimation(this, R.anim.capsule_message_enter))

        var isDismissed = false
        var autoDismissRunnable: Runnable? = null

        fun dismiss() {
            if (isDismissed) return
            isDismissed = true
            autoDismissRunnable?.let { messageHandler.removeCallbacks(it) }

            val exitAnim = AnimationUtils.loadAnimation(this, R.anim.capsule_message_exit)
            exitAnim.setAnimationListener(object : Animation.AnimationListener {
                override fun onAnimationStart(animation: Animation?) = Unit
                override fun onAnimationRepeat(animation: Animation?) = Unit

                override fun onAnimationEnd(animation: Animation?) {
                    if (capsuleView.parent === container) {
                        container.removeView(capsuleView)
                    }
                }
            })
            capsuleView.clearAnimation()
            capsuleView.startAnimation(exitAnim)
        }

        val close: () -> Unit = {
            if (Looper.myLooper() == Looper.getMainLooper()) {
                dismiss()
            } else {
                messageHandler.post { dismiss() }
            }
        }

        if (durationMs > 0L) {
            autoDismissRunnable = Runnable { close() }
            messageHandler.postDelayed(autoDismissRunnable, durationMs)
        }

        return close
    }

    protected open val defaultActivityTransitionEnabled: Boolean = true

    override fun finish() {
        super.finish()
        if (defaultActivityTransitionEnabled) {
            AppActivityTransitions.applyBack(this)
        }
    }

    override fun onDestroy() {
        messageHandler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }
}
