package cn.partialy.pm.ui.player.background

import android.graphics.Rect
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import cn.partialy.pm.databinding.BottomSheetDynamicBackgroundSettingsBinding
import cn.partialy.pm.ui.message.PmMessage
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import kotlin.math.roundToInt

/** 与歌词样式 Sheet 一致：固定标题/预览，先保留底部操作区，余量交给设置列表。 */
internal class DynamicBackgroundSettingsWindow(
    private val activity: ComponentActivity,
    private val dialog: BottomSheetDialog,
    private val binding: BottomSheetDynamicBackgroundSettingsBinding,
    private val preview: PlayerBackgroundController,
) : DefaultLifecycleObserver {
    private var disposed = false
    private var hostVisible = false
    private var previewRunning = false
    private var sheet: FrameLayout? = null
    private val layoutListener = ViewTreeObserver.OnGlobalLayoutListener { updateSize() }

    fun show() {
        activity.lifecycle.addObserver(this)
        dialog.setOnShowListener {
            sheet = dialog.findViewById(com.google.android.material.R.id.design_bottom_sheet)
            sheet?.let {
                it.layoutParams = it.layoutParams.apply { height = ViewGroup.LayoutParams.WRAP_CONTENT }
                BottomSheetBehavior.from(it).apply {
                    skipCollapsed = true
                    state = BottomSheetBehavior.STATE_EXPANDED
                }
            }
            hostVisible = activity.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
            binding.root.viewTreeObserver.addOnGlobalLayoutListener(layoutListener)
            ViewCompat.setOnApplyWindowInsetsListener(binding.root) { _, insets -> updateSize(); insets }
            ViewCompat.requestApplyInsets(binding.root)
            updateSize()
        }
        dialog.setOnDismissListener { dispose() }
        dialog.show()
        PmMessage.register(dialog)
    }

    override fun onStart(owner: LifecycleOwner) { hostVisible = true; updateSize() }
    override fun onStop(owner: LifecycleOwner) { hostVisible = false; setPreviewRunning(false) }
    override fun onDestroy(owner: LifecycleOwner) { dialog.dismiss(); dispose() }

    private fun updateSize() {
        val root = binding.root
        if (disposed || !dialog.isShowing || root.width == 0) return
        val decor = dialog.window?.decorView ?: return
        val frame = Rect()
        decor.getWindowVisibleDisplayFrame(frame)
        val screenHeight = decor.rootView.height.takeIf { it > 0 } ?: activity.resources.displayMetrics.heightPixels
        val available = minOf((screenHeight * .8f).roundToInt(), frame.height()).coerceAtLeast(1)
        val widthSpec = View.MeasureSpec.makeMeasureSpec(root.width, View.MeasureSpec.EXACTLY)
        val freeSpec = View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        binding.backgroundSettingsHeader.measure(widthSpec, freeSpec)
        binding.backgroundSettingsFooter.measure(widthSpec, freeSpec)
        val fixed = root.paddingTop + root.paddingBottom + binding.backgroundSettingsHeader.measuredHeight +
            binding.backgroundSettingsFooter.measuredHeight + (sheet?.paddingTop ?: 0) + (sheet?.paddingBottom ?: 0)
        val density = activity.resources.displayMetrics.density
        val previewHeight = (96 * density).roundToInt()
        val imeVisible = ViewCompat.getRootWindowInsets(root)?.isVisible(WindowInsetsCompat.Type.ime()) == true
        val showPreview = !imeVisible && available - fixed >= previewHeight + (64 * density).roundToInt()
        binding.backgroundPreview.visibility = if (showPreview) View.VISIBLE else View.GONE
        val remaining = (available - fixed - if (showPreview) previewHeight else 0).coerceAtLeast(1)
        val scroll = binding.backgroundSettingsScroll
        scroll.getChildAt(0).measure(widthSpec, freeSpec)
        val scrollHeight = minOf(remaining, scroll.getChildAt(0).measuredHeight)
        if (scroll.layoutParams.height != scrollHeight) {
            scroll.layoutParams = scroll.layoutParams.apply { height = scrollHeight }
        }
        sheet?.let { BottomSheetBehavior.from(it).maxHeight = available }
        setPreviewRunning(hostVisible && showPreview)
    }

    private fun setPreviewRunning(running: Boolean) {
        if (previewRunning == running) return
        previewRunning = running
        if (running) preview.onStart() else preview.onStop()
    }

    private fun dispose() {
        if (disposed) return
        disposed = true
        activity.lifecycle.removeObserver(this)
        if (binding.root.viewTreeObserver.isAlive) binding.root.viewTreeObserver.removeOnGlobalLayoutListener(layoutListener)
        ViewCompat.setOnApplyWindowInsetsListener(binding.root, null)
        preview.release()
        sheet = null
    }
}
