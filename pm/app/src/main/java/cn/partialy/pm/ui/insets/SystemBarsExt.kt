package cn.partialy.pm.ui.insets

import android.view.View
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding

fun ComponentActivity.enableEdgeToEdgeSystemBars(
    lightStatusBarIcons: Boolean = true,
    lightNavigationBarIcons: Boolean = true,
) {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    val controller = WindowCompat.getInsetsController(window, window.decorView)
    controller.isAppearanceLightStatusBars = lightStatusBarIcons
    controller.isAppearanceLightNavigationBars = lightNavigationBarIcons
}

fun ViewGroup.applySystemBarsInsets(
    protectIme: Boolean = false,
    onInsetsChanged: (Insets) -> Unit,
) {
    val initialBottomPadding = paddingBottom
    ViewCompat.setOnApplyWindowInsetsListener(this) { _, insets ->
        val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
        if (protectIme) {
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            // 导航栏仍由页面处理，根容器只补足键盘超过导航栏的遮挡高度。
            updatePadding(bottom = initialBottomPadding + (ime.bottom - bars.bottom).coerceAtLeast(0))
        }
        onInsetsChanged(bars)
        insets
    }
    requestApplyInsetsWhenAttached()
}

private fun View.requestApplyInsetsWhenAttached() {
    if (isAttachedToWindow) {
        requestApplyInsets()
    } else {
        addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v: View) {
                v.removeOnAttachStateChangeListener(this)
                v.requestApplyInsets()
            }

            override fun onViewDetachedFromWindow(v: View) = Unit
        })
    }
}
