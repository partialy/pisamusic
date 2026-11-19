package cn.partialy.pm.ui.player.lyricstyle

import android.graphics.Color
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.appcompat.view.ContextThemeWrapper
import androidx.core.content.ContextCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import cn.partialy.pm.R
import cn.partialy.pm.activity.LyricColorPresetsActivity
import cn.partialy.pm.databinding.BottomSheetLyricStyleParamsBinding
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.ui.player.LyricPreviewController
import cn.partialy.pm.ui.widget.PmSwitch
import cn.partialy.pm.utils.LyricDisplayPrefs
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import java.util.Locale
import kotlin.math.roundToInt

/**
 * 歌词特效专属参数二级 Sheet：
 * 复用歌词设置 Sheet 视觉壳层、实时预览、圆形色板、PmSwitch 与细滑轨 SeekBar。
 */
internal object LyricStyleParamsBottomSheet {

    fun show(
        activity: ComponentActivity,
        styleId: LyricEffectStyleId,
        onChanged: () -> Unit,
        onDismissed: () -> Unit,
    ) {
        if (styleId == LyricEffectStyleId.DEFAULT) {
            onDismissed()
            return
        }

        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val binding = BottomSheetLyricStyleParamsBinding.inflate(dialog.layoutInflater)
        dialog.setContentView(binding.root)

        val styleName = LyricStyleParamsMeta.styleLabel(activity, styleId)
        binding.styleParamsTitle.text = activity.getString(R.string.lyric_settings_style_params_title, styleName)

        val preview = LyricPreviewController(
            binding.styleParamsPreview.previewNormalLyrics,
            binding.styleParamsPreview.previewKaraokeLyrics,
        )

        val density = activity.resources.displayMetrics.density
        fun dp(value: Float): Int = (value * density).roundToInt()

        val colorPrimary = resolveThemeColor(activity, androidx.appcompat.R.attr.colorPrimary)
        val colorOnSurface = resolveThemeColor(activity, com.google.android.material.R.attr.colorOnSurface)
        val colorOnSurfaceVariant = resolveThemeColor(activity, com.google.android.material.R.attr.colorOnSurfaceVariant)
        val selectedStrokeColor = ContextCompat.getColor(activity, R.color.blue_selected)

        fun applyPreviewAndNotify(config: LyricEffectConfig) {
            preview.applyStyle(
                style = LyricDisplayPrefs.readStyle(activity),
                useWordLyrics = LyricDisplayPrefs.isUseWordLyricEnabled(activity),
                effectConfig = config,
            )
            onChanged()
        }

        fun updateConfig(transform: (LyricEffectConfig) -> LyricEffectConfig) {
            val updated = LyricEffectConfigRepository.update(activity, transform)
            applyPreviewAndNotify(updated)
        }

        fun addSwitchRow(
            container: LinearLayout,
            titleRes: Int,
            checked: Boolean,
            onToggle: (Boolean) -> Unit,
        ) {
            val sw = PmSwitch(ContextThemeWrapper(activity, R.style.Widget_Pm_SettingsSwitch)).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
                minimumHeight = dp(48f)
                text = activity.getString(titleRes)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                setTextColor(colorOnSurface)
                isChecked = checked
                setOnCheckedChangeListener { _, isChecked -> onToggle(isChecked) }
            }
            container.addView(sw)
        }

        fun addSliderRow(
            container: LinearLayout,
            titleRes: Int,
            steps: Int,
            initialStep: Int,
            formatValue: (Int) -> String,
            onStepChanged: (Int) -> Unit,
        ) {
            val topMargin = if (container.childCount == 0) 0 else dp(12f)
            val header = LinearLayout(activity).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply { this.topMargin = topMargin }
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            val label = TextView(activity).apply {
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                text = activity.getString(titleRes)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                setTextColor(colorOnSurfaceVariant)
            }
            val valueView = TextView(activity).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
                text = formatValue(initialStep)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
                setTextColor(colorPrimary)
                paint.isFakeBoldText = true
            }
            header.addView(label)
            header.addView(valueView)
            container.addView(header)

            val seekBar = SeekBar(activity).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    dp(32f),
                ).apply { this.topMargin = dp(4f) }
                max = steps.coerceAtLeast(1)
                progress = initialStep.coerceIn(0, max)
                setPadding(0, 0, 0, 0)
                splitTrack = false
                progressDrawable = ContextCompat.getDrawable(activity, R.drawable.bg_lyric_settings_seekbar_progress)
                thumb = ContextCompat.getDrawable(activity, R.drawable.bg_lyric_settings_seekbar_thumb)
                thumbOffset = dp(6f)
                contentDescription = activity.getString(titleRes)
                setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(sb: SeekBar?, progress: Int, fromUser: Boolean) {
                        valueView.text = formatValue(progress)
                        if (fromUser) onStepChanged(progress)
                    }
                    override fun onStartTrackingTouch(sb: SeekBar?) = Unit
                    override fun onStopTrackingTouch(sb: SeekBar?) = Unit
                })
            }
            container.addView(seekBar)
        }

        fun addColorRow(
            container: LinearLayout,
            titleRes: Int,
            currentColor: Int,
            defaultColor: Int,
            isUnlitPalette: Boolean = false,
            onPick: (Int) -> Unit,
        ) {
            val topMargin = if (container.childCount == 0) 0 else dp(10f)
            val title = TextView(activity).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                ).apply { this.topMargin = topMargin }
                text = activity.getString(titleRes)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                setTextColor(colorOnSurfaceVariant)
            }
            container.addView(title)

            val rowWrapper = LinearLayout(activity).apply {
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }

            val scroll = HorizontalScrollView(activity).apply {
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                setPadding(0, dp(8f), 0, dp(8f))
                isHorizontalScrollBarEnabled = false
            }
            val chipContainer = LinearLayout(activity).apply {
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }

            val candidates = buildColorCandidates(activity, currentColor, defaultColor, isUnlitPalette)
            var activeColor = currentColor

            fun renderChips() {
                chipContainer.removeAllViews()
                val selectedSize = dp(22f).coerceAtLeast(1)
                val normalSize = dp(28f).coerceAtLeast(1)
                val margin = dp(6f)
                val strokeW = dp(2.5f).coerceAtLeast(2)

                candidates.forEach { argb ->
                    val selected = argb == activeColor
                    val chip = View(activity).apply {
                        val size = if (selected) selectedSize else normalSize
                        layoutParams = LinearLayout.LayoutParams(size, size).apply {
                            marginStart = margin
                            marginEnd = margin
                        }
                        background = GradientDrawable().apply {
                            shape = GradientDrawable.OVAL
                            setColor(argb)
                            setStroke(
                                if (selected) strokeW else dp(1f).coerceAtLeast(1),
                                if (selected) selectedStrokeColor else Color.argb(48, 255, 255, 255),
                            )
                        }
                        setOnClickListener {
                            activeColor = argb
                            renderChips()
                            onPick(argb)
                        }
                    }
                    chipContainer.addView(chip)
                }
            }
            renderChips()
            scroll.addView(chipContainer)
            rowWrapper.addView(scroll)

            val presetBtn = ImageButton(activity).apply {
                layoutParams = LinearLayout.LayoutParams(dp(40f), dp(40f))
                setBackgroundResource(resolveSelectableBorderless(activity))
                setPadding(dp(8f), dp(8f), dp(8f), dp(8f))
                setImageResource(R.drawable.ic_add_24)
                imageTintList = android.content.res.ColorStateList.valueOf(colorPrimary)
                contentDescription = activity.getString(R.string.settings_lyric_color_presets_title)
                setOnClickListener {
                    preview.setVisible(false)
                    LyricColorPresetsActivity.start(activity)
                }
            }
            rowWrapper.addView(presetBtn)
            container.addView(rowWrapper)
        }

        fun rebuildControls() {
            val config = LyricEffectConfigRepository.read(activity)
            val motionCard = binding.styleParamsMotionCard
            val colorCard = binding.styleParamsColorCard
            motionCard.removeAllViews()
            colorCard.removeAllViews()

            when (styleId) {
                LyricEffectStyleId.TYPEWRITER -> {
                    val s = config.typewriter
                    addSliderRow(
                        container = motionCard,
                        titleRes = R.string.lyric_param_line_reveal_duration,
                        steps = (1500 - 150) / 50,
                        initialStep = (s.lineRevealDurationMs - 150) / 50,
                        formatValue = { step -> String.format(Locale.getDefault(), "%.2fs", (150 + step * 50) / 1000f) },
                    ) { step ->
                        updateConfig { it.copy(typewriter = it.typewriter.copy(lineRevealDurationMs = 150 + step * 50)) }
                    }
                    addSwitchRow(motionCard, R.string.lyric_param_show_cursor, s.showCursor) { checked ->
                        updateConfig { it.copy(typewriter = it.typewriter.copy(showCursor = checked)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_text_color, s.textColorArgb, TypewriterEffectConfig().textColorArgb) { c ->
                        updateConfig { it.copy(typewriter = it.typewriter.copy(textColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_latest_glow_color, s.latestGlowColorArgb, TypewriterEffectConfig().latestGlowColorArgb) { c ->
                        updateConfig { it.copy(typewriter = it.typewriter.copy(latestGlowColorArgb = c)) }
                    }
                }

                LyricEffectStyleId.INK -> {
                    val s = config.ink
                    addSliderRow(
                        container = motionCard,
                        titleRes = R.string.lyric_param_feather_width,
                        steps = (36 - 6) / 2,
                        initialStep = (s.featherWidthDp - 6) / 2,
                        formatValue = { step -> "${6 + step * 2}dp" },
                    ) { step ->
                        updateConfig { it.copy(ink = it.ink.copy(featherWidthDp = 6 + step * 2)) }
                    }
                    addSliderRow(
                        container = motionCard,
                        titleRes = R.string.lyric_param_lift_offset,
                        steps = 16,
                        initialStep = (s.liftOffsetDp * 2f).roundToInt(),
                        formatValue = { step -> String.format(Locale.getDefault(), "%.1fdp", step * 0.5f) },
                    ) { step ->
                        updateConfig { it.copy(ink = it.ink.copy(liftOffsetDp = step * 0.5f)) }
                    }
                    addSliderRow(
                        container = motionCard,
                        titleRes = R.string.lyric_param_line_sweep_duration,
                        steps = (2000 - 200) / 50,
                        initialStep = (s.lineSweepDurationMs - 200) / 50,
                        formatValue = { step -> String.format(Locale.getDefault(), "%.2fs", (200 + step * 50) / 1000f) },
                    ) { step ->
                        updateConfig { it.copy(ink = it.ink.copy(lineSweepDurationMs = 200 + step * 50)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_unlit_color, s.unlitColorArgb, InkEffectConfig().unlitColorArgb, isUnlitPalette = true) { c ->
                        updateConfig { it.copy(ink = it.ink.copy(unlitColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_highlight_start_color, s.highlightStartColorArgb, InkEffectConfig().highlightStartColorArgb) { c ->
                        updateConfig { it.copy(ink = it.ink.copy(highlightStartColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_highlight_tip_color, s.highlightTipColorArgb, InkEffectConfig().highlightTipColorArgb) { c ->
                        updateConfig { it.copy(ink = it.ink.copy(highlightTipColorArgb = c)) }
                    }
                }

                LyricEffectStyleId.BOUNCE -> {
                    val s = config.bounce
                    addSliderRow(
                        container = motionCard,
                        titleRes = R.string.lyric_param_bounce_jump_height,
                        steps = 16 - 2,
                        initialStep = s.jumpHeightDp - 2,
                        formatValue = { step -> "${2 + step}dp" },
                    ) { step ->
                        updateConfig { it.copy(bounce = it.bounce.copy(jumpHeightDp = 2 + step)) }
                    }
                    addSliderRow(
                        container = motionCard,
                        titleRes = R.string.lyric_param_bounce_jump_scale,
                        steps = 15,
                        initialStep = ((s.jumpScale - 1f) / 0.02f).roundToInt(),
                        formatValue = { step -> String.format(Locale.getDefault(), "%.2fx", 1f + step * 0.02f) },
                    ) { step ->
                        updateConfig { it.copy(bounce = it.bounce.copy(jumpScale = 1f + step * 0.02f)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_unlit_color, s.unlitColorArgb, BounceEffectConfig().unlitColorArgb, isUnlitPalette = true) { c ->
                        updateConfig { it.copy(bounce = it.bounce.copy(unlitColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_sung_color, s.sungColorArgb, BounceEffectConfig().sungColorArgb) { c ->
                        updateConfig { it.copy(bounce = it.bounce.copy(sungColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_active_color, s.activeColorArgb, BounceEffectConfig().activeColorArgb) { c ->
                        updateConfig { it.copy(bounce = it.bounce.copy(activeColorArgb = c)) }
                    }
                }

                LyricEffectStyleId.SPOTLIGHT -> {
                    val s = config.spotlight
                    addSliderRow(
                        container = motionCard,
                        titleRes = R.string.lyric_param_spotlight_blur,
                        steps = 16,
                        initialStep = (s.blurIntensityDp * 2f).roundToInt(),
                        formatValue = { step -> String.format(Locale.getDefault(), "%.1fdp", step * 0.5f) },
                    ) { step ->
                        updateConfig { it.copy(spotlight = it.spotlight.copy(blurIntensityDp = step * 0.5f)) }
                    }
                    addSliderRow(
                        container = motionCard,
                        titleRes = R.string.lyric_param_spotlight_scale,
                        steps = 25,
                        initialStep = ((s.activeScale - 1f) * 100f).roundToInt(),
                        formatValue = { step -> String.format(Locale.getDefault(), "%.2fx", 1f + step * 0.01f) },
                    ) { step ->
                        updateConfig { it.copy(spotlight = it.spotlight.copy(activeScale = 1f + step * 0.01f)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_unlit_color, s.unlitColorArgb, SpotlightEffectConfig().unlitColorArgb, isUnlitPalette = true) { c ->
                        updateConfig { it.copy(spotlight = it.spotlight.copy(unlitColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_sung_color, s.sungColorArgb, SpotlightEffectConfig().sungColorArgb) { c ->
                        updateConfig { it.copy(spotlight = it.spotlight.copy(sungColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_spotlight_active_color, s.activeColorArgb, SpotlightEffectConfig().activeColorArgb) { c ->
                        updateConfig { it.copy(spotlight = it.spotlight.copy(activeColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_spotlight_glow_color, s.glowColorArgb, SpotlightEffectConfig().glowColorArgb) { c ->
                        updateConfig { it.copy(spotlight = it.spotlight.copy(glowColorArgb = c)) }
                    }
                }

                LyricEffectStyleId.NEON -> {
                    val s = config.neon
                    addSliderRow(
                        container = motionCard,
                        titleRes = R.string.lyric_param_neon_reveal_duration,
                        steps = (1500 - 150) / 50,
                        initialStep = (s.lineRevealDurationMs - 150) / 50,
                        formatValue = { step -> String.format(Locale.getDefault(), "%.2fs", (150 + step * 50) / 1000f) },
                    ) { step ->
                        updateConfig { it.copy(neon = it.neon.copy(lineRevealDurationMs = 150 + step * 50)) }
                    }
                    addSliderRow(
                        container = motionCard,
                        titleRes = R.string.lyric_param_neon_flow_speed,
                        steps = 20,
                        initialStep = (s.flowSpeed * 10f).roundToInt(),
                        formatValue = { step -> String.format(Locale.getDefault(), "%.1fx", step * 0.1f) },
                    ) { step ->
                        updateConfig { it.copy(neon = it.neon.copy(flowSpeed = step * 0.1f)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_unlit_color, s.unlitColorArgb, NeonEffectConfig().unlitColorArgb, isUnlitPalette = true) { c ->
                        updateConfig { it.copy(neon = it.neon.copy(unlitColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_neon_color_1, s.colorStartArgb, NeonEffectConfig().colorStartArgb) { c ->
                        updateConfig { it.copy(neon = it.neon.copy(colorStartArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_neon_color_2, s.colorMidArgb, NeonEffectConfig().colorMidArgb) { c ->
                        updateConfig { it.copy(neon = it.neon.copy(colorMidArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_neon_color_3, s.colorEndArgb, NeonEffectConfig().colorEndArgb) { c ->
                        updateConfig { it.copy(neon = it.neon.copy(colorEndArgb = c)) }
                    }
                }

                LyricEffectStyleId.OCEAN -> {
                    val s = config.ocean
                    addSliderRow(
                        container = motionCard,
                        titleRes = R.string.lyric_param_ocean_jump_height,
                        steps = 24 - 4,
                        initialStep = s.jumpHeightDp - 4,
                        formatValue = { step -> "${4 + step}dp" },
                    ) { step ->
                        updateConfig { it.copy(ocean = it.ocean.copy(jumpHeightDp = 4 + step)) }
                    }
                    addSwitchRow(motionCard, R.string.lyric_param_ocean_show_wave_line, s.showWaveLine) { checked ->
                        updateConfig { it.copy(ocean = it.ocean.copy(showWaveLine = checked)) }
                    }
                    addSwitchRow(motionCard, R.string.lyric_param_ocean_sway_enabled, s.swayEnabled) { checked ->
                        updateConfig { it.copy(ocean = it.ocean.copy(swayEnabled = checked)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_unlit_color, s.unlitColorArgb, OceanEffectConfig().unlitColorArgb, isUnlitPalette = true) { c ->
                        updateConfig { it.copy(ocean = it.ocean.copy(unlitColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_sung_color, s.sungColorArgb, OceanEffectConfig().sungColorArgb) { c ->
                        updateConfig { it.copy(ocean = it.ocean.copy(sungColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_ocean_crest_color, s.crestColorArgb, OceanEffectConfig().crestColorArgb) { c ->
                        updateConfig { it.copy(ocean = it.ocean.copy(crestColorArgb = c)) }
                    }
                    addColorRow(colorCard, R.string.lyric_param_ocean_glow_color, s.glowColorArgb, OceanEffectConfig().glowColorArgb) { c ->
                        updateConfig { it.copy(ocean = it.ocean.copy(glowColorArgb = c)) }
                    }
                }

                LyricEffectStyleId.DEFAULT -> Unit
            }

            applyPreviewAndNotify(config)
        }

        binding.styleParamsRestore.setOnClickListener {
            LyricEffectConfigRepository.resetStyle(activity, styleId)
            rebuildControls()
            PmMessage.success(activity, activity.getString(R.string.lyric_settings_style_params_restored, styleName))
        }
        binding.styleParamsClose.setOnClickListener { dialog.dismiss() }

        var disposed = false
        val observer = object : DefaultLifecycleObserver {
            override fun onResume(owner: LifecycleOwner) {
                if (disposed || !dialog.isShowing) return
                rebuildControls()
                preview.setVisible(true)
            }

            override fun onStop(owner: LifecycleOwner) {
                preview.setVisible(false)
            }

            override fun onDestroy(owner: LifecycleOwner) {
                dialog.dismiss()
            }
        }
        activity.lifecycle.addObserver(observer)

        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<FrameLayout>(
                com.google.android.material.R.id.design_bottom_sheet,
            )
            bottomSheet?.let { sheet ->
                val decor = dialog.window?.decorView
                val visibleFrame = Rect()
                decor?.getWindowVisibleDisplayFrame(visibleFrame)
                val screenH = activity.resources.displayMetrics.heightPixels
                val available = minOf((screenH * 0.8f).roundToInt(), visibleFrame.height().takeIf { it > 0 } ?: screenH)
                sheet.layoutParams = sheet.layoutParams.apply { height = ViewGroup.LayoutParams.WRAP_CONTENT }
                BottomSheetBehavior.from(sheet).apply {
                    skipCollapsed = true
                    maxHeight = available
                    state = BottomSheetBehavior.STATE_EXPANDED
                }
                binding.styleParamsScroll.layoutParams = binding.styleParamsScroll.layoutParams.apply {
                    height = ViewGroup.LayoutParams.WRAP_CONTENT
                }
            }
            preview.setVisible(activity.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED))
        }

        dialog.setOnDismissListener {
            if (!disposed) {
                disposed = true
                activity.lifecycle.removeObserver(observer)
                preview.release()
                onDismissed()
            }
        }

        rebuildControls()
        dialog.show()
        PmMessage.register(dialog)
    }

    private fun buildColorCandidates(
        activity: ComponentActivity,
        currentColor: Int,
        defaultColor: Int,
        isUnlitPalette: Boolean,
    ): List<Int> {
        val result = LinkedHashSet<Int>()
        result += defaultColor
        result += currentColor
        if (isUnlitPalette) {
            result += LyricStyleParamsMeta.DEFAULT_UNLIT_PALETTE
            result += LyricDisplayPrefs.getNormalColorRgbPresets(activity).map { rgb ->
                Color.argb(96, Color.red(rgb), Color.green(rgb), Color.blue(rgb))
            }
        } else {
            result += LyricStyleParamsMeta.DEFAULT_EFFECT_PALETTE
            result += LyricDisplayPrefs.getCurrentColorArgbPresets(activity)
        }
        return result.toList()
    }

    private fun resolveThemeColor(activity: ComponentActivity, attrRes: Int): Int {
        val tv = TypedValue()
        return if (activity.theme.resolveAttribute(attrRes, tv, true)) tv.data else Color.WHITE
    }

    private fun resolveSelectableBorderless(activity: ComponentActivity): Int {
        val tv = TypedValue()
        activity.theme.resolveAttribute(android.R.attr.selectableItemBackgroundBorderless, tv, true)
        return tv.resourceId
    }
}
