package cn.partialy.pm.ui.dialog

import android.app.Dialog
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Handler
import android.os.Looper
import android.view.Window
import android.view.WindowManager
import android.view.animation.Animation
import android.view.animation.LinearInterpolator
import android.view.animation.RotateAnimation
import androidx.activity.ComponentActivity
import androidx.annotation.MainThread
import androidx.core.view.WindowCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import cn.partialy.pm.R
import cn.partialy.pm.databinding.DialogPmLoadingBinding
import cn.partialy.pm.ui.message.PmMessage

/** 独立的阻塞加载层；关闭只释放界面，不取消调用方的业务任务。 */
object PmLoadingDialog {
    const val DEFAULT_TIMEOUT_MS = 15_000L

    class Handle internal constructor(private val dialog: Dialog) {
        val isShowing: Boolean get() = dialog.isShowing

        @MainThread
        fun dismiss() = dialog.dismiss()
    }

    @MainThread
    fun show(
        activity: ComponentActivity,
        message: CharSequence = activity.getText(R.string.pm_loading_message),
        timeoutMs: Long = DEFAULT_TIMEOUT_MS,
    ): Handle {
        require(timeoutMs > 0) { "timeoutMs must be positive" }
        check(!activity.isFinishing && !activity.isDestroyed) { "Loading requires an active activity" }
        val dialog = Dialog(activity)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val binding = DialogPmLoadingBinding.inflate(dialog.layoutInflater)
        binding.loadingMessage.text = message
        dialog.setContentView(binding.root)
        dialog.setCancelable(false)
        dialog.setCanceledOnTouchOutside(false)

        val handler = Handler(Looper.getMainLooper())
        val timeout = Runnable {
            if (dialog.isShowing) {
                dialog.dismiss()
                PmMessage.error(activity, R.string.pm_loading_timeout)
            }
        }
        val rotation = RotateAnimation(
            0f, 360f,
            Animation.RELATIVE_TO_SELF, 0.5f,
            Animation.RELATIVE_TO_SELF, 0.5f,
        ).apply {
            duration = 1_000L
            repeatCount = Animation.INFINITE
            interpolator = LinearInterpolator()
        }
        val observer = object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                if (dialog.isShowing) binding.loadingIcon.startAnimation(rotation)
            }

            override fun onStop(owner: LifecycleOwner) {
                binding.loadingIcon.clearAnimation()
            }

            override fun onDestroy(owner: LifecycleOwner) {
                dialog.dismiss()
            }
        }
        dialog.setOnDismissListener {
            handler.removeCallbacks(timeout)
            binding.loadingIcon.clearAnimation()
            activity.lifecycle.removeObserver(observer)
        }
        dialog.window?.apply {
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
            WindowCompat.setDecorFitsSystemWindows(this, false)
            statusBarColor = Color.TRANSPARENT
            navigationBarColor = Color.TRANSPARENT
            WindowCompat.getInsetsController(this, decorView).apply {
                isAppearanceLightStatusBars = false
                isAppearanceLightNavigationBars = false
            }
        }
        dialog.show()
        dialog.window?.setLayout(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
        )
        activity.lifecycle.addObserver(observer)
        handler.postDelayed(timeout, timeoutMs)
        return Handle(dialog)
    }
}
