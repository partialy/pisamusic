package cn.partialy.pm.utils

import android.content.Context
import android.graphics.Color
import cn.partialy.pm.ui.player.LyricAlignment
import cn.partialy.pm.ui.player.LyricDisplayStyle

object LyricDisplayPrefs {
    private const val PREFS_NAME = "lyric_display"
    private const val KEY_TEXT_SIZE_SP = "text_size_sp"
    private const val KEY_NORMAL_COLOR_RGB = "normal_color_rgb"
    private const val KEY_CURRENT_COLOR_ARGB = "current_color_argb"
    private const val KEY_CURRENT_BOLD = "current_bold"
    private const val KEY_CURRENT_ENLARGED = "current_enlarged"
    private const val KEY_CURRENT_ENLARGED_DX = "current_enlarged_dx"
    private const val KEY_INACTIVE_OPACITY_PERCENT = "inactive_opacity_percent"
    private const val KEY_ALIGNMENT = "alignment"
    private const val KEY_NORMAL_PRESETS = "normal_presets"
    private const val KEY_CURRENT_PRESETS = "current_presets"

    private val defaultNormalColorRgbPresets: IntArray = intArrayOf(
        Color.rgb(191, 191, 191),
        Color.rgb(170, 170, 170),
        Color.rgb(204, 204, 204),
        Color.rgb(153, 153, 153),
        Color.rgb(224, 224, 224),
        Color.rgb(136, 136, 136),
    )

    private val defaultCurrentColorArgbPresets: IntArray = intArrayOf(
        Color.WHITE,
        Color.parseColor("#FFE082"),
        Color.parseColor("#81D4FA"),
        Color.parseColor("#FFAB40"),
        Color.parseColor("#E1BEE7"),
        Color.parseColor("#B2DFDB"),
    )

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    const val PRESET_ROW_SIZE = 6
    const val PRESET_MAX_ROWS = 2
    const val PRESET_MAX_COUNT = PRESET_ROW_SIZE * PRESET_MAX_ROWS

    fun readStyle(context: Context): LyricDisplayStyle {
        val p = prefs(context)
        val def = LyricDisplayStyle.DEFAULT
        val normalRgb = p.getInt(KEY_NORMAL_COLOR_RGB, def.normalColorArgb)
        return LyricDisplayStyle(
            textSizeSp = p.getFloat(KEY_TEXT_SIZE_SP, def.textSizeSp),
            normalColorArgb = Color.rgb(Color.red(normalRgb), Color.green(normalRgb), Color.blue(normalRgb)),
            currentColorArgb = p.getInt(KEY_CURRENT_COLOR_ARGB, def.currentColorArgb),
            currentLineBold = p.getBoolean(KEY_CURRENT_BOLD, def.currentLineBold),
            currentLineEnlarged = p.getBoolean(KEY_CURRENT_ENLARGED, def.currentLineEnlarged),
            currentLineEnlargedDxSp = p.getInt(KEY_CURRENT_ENLARGED_DX, def.currentLineEnlargedDxSp).coerceIn(2, 8),
            inactiveOpacityPercent = p.getInt(KEY_INACTIVE_OPACITY_PERCENT, def.inactiveOpacityPercent),
            alignment = LyricAlignment.fromPref(p.getInt(KEY_ALIGNMENT, def.alignment.prefValue)),
        )
    }

    fun writeStyle(context: Context, style: LyricDisplayStyle) {
        val c = style.normalColorArgb
        prefs(context).edit().apply {
            putFloat(KEY_TEXT_SIZE_SP, style.textSizeSp)
            putInt(KEY_NORMAL_COLOR_RGB, Color.rgb(Color.red(c), Color.green(c), Color.blue(c)))
            putInt(KEY_CURRENT_COLOR_ARGB, style.currentColorArgb)
            putBoolean(KEY_CURRENT_BOLD, style.currentLineBold)
            putBoolean(KEY_CURRENT_ENLARGED, style.currentLineEnlarged)
            putInt(KEY_CURRENT_ENLARGED_DX, style.currentLineEnlargedDxSp.coerceIn(2, 8))
            putInt(KEY_INACTIVE_OPACITY_PERCENT, style.inactiveOpacityPercent.coerceIn(0, 100))
            putInt(KEY_ALIGNMENT, style.alignment.prefValue)
            apply()
        }
    }

    fun getNormalColorRgbPresets(context: Context): List<Int> {
        return readPresetList(
            context = context,
            key = KEY_NORMAL_PRESETS,
            defaultValues = defaultNormalColorRgbPresets.toList(),
            forceOpaqueRgb = true,
        )
    }

    fun getCurrentColorArgbPresets(context: Context): List<Int> {
        return readPresetList(
            context = context,
            key = KEY_CURRENT_PRESETS,
            defaultValues = defaultCurrentColorArgbPresets.toList(),
            forceOpaqueRgb = false,
        )
    }

    fun setNormalColorRgbPresets(context: Context, colors: List<Int>) {
        writePresetList(context, KEY_NORMAL_PRESETS, colors, forceOpaqueRgb = true)
    }

    fun setCurrentColorArgbPresets(context: Context, colors: List<Int>) {
        writePresetList(context, KEY_CURRENT_PRESETS, colors, forceOpaqueRgb = false)
    }

    fun addNormalColorRgbPreset(context: Context, color: Int): Boolean {
        return addPreset(context, KEY_NORMAL_PRESETS, color, forceOpaqueRgb = true)
    }

    fun addCurrentColorArgbPreset(context: Context, color: Int): Boolean {
        return addPreset(context, KEY_CURRENT_PRESETS, color, forceOpaqueRgb = false)
    }

    fun removeNormalColorRgbPreset(context: Context, color: Int): Boolean {
        return removePreset(
            context,
            KEY_NORMAL_PRESETS,
            color,
            defaultNormalColorRgbPresets.toList(),
            forceOpaqueRgb = true,
        )
    }

    fun removeCurrentColorArgbPreset(context: Context, color: Int): Boolean {
        return removePreset(
            context,
            KEY_CURRENT_PRESETS,
            color,
            defaultCurrentColorArgbPresets.toList(),
            forceOpaqueRgb = false,
        )
    }

    fun updateNormalColorRgbPreset(context: Context, index: Int, color: Int): Boolean {
        return updatePreset(
            context,
            KEY_NORMAL_PRESETS,
            index,
            color,
            defaultNormalColorRgbPresets.toList(),
            forceOpaqueRgb = true,
        )
    }

    fun updateCurrentColorArgbPreset(context: Context, index: Int, color: Int): Boolean {
        return updatePreset(
            context,
            KEY_CURRENT_PRESETS,
            index,
            color,
            defaultCurrentColorArgbPresets.toList(),
            forceOpaqueRgb = false,
        )
    }

    private fun addPreset(context: Context, key: String, color: Int, forceOpaqueRgb: Boolean): Boolean {
        val current = readPresetList(
            context,
            key,
            if (forceOpaqueRgb) defaultNormalColorRgbPresets.toList() else defaultCurrentColorArgbPresets.toList(),
            forceOpaqueRgb,
        ).toMutableList()
        val normalized = normalizeColor(color, forceOpaqueRgb)
        if (current.any { it == normalized } || current.size >= PRESET_MAX_COUNT) return false
        current.add(normalized)
        writePresetList(context, key, current, forceOpaqueRgb)
        return true
    }

    private fun removePreset(
        context: Context,
        key: String,
        color: Int,
        defaultValues: List<Int>,
        forceOpaqueRgb: Boolean,
    ): Boolean {
        val current = readPresetList(context, key, defaultValues, forceOpaqueRgb).toMutableList()
        if (current.size <= 1) return false
        val removed = current.remove(normalizeColor(color, forceOpaqueRgb))
        if (!removed) return false
        writePresetList(context, key, current, forceOpaqueRgb)
        return true
    }

    private fun updatePreset(
        context: Context,
        key: String,
        index: Int,
        color: Int,
        defaultValues: List<Int>,
        forceOpaqueRgb: Boolean,
    ): Boolean {
        val current = readPresetList(context, key, defaultValues, forceOpaqueRgb).toMutableList()
        if (index !in current.indices) return false
        current[index] = normalizeColor(color, forceOpaqueRgb)
        writePresetList(context, key, current, forceOpaqueRgb)
        return true
    }

    private fun readPresetList(
        context: Context,
        key: String,
        defaultValues: List<Int>,
        forceOpaqueRgb: Boolean,
    ): List<Int> {
        val raw = prefs(context).getString(key, null)
        if (raw.isNullOrBlank()) return defaultValues
        val parsed = raw.split(",")
            .mapNotNull { token ->
                token.trim().removePrefix("#").toLongOrNull(16)?.toInt()
            }
            .map { normalizeColor(it, forceOpaqueRgb) }
            .distinct()
            .take(PRESET_MAX_COUNT)
        return if (parsed.isEmpty()) defaultValues else parsed
    }

    private fun writePresetList(
        context: Context,
        key: String,
        colors: List<Int>,
        forceOpaqueRgb: Boolean,
    ) {
        val normalized = colors
            .map { normalizeColor(it, forceOpaqueRgb) }
            .distinct()
            .take(PRESET_MAX_COUNT)
            .ifEmpty {
                if (forceOpaqueRgb) defaultNormalColorRgbPresets.toList()
                else defaultCurrentColorArgbPresets.toList()
            }
        val encoded = normalized.joinToString(",") { it.toUInt().toString(16) }
        prefs(context).edit().putString(key, encoded).apply()
    }

    private fun normalizeColor(color: Int, forceOpaqueRgb: Boolean): Int {
        return if (forceOpaqueRgb) Color.rgb(Color.red(color), Color.green(color), Color.blue(color)) else color
    }

    /**
     * 预设列表变更后调用：若当前歌词样式里的颜色已不在预设中，则回退到列表首项，避免无选中态。
     */
    fun ensureStyleColorsMatchPresets(context: Context) {
        val style = readStyle(context)
        val normals = getNormalColorRgbPresets(context)
        val currents = getCurrentColorArgbPresets(context)
        val normalRgb = Color.rgb(
            Color.red(style.normalColorArgb),
            Color.green(style.normalColorArgb),
            Color.blue(style.normalColorArgb),
        )
        val resolvedNormal = if (normals.any { it == normalRgb }) {
            normalRgb
        } else {
            normals.firstOrNull() ?: normalRgb
        }
        val resolvedCurrent = if (currents.any { it == style.currentColorArgb }) {
            style.currentColorArgb
        } else {
            currents.firstOrNull() ?: style.currentColorArgb
        }
        if (resolvedNormal != normalRgb || resolvedCurrent != style.currentColorArgb) {
            writeStyle(
                context,
                style.copy(
                    normalColorArgb = resolvedNormal,
                    currentColorArgb = resolvedCurrent,
                ),
            )
        }
    }

    fun addTextSizeSp(context: Context, delta: Float) {
        val s = readStyle(context)
        val v = (s.textSizeSp + delta).coerceIn(12f, 30f)
        writeStyle(context, s.copy(textSizeSp = v))
    }
}
