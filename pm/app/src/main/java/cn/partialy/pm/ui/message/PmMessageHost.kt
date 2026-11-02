package cn.partialy.pm.ui.message

import android.animation.ValueAnimator
import android.app.Activity
import android.app.Application
import android.app.Dialog
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowManager
import android.view.accessibility.AccessibilityManager
import android.view.animation.Animation
import android.view.animation.AnimationUtils
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import cn.partialy.pm.R
import java.lang.ref.WeakReference

/** 全局仅弱引用窗口宿主；真实 Overlay 由 Activity decor 持有并随窗口释放。 */
internal object PmMessageHost {
    private val main = Handler(Looper.getMainLooper())
    private var initialized = false
    private var foreground = WeakReference<Activity>(null)
    private var active = WeakReference<Overlay>(null)
    private val dialogs = mutableListOf<WeakReference<Dialog>>()

    fun onMain(action: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) action() else main.post(action)
    }

    fun init(application: Application) {
        if (initialized) return
        initialized = true
        application.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) { foreground = WeakReference(activity) }
            override fun onActivityPaused(activity: Activity) {
                if (foreground.get() === activity) foreground.clear()
                (activity.window.decorView.getTag(R.id.pm_message_host) as? Overlay)?.remove()
            }
            override fun onActivityDestroyed(activity: Activity) {
                (activity.window.decorView.getTag(R.id.pm_message_host) as? Overlay)?.remove()
            }
            override fun onActivityCreated(activity: Activity, state: Bundle?) = Unit
            override fun onActivityStarted(activity: Activity) = Unit
            override fun onActivityStopped(activity: Activity) = Unit
            override fun onActivitySaveInstanceState(activity: Activity, state: Bundle) = Unit
        })
    }

    fun register(dialog: Dialog) = onMain {
        if (!dialog.isShowing) return@onMain
        val decor = dialog.window?.decorView ?: return@onMain
        if (dialogs.any { it.get() === dialog }) return@onMain
        val ref = WeakReference(dialog)
        dialogs.add(ref)
        decor.addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(view: View) = Unit
            override fun onViewDetachedFromWindow(view: View) {
                ref.get()?.let { unregister(it) }
                view.removeOnAttachStateChangeListener(this)
            }
        })
        // 新弹窗出现时不把旧消息留在其下面，也不重置原消息截止时间。
        active.get()?.remove()
    }

    fun unregister(dialog: Dialog) = onMain {
        dialogs.removeAll { it.get() == null || it.get() === dialog }
        if (active.get()?.dialog?.get() === dialog) active.get()?.remove()
    }

    fun dismiss(id: Long) = onMain { active.get()?.takeIf { it.id == id }?.dismiss() }

    fun show(activity: Activity, type: MessageType, text: String, durationMs: Long, explicit: Dialog?, handle: MessageHandle, fragmentView: View? = null) {
        if (handle.dismissed.get() || text.isBlank() || foreground.get() !== activity || activity.isFinishing || activity.isDestroyed) return
        if (fragmentView != null && !fragmentView.isAttachedToWindow) return
        dialogs.removeAll { it.get()?.isShowing != true }
        val dialog = explicit?.takeIf { it.isShowing && it.window?.decorView?.isAttachedToWindow == true && (it.ownerActivity === activity || findActivity(it.context) === activity) }
            ?: dialogs.asReversed().firstNotNullOfOrNull { it.get()?.takeIf { value -> value.ownerActivity === activity || findActivity(value.context) === activity } }
        val hostView = dialog?.window?.decorView ?: activity.window.decorView
        if (!hostView.isAttachedToWindow || hostView.windowToken == null) return
        val old = active.get()
        val now = SystemClock.uptimeMillis()
        if (old != null) {
            if (old.activity === activity && old.dialog.get() === dialog && old.type == type && old.text == text && now - old.createdAt < 800) return
            if (type.priority < old.type.priority) return
            old.remove()
        }
        val overlay = Overlay(activity, dialog, hostView, handle.id, type, text, now, fragmentView)
        if (overlay.attach(durationMs)) {
            activity.window.decorView.setTag(R.id.pm_message_host, overlay)
            active = WeakReference(overlay)
        }
    }

    private fun findActivity(context: android.content.Context): Activity? {
        var current = context
        while (current is android.content.ContextWrapper) {
            if (current is Activity) return current
            val base = current.baseContext
            if (base === current) break
            current = base
        }
        return current as? Activity
    }

    private class Overlay(
        val activity: Activity, ownerDialog: Dialog?, private val hostView: View,
        val id: Long, val type: MessageType, val text: String, val createdAt: Long, fragmentView: View?,
    ) {
        val dialog = WeakReference(ownerDialog)
        private val fragmentView = WeakReference(fragmentView)
        private val manager = activity.getSystemService(WindowManager::class.java)
        private val root = FrameLayout(activity)
        private val capsule = LinearLayout(activity)
        private var removed = false
        private var exiting = false
        private val timeout = Runnable { dismiss() }
        private val layoutListener = ViewTreeObserver.OnGlobalLayoutListener { position() }
        private val detachListener = object : View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(view: View) = Unit
            override fun onViewDetachedFromWindow(view: View) { remove() }
        }
        private fun dp(value: Int) = (value * activity.resources.displayMetrics.density + .5f).toInt()

        fun attach(duration: Long): Boolean {
            capsule.orientation = LinearLayout.HORIZONTAL
            capsule.gravity = Gravity.CENTER_VERTICAL
            capsule.setPadding(dp(20), dp(10), dp(20), dp(10))
            capsule.setBackgroundResource(R.drawable.bg_capsule_message)
            capsule.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            capsule.accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
            val icon = ImageView(activity).apply {
                setImageResource(type.icon)
                imageTintList = android.content.res.ColorStateList.valueOf(ContextCompat.getColor(activity, type.tint))
                importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            capsule.addView(icon, LinearLayout.LayoutParams(dp(24), dp(24)))
            val label = TextView(activity).apply {
                this.text = this@Overlay.text
                setTextColor(Color.WHITE)
                textSize = 14f
                maxLines = 3
                ellipsize = android.text.TextUtils.TruncateAt.END
            }
            capsule.addView(label, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { marginStart = dp(8) })
            root.addView(capsule, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT))
            val params = WindowManager.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_PANEL,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                PixelFormat.TRANSLUCENT,
            ).apply {
                token = hostView.windowToken
                gravity = Gravity.TOP or Gravity.START
                softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
                if (Build.VERSION.SDK_INT >= 30) setFitInsetsTypes(0)
                setTitle("PmMessage")
            }
            try { manager.addView(root, params) } catch (_: WindowManager.BadTokenException) { return false } catch (_: IllegalArgumentException) { return false } catch (_: SecurityException) { return false }
            hostView.viewTreeObserver.addOnGlobalLayoutListener(layoutListener)
            hostView.addOnAttachStateChangeListener(detachListener)
            fragmentView.get()?.addOnAttachStateChangeListener(detachListener)
            root.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ -> position() }
            ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets -> root.post { position() }; insets }
            root.post { position() }
            if (ValueAnimator.areAnimatorsEnabled()) capsule.startAnimation(AnimationUtils.loadAnimation(activity, R.anim.capsule_message_enter))
            // live region 只在首次附加时播报；去重分支不重新附加。
            if (duration > 0) {
                val accessibility = activity.getSystemService(AccessibilityManager::class.java)
                val adjusted = accessibility.getRecommendedTimeoutMillis(duration.coerceAtMost(Int.MAX_VALUE.toLong()).toInt(), AccessibilityManager.FLAG_CONTENT_TEXT or AccessibilityManager.FLAG_CONTENT_ICONS)
                main.postDelayed(timeout, maxOf(duration, adjusted.toLong()))
            }
            return true
        }

        private fun position() {
            if (removed || !root.isAttachedToWindow) return
            val decor = activity.window.decorView
            val visible = Rect()
            decor.getWindowVisibleDisplayFrame(visible)
            val location = IntArray(2)
            // 完整 Panel 坐标统一扣除遮挡，避免 adjustResize 后重复扣减 IME。
            root.getLocationOnScreen(location)
            val bounds = Rect(location[0], location[1], location[0] + root.width, location[1] + root.height)
            val insets = ViewCompat.getRootWindowInsets(root)?.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime(),
            )
            if (insets != null) {
                bounds.left += insets.left; bounds.top += insets.top
                bounds.right -= insets.right; bounds.bottom -= insets.bottom
            }
            if (bounds.isEmpty || (!visible.isEmpty && !bounds.intersect(visible))) return
            val available = (bounds.width() - dp(48)).coerceAtLeast(1)
            val width = minOf(dp(300), available)
            val label = capsule.getChildAt(1) as TextView
            val labelWidth = (width - dp(72)).coerceAtLeast(1)
            if (label.maxWidth != labelWidth) label.maxWidth = labelWidth
            capsule.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.AT_MOST), View.MeasureSpec.makeMeasureSpec(bounds.height().coerceAtLeast(1), View.MeasureSpec.AT_MOST))
            val params = capsule.layoutParams as FrameLayout.LayoutParams
            val left = bounds.centerX() - location[0] - capsule.measuredWidth / 2
            // 提示中心位于可见安全区域顶部起的 33%；IME/系统栏裁剪与边界检查保持生效。
            val targetCenterY = bounds.top + (bounds.height() * 0.33f).toInt()
            val topOnScreen = (targetCenterY - capsule.measuredHeight / 2)
                .coerceIn(bounds.top, (bounds.bottom - capsule.measuredHeight).coerceAtLeast(bounds.top))
            val top = topOnScreen - location[1]
            if (params.width != capsule.measuredWidth || params.leftMargin != left || params.topMargin != top) {
                params.width = capsule.measuredWidth; params.leftMargin = left; params.topMargin = top
                capsule.layoutParams = params
            }
        }

        fun dismiss() {
            if (removed || exiting) return
            exiting = true
            main.removeCallbacks(timeout)
            if (!ValueAnimator.areAnimatorsEnabled()) { remove(); return }
            capsule.clearAnimation()
            val animation = AnimationUtils.loadAnimation(activity, R.anim.capsule_message_exit)
            animation.setAnimationListener(object : Animation.AnimationListener {
                override fun onAnimationStart(animation: Animation?) = Unit
                override fun onAnimationRepeat(animation: Animation?) = Unit
                override fun onAnimationEnd(animation: Animation?) { remove() }
            })
            capsule.startAnimation(animation)
        }

        fun remove() {
            if (removed) return
            removed = true
            main.removeCallbacks(timeout)
            capsule.clearAnimation()
            if (hostView.viewTreeObserver.isAlive) hostView.viewTreeObserver.removeOnGlobalLayoutListener(layoutListener)
            hostView.removeOnAttachStateChangeListener(detachListener)
            fragmentView.get()?.removeOnAttachStateChangeListener(detachListener)
            fragmentView.clear()
            if (activity.window.decorView.getTag(R.id.pm_message_host) === this) activity.window.decorView.setTag(R.id.pm_message_host, null)
            if (active.get() === this) active.clear()
            try { manager.removeViewImmediate(root) } catch (_: IllegalArgumentException) { /* 窗口可能已随宿主移除。 */ }
        }
    }
}
