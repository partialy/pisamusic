package cn.partialy.pm.ui.dialog

import android.app.Activity
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.os.Build
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.SeekBar
import androidx.core.view.isVisible
import cn.partialy.pm.R
import cn.partialy.pm.databinding.BottomSheetColorPickerBinding
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.ui.widget.colorpicker.CheckerboardDrawable
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import java.util.Locale
import kotlin.math.roundToInt

/**
 * 通用原生 HSV / Alpha / Hex BottomSheet 颜色选择器。
 */
object ColorPickerBottomSheet {

    private val QUICK_SWATCH_COLORS = intArrayOf(
        0xFFFFFFFF.toInt(),
        0xFFE2E8F0.toInt(),
        0xFF3B82F6.toInt(),
        0xFF38BDF8.toInt(),
        0xFF22D3EE.toInt(),
        0xFFA855F7.toInt(),
        0xFFEC4899.toInt(),
        0xFFF43F5E.toInt(),
        0xFFF59E0B.toInt(),
        0xFF10B981.toInt(),
    )

    private val HUE_GRADIENT_COLORS = intArrayOf(
        0xFFFF0000.toInt(),
        0xFFFFFF00.toInt(),
        0xFF00FF00.toInt(),
        0xFF00FFFF.toInt(),
        0xFF0000FF.toInt(),
        0xFFFF00FF.toInt(),
        0xFFFF0000.toInt(),
    )

    fun show(
        activity: Activity,
        initialColor: Int,
        allowAlpha: Boolean,
        title: String? = null,
        onConfirm: (Int) -> Unit,
    ) {
        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val binding = BottomSheetColorPickerBinding.inflate(dialog.layoutInflater)
        dialog.setContentView(binding.root)
        @Suppress("DEPRECATION")
        dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        PmMessage.register(dialog)

        binding.colorPickerTitle.text = title ?: activity.getString(R.string.lyric_color_picker_title)
        binding.colorPickerAlphaRow.isVisible = allowAlpha

        val density = activity.resources.displayMetrics.density
        fun dp(value: Float): Int = (value * density).roundToInt()

        val initialHsv = FloatArray(3)
        Color.colorToHSV(initialColor or 0xFF000000.toInt(), initialHsv)
        var currentHue = initialHsv[0]
        var currentSat = initialHsv[1]
        var currentVal = initialHsv[2]
        var currentAlpha = if (allowAlpha) Color.alpha(initialColor) else 255

        fun currentArgb(): Int {
            val rgb = Color.HSVToColor(floatArrayOf(currentHue, currentSat, currentVal)) and 0x00FFFFFF
            val alpha = if (allowAlpha) currentAlpha.coerceIn(0, 255) else 0xFF
            return (alpha shl 24) or rgb
        }

        val hueTrack = SliderPillTrackDrawable(density = density, checkerboard = null) { bounds ->
            LinearGradient(
                bounds.left,
                bounds.centerY(),
                bounds.right,
                bounds.centerY(),
                HUE_GRADIENT_COLORS,
                null,
                Shader.TileMode.CLAMP,
            )
        }
        binding.colorPickerHueSeekBar.progressDrawable = hueTrack

        var alphaOpaqueColor = Color.HSVToColor(floatArrayOf(currentHue, currentSat, currentVal))
        val alphaTrack = SliderPillTrackDrawable(
            density = density,
            checkerboard = CheckerboardDrawable(cellSizePx = 4f * density),
        ) { bounds ->
            val transparent = alphaOpaqueColor and 0x00FFFFFF
            val opaque = (0xFF shl 24) or transparent
            LinearGradient(
                bounds.left,
                bounds.centerY(),
                bounds.right,
                bounds.centerY(),
                transparent,
                opaque,
                Shader.TileMode.CLAMP,
            )
        }
        if (allowAlpha) {
            binding.colorPickerAlphaSeekBar.progressDrawable = alphaTrack
        }

        val previewChecker = CheckerboardDrawable(
            cellSizePx = 5f * density,
            cornerRadiusPx = 12f * density,
        )
        val previewFill = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 12f * density
            setStroke(dp(1f).coerceAtLeast(1), 0x29000000)
        }
        binding.colorPickerPreviewSwatch.background = LayerDrawable(arrayOf(previewChecker, previewFill))

        var syncingHex = false
        var syncingSliders = false
        var hexDirtyInvalid = false

        fun updatePreviewAndAlphaTrack() {
            val argb = currentArgb()
            previewFill.setColor(argb)
            binding.colorPickerRgbaText.text = String.format(
                Locale.US,
                "RGBA(%d, %d, %d, %d)",
                Color.red(argb),
                Color.green(argb),
                Color.blue(argb),
                Color.alpha(argb),
            )
            alphaOpaqueColor = (0xFF shl 24) or (argb and 0x00FFFFFF)
            alphaTrack.invalidateShader()
            binding.colorPickerAlphaSeekBar.invalidate()
        }

        fun syncHexText() {
            syncingHex = true
            hexDirtyInvalid = false
            binding.colorPickerHexInputLayout.error = null
            val formatted = formatHex(currentArgb(), allowAlpha)
            if (binding.colorPickerHexInput.text?.toString() != formatted) {
                binding.colorPickerHexInput.setText(formatted)
                binding.colorPickerHexInput.setSelection(formatted.length)
            }
            syncingHex = false
        }

        fun syncAllControls(updateHex: Boolean = true) {
            syncingSliders = true
            binding.colorPickerSatVal.setHsv(currentHue, currentSat, currentVal)
            binding.colorPickerHueSeekBar.progress = (currentHue * 10f).roundToInt().coerceIn(0, 3600)
            if (allowAlpha) {
                binding.colorPickerAlphaSeekBar.progress = currentAlpha.coerceIn(0, 255)
            }
            syncingSliders = false
            updatePreviewAndAlphaTrack()
            if (updateHex) {
                syncHexText()
            }
        }

        binding.colorPickerSatVal.onSvChanged = { sat, value, fromUser ->
            if (fromUser && !syncingSliders) {
                currentSat = sat
                currentVal = value
                updatePreviewAndAlphaTrack()
                syncHexText()
            }
        }

        binding.colorPickerHueSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                if (!fromUser || syncingSliders) return
                currentHue = (progress / 10f).coerceIn(0f, 360f)
                binding.colorPickerSatVal.setHue(currentHue)
                updatePreviewAndAlphaTrack()
                syncHexText()
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {
                seekBar?.parent?.requestDisallowInterceptTouchEvent(true)
            }

            override fun onStopTrackingTouch(seekBar: SeekBar?) {
                seekBar?.parent?.requestDisallowInterceptTouchEvent(false)
            }
        })

        if (allowAlpha) {
            binding.colorPickerAlphaSeekBar.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    if (!fromUser || syncingSliders) return
                    currentAlpha = progress.coerceIn(0, 255)
                    updatePreviewAndAlphaTrack()
                    syncHexText()
                }

                override fun onStartTrackingTouch(seekBar: SeekBar?) {
                    seekBar?.parent?.requestDisallowInterceptTouchEvent(true)
                }

                override fun onStopTrackingTouch(seekBar: SeekBar?) {
                    seekBar?.parent?.requestDisallowInterceptTouchEvent(false)
                }
            })
        }

        fun applyColorInt(color: Int, updateHex: Boolean) {
            val normalized = if (allowAlpha) color else ((0xFF shl 24) or (color and 0x00FFFFFF))
            val hsv = FloatArray(3)
            Color.colorToHSV((0xFF shl 24) or (normalized and 0x00FFFFFF), hsv)
            if (hsv[1] > 0.001f && hsv[2] > 0.001f) {
                currentHue = hsv[0]
            }
            currentSat = hsv[1]
            currentVal = hsv[2]
            currentAlpha = if (allowAlpha) Color.alpha(normalized) else 255
            syncAllControls(updateHex = updateHex)
        }

        binding.colorPickerHexInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit
            override fun afterTextChanged(s: Editable?) {
                if (syncingHex) return
                val parsed = parseHexColor(s?.toString().orEmpty(), allowAlpha)
                if (parsed != null) {
                    hexDirtyInvalid = false
                    binding.colorPickerHexInputLayout.error = null
                    applyColorInt(parsed, updateHex = false)
                } else {
                    hexDirtyInvalid = !s.isNullOrBlank()
                }
            }
        })

        fun tryCommit(): Boolean {
            val hexText = binding.colorPickerHexInput.text?.toString().orEmpty().trim()
            if (hexDirtyInvalid || (hexText.isNotEmpty() && parseHexColor(hexText, allowAlpha) == null)) {
                binding.colorPickerHexInputLayout.error = activity.getString(R.string.lyric_color_invalid)
                PmMessage.warning(activity, R.string.lyric_color_invalid, dialog = dialog)
                return false
            }
            onConfirm(currentArgb())
            dialog.dismiss()
            return true
        }

        binding.colorPickerHexInput.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                tryCommit()
            } else {
                false
            }
        }

        buildQuickSwatches(
            context = activity,
            container = binding.colorPickerPresetRow,
            density = density,
            onPick = { picked -> applyColorInt(picked, updateHex = true) },
        )

        syncAllControls(updateHex = true)

        binding.colorPickerClose.setOnClickListener { dialog.dismiss() }
        binding.colorPickerCancel.setOnClickListener { dialog.dismiss() }
        binding.colorPickerConfirm.setOnClickListener { tryCommit() }

        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<FrameLayout>(
                com.google.android.material.R.id.design_bottom_sheet,
            )
            bottomSheet?.let { sheet ->
                BottomSheetBehavior.from(sheet).apply {
                    skipCollapsed = true
                    state = BottomSheetBehavior.STATE_EXPANDED
                }
            }
        }
        dialog.show()
    }

    private fun buildQuickSwatches(
        context: Context,
        container: LinearLayout,
        density: Float,
        onPick: (Int) -> Unit,
    ) {
        container.removeAllViews()
        val sizePx = (24f * density).roundToInt()
        val gapPx = (8f * density).roundToInt()
        val strokeWidthPx = (1f * density).roundToInt().coerceAtLeast(1)

        QUICK_SWATCH_COLORS.forEachIndexed { index, color ->
            val dot = View(context).apply {
                layoutParams = LinearLayout.LayoutParams(sizePx, sizePx).apply {
                    if (index > 0) marginStart = gapPx
                }
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(color)
                    setStroke(strokeWidthPx, 0x33000000)
                }
                contentDescription = formatHex(color, allowAlpha = false)
                setOnClickListener { onPick(color) }
            }
            container.addView(dot)
        }
    }

    internal fun formatHex(color: Int, allowAlpha: Boolean): String = if (allowAlpha) {
        String.format(Locale.US, "#%08X", color)
    } else {
        String.format(Locale.US, "#%06X", color and 0x00FFFFFF)
    }

    internal fun parseHexColor(raw: String, allowAlpha: Boolean): Int? {
        val cleaned = raw.trim().removePrefix("#")
        if (cleaned.isEmpty()) return null
        val normalized = when (cleaned.length) {
            3 -> buildString(8) {
                append("FF")
                for (ch in cleaned) {
                    append(ch).append(ch)
                }
            }
            6 -> "FF$cleaned"
            8 -> cleaned
            else -> return null
        }
        val parsedLong = normalized.toLongOrNull(16) ?: return null
        val argb = parsedLong.toInt()
        return if (allowAlpha) argb else ((0xFF shl 24) or (argb and 0x00FFFFFF))
    }

    /**
     * 居中 12dp 高的圆角滑条轨道 Drawable（可选透明棋盘底）。
     */
    private class SliderPillTrackDrawable(
        private val density: Float,
        private val checkerboard: CheckerboardDrawable?,
        private val shaderProvider: (RectF) -> Shader,
    ) : Drawable() {

        private val trackRect = RectF()
        private val clipPath = Path()
        private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
        private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 1f * density
            color = 0x26000000
        }
        private var shaderDirty = true

        fun invalidateShader() {
            shaderDirty = true
            invalidateSelf()
        }

        override fun onBoundsChange(bounds: Rect) {
            super.onBoundsChange(bounds)
            val trackHeight = 12f * density
            val halfH = trackHeight * 0.5f
            val cy = bounds.exactCenterY()
            val inset = 10f * density
            trackRect.set(
                bounds.left + inset,
                cy - halfH,
                (bounds.right - inset).coerceAtLeast(bounds.left + inset + 1f),
                cy + halfH,
            )
            val radius = halfH
            clipPath.reset()
            clipPath.addRoundRect(trackRect, radius, radius, Path.Direction.CW)
            checkerboard?.setBounds(
                trackRect.left.roundToInt(),
                trackRect.top.roundToInt(),
                trackRect.right.roundToInt(),
                trackRect.bottom.roundToInt(),
            )
            shaderDirty = true
        }

        override fun draw(canvas: Canvas) {
            if (trackRect.isEmpty) return
            if (shaderDirty) {
                fillPaint.shader = shaderProvider(trackRect)
                shaderDirty = false
            }
            val save = canvas.save()
            canvas.clipPath(clipPath)
            checkerboard?.draw(canvas)
            canvas.drawRect(trackRect, fillPaint)
            canvas.restoreToCount(save)
            val radius = trackRect.height() * 0.5f
            canvas.drawRoundRect(trackRect, radius, radius, borderPaint)
        }

        override fun setAlpha(alpha: Int) {
            fillPaint.alpha = alpha
            invalidateSelf()
        }

        override fun setColorFilter(colorFilter: ColorFilter?) {
            fillPaint.colorFilter = colorFilter
            invalidateSelf()
        }

        @Deprecated("Deprecated in Java")
        override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
    }
}
