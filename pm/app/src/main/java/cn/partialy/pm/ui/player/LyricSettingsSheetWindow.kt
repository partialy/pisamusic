package cn.partialy.pm.ui.player

import cn.partialy.pm.ui.message.PmMessage

import android.graphics.Rect
import android.graphics.Typeface
import android.text.StaticLayout
import android.text.TextPaint
import android.util.TypedValue
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowManager
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import cn.partialy.pm.databinding.BottomSheetLyricSettingsBinding
import cn.partialy.pm.utils.LyricDisplayPrefs
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import kotlin.math.roundToInt

/** 固定头部与预览，余下窗口空间只分配给设置列表。 */
internal class LyricSettingsSheetWindow(
    private val activity: ComponentActivity,
    private val dialog: BottomSheetDialog,
    private val binding: BottomSheetLyricSettingsBinding,
    private val preview: LyricPreviewController,
    private val steppers: List<LyricSettingsStepper>,
    private val reload: () -> Unit,
) : DefaultLifecycleObserver {
    private var disposed = false
    private var imeVisible = false
    private var hostVisible = false
    private var compactPreviewHidden = false
    private var bottomSheet: FrameLayout? = null
    private var measuredPreviewKey: Triple<Int, Float, Boolean>? = null
    private var measuredPreviewHeight = 0
    private var measuredPreviewMinimumHeight = 0
    private val layoutListener = ViewTreeObserver.OnGlobalLayoutListener { updateSize() }

    fun show() {
        dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        binding.lyricSettingsClose.setOnClickListener { dialog.dismiss() }
        activity.lifecycle.addObserver(this)
        dialog.setOnShowListener {
            bottomSheet = dialog.findViewById(com.google.android.material.R.id.design_bottom_sheet)
            bottomSheet?.let { sheet ->
                sheet.layoutParams = sheet.layoutParams.apply { height = ViewGroup.LayoutParams.WRAP_CONTENT }
                BottomSheetBehavior.from(sheet).apply {
                    skipCollapsed = true
                    state = BottomSheetBehavior.STATE_EXPANDED
                }
            }
            binding.root.viewTreeObserver.addOnGlobalLayoutListener(layoutListener)
            ViewCompat.setOnApplyWindowInsetsListener(binding.root) { _, insets ->
                setImeVisible(insets.isVisible(WindowInsetsCompat.Type.ime()))
                updateSize()
                insets
            }
            ViewCompat.requestApplyInsets(binding.root)
            hostVisible = activity.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
            updateSize()
            preview.setVisible(hostVisible && !imeVisible && !compactPreviewHidden)
        }
        dialog.setOnDismissListener { dispose() }
        dialog.show()
        PmMessage.register(dialog)
    }

    override fun onResume(owner: LifecycleOwner) {
        if (disposed || !dialog.isShowing) return
        reload()
        hostVisible = true
        updateSize()
        preview.setVisible(!imeVisible && !compactPreviewHidden)
    }

    override fun onStop(owner: LifecycleOwner) {
        hostVisible = false
        steppers.forEach { it.stop(); it.commit() }
        preview.setVisible(false)
    }

    override fun onDestroy(owner: LifecycleOwner) {
        dialog.dismiss()
        dispose()
    }

    private fun setImeVisible(visible: Boolean) {
        if (imeVisible == visible) return
        imeVisible = visible
        binding.lyricSettingsPreview.root.visibility = if (visible || compactPreviewHidden) View.GONE else View.VISIBLE
        steppers.forEach { it.stop() }
        preview.setVisible(hostVisible && !visible && !compactPreviewHidden)
    }

    private fun updateSize() {
        if (disposed || !dialog.isShowing || binding.root.width == 0) return
        val decor = dialog.window?.decorView ?: return
        val visibleFrame = Rect()
        decor.getWindowVisibleDisplayFrame(visibleFrame)
        val insets = ViewCompat.getRootWindowInsets(binding.root)
        setImeVisible(insets?.isVisible(WindowInsetsCompat.Type.ime()) ?: false)
        val screenHeight = decor.rootView.height.takeIf { it > 0 }
            ?: activity.resources.displayMetrics.heightPixels
        // visibleFrame 已扣除系统栏与输入法，不再重复减去 IME inset。
        val available = minOf((screenHeight * 0.8f).roundToInt(), visibleFrame.height()).coerceAtLeast(1)
        val root = binding.root
        val widthSpec = View.MeasureSpec.makeMeasureSpec(root.width - root.paddingLeft - root.paddingRight, View.MeasureSpec.EXACTLY)
        val freeSpec = View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
        binding.lyricSettingsHeader.measure(widthSpec, freeSpec)
        val previewView = binding.lyricSettingsPreview.root
        val previewMargins = previewView.layoutParams as? ViewGroup.MarginLayoutParams
        val preferredHeight = measurePreviewHeight(root.width)
        val headerHeight = root.paddingTop + root.paddingBottom + binding.lyricSettingsHeader.measuredHeight
        val previewMarginHeight = (previewMargins?.topMargin ?: 0) + (previewMargins?.bottomMargin ?: 0)
        val previewBudget = available - headerHeight - previewMarginHeight - (64 * activity.resources.displayMetrics.density).roundToInt()
        val hideForSpace = previewBudget < measuredPreviewMinimumHeight
        if (compactPreviewHidden != hideForSpace) {
            compactPreviewHidden = hideForSpace
            previewView.visibility = if (imeVisible || hideForSpace) View.GONE else View.VISIBLE
            preview.setVisible(hostVisible && !imeVisible && !hideForSpace)
        }
        val desiredPreviewHeight = minOf(preferredHeight, previewBudget).coerceAtLeast(measuredPreviewMinimumHeight)
        if (previewView.layoutParams.height != desiredPreviewHeight) {
            previewView.layoutParams = previewView.layoutParams.apply { height = desiredPreviewHeight }
        }
        val previewHeight = if (imeVisible || compactPreviewHidden) 0 else previewView.layoutParams.height +
            (previewMargins?.topMargin ?: 0) + (previewMargins?.bottomMargin ?: 0)
        val fixedHeight = root.paddingTop + root.paddingBottom + binding.lyricSettingsHeader.measuredHeight + previewHeight
        val scroll = binding.lyricSettingsScroll
        val scrollMargins = scroll.layoutParams as? ViewGroup.MarginLayoutParams
        val remaining = (available - fixedHeight - (scrollMargins?.topMargin ?: 0) -
            (scrollMargins?.bottomMargin ?: 0)).coerceAtLeast(1)
        val content = scroll.getChildAt(0)
        content.measure(widthSpec, freeSpec)
        val scrollHeight = minOf(remaining, content.measuredHeight + scroll.paddingTop + scroll.paddingBottom)
        if (scroll.layoutParams.height != scrollHeight) {
            scroll.layoutParams = scroll.layoutParams.apply { height = scrollHeight }
        }
        bottomSheet?.let { BottomSheetBehavior.from(it).maxHeight = available }
    }

    private fun measurePreviewHeight(sheetWidth: Int): Int {
        val metrics = activity.resources.displayMetrics
        val style = LyricDisplayPrefs.readStyle(activity)
        val sizeSp = style.textSizeSp + if (style.currentLineEnlarged) style.currentLineEnlargedDxSp else 0
        // 普通行走 TextView 的 SP 换算，逐字视图沿用 scaledDensity；取较大值兼容两者。
        val textSizePx = maxOf(
            TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, sizeSp, metrics),
            sizeSp * metrics.scaledDensity,
        )
        val key = Triple(sheetWidth, textSizePx, style.currentLineBold)
        if (measuredPreviewKey == key) return measuredPreviewHeight
        val paint = TextPaint().apply {
            textSize = textSizePx
            typeface = if (style.currentLineBold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        }
        // 16dp 卡片外边距 + 普通歌词行 18dp 内边距，两侧均计入。
        val textWidth = (sheetWidth - 68 * metrics.density).roundToInt().coerceAtLeast(1)
        val textHeight = LyricPreviewSamples.lines.maxOf { line ->
            StaticLayout.Builder.obtain(line.lineText, 0, line.lineText.length, paint, textWidth)
                .setLineSpacing(8 * metrics.density, 1f)
                .setIncludePad(true)
                .build().height
        }
        measuredPreviewKey = key
        measuredPreviewMinimumHeight = textHeight + (24 * metrics.density).roundToInt()
        measuredPreviewHeight = maxOf((96 * metrics.density).roundToInt(), measuredPreviewMinimumHeight)
        return measuredPreviewHeight
    }

    private fun dispose() {
        if (disposed) return
        disposed = true
        steppers.forEach { it.stop(); it.commit() }
        activity.lifecycle.removeObserver(this)
        if (binding.root.viewTreeObserver.isAlive) binding.root.viewTreeObserver.removeOnGlobalLayoutListener(layoutListener)
        ViewCompat.setOnApplyWindowInsetsListener(binding.root, null)
        preview.release()
        bottomSheet = null
    }
}
