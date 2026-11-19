package cn.partialy.pm.activity

import android.animation.ValueAnimator
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.core.animation.doOnEnd
import androidx.core.content.ContextCompat
import androidx.core.graphics.ColorUtils
import androidx.core.view.isVisible
import cn.partialy.pm.R
import com.google.android.material.color.MaterialColors
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityLyricColorPresetsBinding
import cn.partialy.pm.databinding.ItemLyricColorGroupBinding
import cn.partialy.pm.databinding.ItemLyricColorPillBinding
import cn.partialy.pm.ui.dialog.ColorPickerBottomSheet
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.ui.player.lyricstyle.LyricColorPresetRegistry
import cn.partialy.pm.ui.player.lyricstyle.LyricColorSlotSpec
import cn.partialy.pm.ui.player.lyricstyle.LyricEffectStyleId
import cn.partialy.pm.ui.player.lyricstyle.LyricStyleColorPresetsRepository
import cn.partialy.pm.ui.player.lyricstyle.LyricStyleColorPresetsStore
import cn.partialy.pm.ui.player.lyricstyle.LyricStyleParamsMeta
import kotlin.math.roundToInt

/**
 * 原生全屏 Edge-to-Edge 歌词颜色管理页：
 * 按颜色分组展示 3 列胶囊色板，支持点击取色器编辑、右侧删除、右上角添加与全局恢复默认。
 */
class LyricColorPresetsActivity : BaseActivity() {

    private lateinit var binding: ActivityLyricColorPresetsBinding
    private var styleId: LyricEffectStyleId = LyricEffectStyleId.DEFAULT
    private var focusSlotKey: String? = null
    private var hasFocusedInitialSlot = false
    private var isEditing = false
    private var moreMenu: PopupWindow? = null
    private var focusAnimator: ValueAnimator? = null
    private val groupViewsBySlot = mutableMapOf<String, View>()

    private val editBackCallback = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() {
            setEditMode(false)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLyricColorPresetsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        styleId = LyricEffectStyleId.fromId(intent.getStringExtra(EXTRA_STYLE_ID))
        focusSlotKey = intent.getStringExtra(EXTRA_FOCUS_SLOT_KEY)?.takeIf { it.isNotBlank() }

        onBackPressedDispatcher.addCallback(this, editBackCallback)
        setupSystemBars()
        setupHeader()
        renderGroups()
        focusSlotIfNeeded()
    }

    override fun onDestroy() {
        moreMenu?.dismiss()
        moreMenu = null
        focusAnimator?.cancel()
        focusAnimator = null
        super.onDestroy()
    }

    private fun setupSystemBars() {
        val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = !isNight, lightNavigationBarIcons = !isNight)
        val baseScrollBottomPadding = dp(28f)
        binding.colorManagerRoot.applySystemBarsInsets { insets ->
            binding.colorManagerRoot.setPadding(
                insets.left,
                insets.top,
                insets.right,
                0,
            )
            binding.colorManagerScroll.setPadding(
                0,
                dp(4f),
                0,
                baseScrollBottomPadding + insets.bottom,
            )
        }
    }

    private fun setupHeader() {
        binding.colorManagerTitle.text = if (styleId == LyricEffectStyleId.DEFAULT) {
            getString(R.string.lyric_color_manager_title)
        } else {
            val label = LyricStyleParamsMeta.styleLabel(this, styleId)
            getString(R.string.lyric_color_manager_style_title, label)
        }
        binding.colorManagerBack.setOnClickListener {
            if (isEditing) {
                setEditMode(false)
            } else {
                finish()
            }
        }
        binding.colorManagerMore.setOnClickListener { showMoreMenu() }
        binding.colorManagerDone.setOnClickListener { setEditMode(false) }
        updateHeaderActions()
    }

    private fun updateHeaderActions() {
        binding.colorManagerMore.isVisible = !isEditing
        binding.colorManagerDone.isVisible = isEditing
        editBackCallback.isEnabled = isEditing
    }

    private fun setEditMode(editing: Boolean) {
        if (isEditing == editing) return
        isEditing = editing
        updateHeaderActions()
        renderGroups()
    }

    private fun showMoreMenu() {
        moreMenu?.dismiss()
        val content = layoutInflater.inflate(R.layout.layout_search_source_dropdown, null, false)
        val container = content.findViewById<LinearLayout>(R.id.searchSourceOptionsContainer)

        val menuItems = listOf(
            Triple(R.string.lyric_color_manager_edit, R.drawable.ic_edit_24) { setEditMode(true) },
            Triple(R.string.lyric_color_manager_reset_action, R.drawable.ic_refresh_24) { confirmResetDefaults() },
        )
        val textColor = MaterialColors.getColor(
            container,
            com.google.android.material.R.attr.colorOnSurface,
        )
        menuItems.forEach { (titleRes, iconRes, action) ->
            val row = layoutInflater.inflate(R.layout.item_compact_action_menu_row, container, false)
            row.findViewById<ImageView>(R.id.actionMenuItemIcon).apply {
                setImageResource(iconRes)
                setColorFilter(textColor)
            }
            row.findViewById<TextView>(R.id.actionMenuItemText).apply {
                setText(titleRes)
                setTextColor(textColor)
            }
            row.setOnClickListener {
                moreMenu?.dismiss()
                action()
            }
            container.addView(row)
        }

        content.measure(
            View.MeasureSpec.makeMeasureSpec(resources.displayMetrics.widthPixels - dp(32f), View.MeasureSpec.AT_MOST),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
        )
        moreMenu = PopupWindow(
            content,
            content.measuredWidth.coerceAtLeast(dp(140f)),
            ViewGroup.LayoutParams.WRAP_CONTENT,
            true,
        ).apply {
            isOutsideTouchable = true
            elevation = dp(8f).toFloat()
            showAsDropDown(binding.colorManagerMore, 0, dp(6f), Gravity.END)
        }
    }

    private fun confirmResetDefaults() {
        val message = if (styleId == LyricEffectStyleId.DEFAULT) {
            getString(R.string.lyric_color_manager_reset_message_all)
        } else {
            val label = LyricStyleParamsMeta.styleLabel(this, styleId)
            getString(R.string.lyric_color_manager_reset_message_style, label)
        }
        PmMinimalDialog.show(
            context = this,
            title = getString(R.string.lyric_color_manager_reset_title),
            message = message,
            cancelText = getString(R.string.cancel),
            confirmText = getString(R.string.lyric_color_manager_reset),
            onConfirm = {
                LyricStyleColorPresetsRepository.resetPresetsForStyle(this, styleId)
                renderGroups()
                PmMessage.success(this, R.string.lyric_color_manager_reset_done)
            },
        )
    }

    private fun renderGroups() {
        focusAnimator?.cancel()
        groupViewsBySlot.clear()
        binding.colorGroupsContainer.removeAllViews()

        val slots = LyricColorPresetRegistry.slotsFor(styleId)
        slots.forEach { spec ->
            val groupBinding = ItemLyricColorGroupBinding.inflate(
                layoutInflater,
                binding.colorGroupsContainer,
                false,
            )
            groupViewsBySlot[spec.slotKey] = groupBinding.root
            bindGroup(groupBinding, spec)
            binding.colorGroupsContainer.addView(groupBinding.root)
        }
    }

    private fun bindGroup(
        groupBinding: ItemLyricColorGroupBinding,
        spec: LyricColorSlotSpec,
    ) {
        val slotTitle = LyricColorPresetRegistry.slotTitle(this, spec)
        val colors = LyricStyleColorPresetsRepository.getPresets(this, styleId, spec.slotKey)
        val maxCount = LyricStyleColorPresetsStore.MAX_PRESET_COUNT
        val isFull = colors.size >= maxCount

        groupBinding.colorGroupTitle.text = slotTitle
        groupBinding.colorGroupCount.text = getString(
            R.string.lyric_color_manager_group_count,
            colors.size,
            maxCount,
        )
        groupBinding.colorGroupAdd.alpha = if (isFull) 0.45f else 1f
        groupBinding.colorGroupAdd.setOnClickListener {
            if (isFull) {
                PmMessage.warning(this, R.string.lyric_color_manager_full_warning)
                return@setOnClickListener
            }
            val seedColor = colors.lastOrNull() ?: spec.defaultColor
            ColorPickerBottomSheet.show(
                activity = this,
                initialColor = seedColor,
                allowAlpha = spec.allowAlpha,
                title = getString(R.string.lyric_color_picker_title_named, slotTitle),
            ) { pickedColor ->
                val result = LyricStyleColorPresetsRepository.addPreset(
                    this,
                    styleId,
                    spec.slotKey,
                    pickedColor,
                )
                if (result.ok) {
                    renderGroups()
                } else {
                    PmMessage.warning(this, result.errorMessage)
                }
            }
        }

        bindPillGrid(groupBinding.colorGroupRows, spec, slotTitle, colors)
    }

    private fun bindPillGrid(
        rowsContainer: LinearLayout,
        spec: LyricColorSlotSpec,
        slotTitle: String,
        colors: List<Int>,
    ) {
        rowsContainer.removeAllViews()
        val columnCount = 3
        val columnGapPx = dp(8f)
        val rowGapPx = dp(10f)
        val chunks = colors.chunked(columnCount)

        chunks.forEachIndexed { rowIndex, rowColors ->
            val rowLayout = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                ).apply {
                    if (rowIndex < chunks.lastIndex) bottomMargin = rowGapPx
                }
            }

            for (col in 0 until columnCount) {
                if (col < rowColors.size) {
                    val colorIndex = rowIndex * columnCount + col
                    val colorValue = rowColors[col]
                    val pillBinding = ItemLyricColorPillBinding.inflate(
                        layoutInflater,
                        rowLayout,
                        false,
                    )
                    val lp = pillBinding.root.layoutParams as LinearLayout.LayoutParams
                    if (col < columnCount - 1) lp.marginEnd = columnGapPx
                    pillBinding.root.layoutParams = lp

                    val hex = ColorPickerBottomSheet.formatHex(colorValue, spec.allowAlpha)
                    pillBinding.colorPillDot.background = buildColorDotDrawable(colorValue)
                    pillBinding.colorPillHex.text = hex
                    pillBinding.colorPillDelete.isVisible = isEditing
                    pillBinding.colorPillDelete.contentDescription =
                        getString(R.string.lyric_color_manager_delete_cd, hex)

                    pillBinding.root.setOnLongClickListener {
                        if (!isEditing) {
                            setEditMode(true)
                        }
                        true
                    }

                    pillBinding.root.setOnClickListener {
                        ColorPickerBottomSheet.show(
                            activity = this,
                            initialColor = colorValue,
                            allowAlpha = spec.allowAlpha,
                            title = getString(R.string.lyric_color_picker_title_named, slotTitle),
                        ) { pickedColor ->
                            val result = LyricStyleColorPresetsRepository.updatePreset(
                                this,
                                styleId,
                                spec.slotKey,
                                colorIndex,
                                pickedColor,
                            )
                            if (result.ok) {
                                renderGroups()
                            } else {
                                PmMessage.warning(this, result.errorMessage)
                            }
                        }
                    }

                    pillBinding.colorPillDelete.setOnClickListener {
                        val result = LyricStyleColorPresetsRepository.removePreset(
                            this,
                            styleId,
                            spec.slotKey,
                            colorValue,
                        )
                        if (result.ok) {
                            renderGroups()
                        } else {
                            PmMessage.warning(this, result.errorMessage)
                        }
                    }

                    rowLayout.addView(pillBinding.root)
                } else {
                    val spacer = View(this).apply {
                        visibility = View.INVISIBLE
                        layoutParams = LinearLayout.LayoutParams(0, 1, 1f).apply {
                            if (col < columnCount - 1) marginEnd = columnGapPx
                        }
                    }
                    rowLayout.addView(spacer)
                }
            }

            rowsContainer.addView(rowLayout)
        }
    }

    private fun buildColorDotDrawable(argb: Int): Drawable {
        val density = resources.displayMetrics.density
        val checkerboard = cn.partialy.pm.ui.widget.colorpicker.CheckerboardDrawable(
            cellSizePx = 3.5f * density,
            isCircle = true,
        )
        val dotFill = GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(argb)
            setStroke(dp(1f).coerceAtLeast(1), ContextCompat.getColor(this@LyricColorPresetsActivity, R.color.lyric_color_pill_border))
        }
        return LayerDrawable(arrayOf(checkerboard, dotFill))
    }

    private fun focusSlotIfNeeded() {
        val targetKey = focusSlotKey
        if (hasFocusedInitialSlot || targetKey.isNullOrBlank()) return
        hasFocusedInitialSlot = true

        binding.colorGroupsContainer.post {
            val targetView = groupViewsBySlot[targetKey] ?: return@post
            binding.colorManagerScroll.smoothScrollTo(0, (targetView.top - dp(8f)).coerceAtLeast(0))
            flashGroupHighlight(targetView)
        }
    }

    private fun flashGroupHighlight(targetView: View) {
        if (!ValueAnimator.areAnimatorsEnabled()) return
        val baseHighlightColor = ContextCompat.getColor(this, R.color.lyric_color_group_focus_highlight)
        val maxAlpha = Color.alpha(baseHighlightColor).coerceAtLeast(1)
        val highlightBg = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = 16f * resources.displayMetrics.density
            setColor(ColorUtils.setAlphaComponent(baseHighlightColor, 0))
        }
        targetView.background = highlightBg

        focusAnimator?.cancel()
        focusAnimator = ValueAnimator.ofInt(0, maxAlpha).apply {
            duration = 280L
            repeatCount = 3
            repeatMode = ValueAnimator.REVERSE
            addUpdateListener { anim ->
                val alpha = anim.animatedValue as Int
                highlightBg.setColor(ColorUtils.setAlphaComponent(baseHighlightColor, alpha))
            }
            doOnEnd {
                if (targetView.background === highlightBg) {
                    targetView.background = null
                }
            }
            start()
        }
    }

    private fun dp(value: Float): Int = (value * resources.displayMetrics.density).roundToInt()

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }

    companion object {
        private const val EXTRA_STYLE_ID = "extra_style_id"
        private const val EXTRA_FOCUS_SLOT_KEY = "extra_focus_slot_key"

        fun start(
            context: Context,
            styleId: LyricEffectStyleId = LyricEffectStyleId.DEFAULT,
            focusSlotKey: String? = null,
        ) {
            val intent = Intent(context, LyricColorPresetsActivity::class.java).apply {
                putExtra(EXTRA_STYLE_ID, styleId.id)
                if (!focusSlotKey.isNullOrBlank()) {
                    putExtra(EXTRA_FOCUS_SLOT_KEY, focusSlotKey)
                }
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }
}
