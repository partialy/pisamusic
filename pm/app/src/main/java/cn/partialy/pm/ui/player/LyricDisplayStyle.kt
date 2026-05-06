package cn.partialy.pm.ui.player

import android.graphics.Color

enum class LyricAlignment(val prefValue: Int) {
    START(0),
    CENTER(1),
    END(2),
    ;

    companion object {
        fun fromPref(v: Int): LyricAlignment =
            values().firstOrNull { it.prefValue == v } ?: CENTER
    }
}

data class LyricDisplayStyle(
    val textSizeSp: Float,
    val normalColorArgb: Int,
    val currentColorArgb: Int,
    val currentLineBold: Boolean,
    val currentLineEnlarged: Boolean,
    val currentLineEnlargedDxSp: Int,
    /** 非当前行不透明度 0–100，作用于常规行颜色的 alpha 通道 */
    val inactiveOpacityPercent: Int,
    val alignment: LyricAlignment,
) {
    fun resolvedNormalColor(): Int {
        val c = normalColorArgb
        val a = (255 * inactiveOpacityPercent / 100f).toInt().coerceIn(0, 255)
        return Color.argb(a, Color.red(c), Color.green(c), Color.blue(c))
    }

    companion object {
        val DEFAULT = LyricDisplayStyle(
            textSizeSp = 16f,
            normalColorArgb = Color.rgb(191, 191, 191),
            currentColorArgb = Color.WHITE,
            currentLineBold = true,
            currentLineEnlarged = true,
            currentLineEnlargedDxSp = 4,
            inactiveOpacityPercent = 30,
            alignment = LyricAlignment.CENTER,
        )
    }
}
