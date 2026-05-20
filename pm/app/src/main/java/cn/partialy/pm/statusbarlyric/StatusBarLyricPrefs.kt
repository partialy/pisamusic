package cn.partialy.pm.statusbarlyric

import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color

data class StatusBarLyricConfig(
    val enabled: Boolean,
    val xPercent: Int,
    val yDp: Int,
    val widthPercent: Int,
    val fontSizeLevel: Int,
    val sungColorArgb: Int,
    val unsungColorArgb: Int,
)

object StatusBarLyricPrefs {
    const val PREFS_NAME = "status_bar_lyric"

    private const val KEY_ENABLED = "enabled"
    private const val KEY_X_PERCENT = "x_percent"
    private const val KEY_Y_DP = "y_dp"
    private const val KEY_WIDTH_PERCENT = "width_percent"
    private const val KEY_FONT_SIZE_LEVEL = "font_size_level"
    private const val KEY_SUNG_COLOR = "sung_color"
    private const val KEY_UNSUNG_COLOR = "unsung_color"

    val DEFAULT = StatusBarLyricConfig(
        enabled = false,
        xPercent = 50,
        yDp = 22,
        widthPercent = 72,
        fontSizeLevel = 1,
        sungColorArgb = Color.parseColor("#FFFF5BA8").toInt(),
        unsungColorArgb = Color.parseColor("#FFFFFFFF").toInt(),
    )

    fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun read(context: Context): StatusBarLyricConfig {
        val p = prefs(context)
        return StatusBarLyricConfig(
            enabled = p.getBoolean(KEY_ENABLED, DEFAULT.enabled),
            xPercent = p.getInt(KEY_X_PERCENT, DEFAULT.xPercent).coerceIn(0, 100),
            yDp = p.getInt(KEY_Y_DP, DEFAULT.yDp).coerceIn(0, 160),
            widthPercent = p.getInt(KEY_WIDTH_PERCENT, DEFAULT.widthPercent).coerceIn(30, 100),
            fontSizeLevel = p.getInt(KEY_FONT_SIZE_LEVEL, DEFAULT.fontSizeLevel).coerceIn(0, 4),
            sungColorArgb = p.getInt(KEY_SUNG_COLOR, DEFAULT.sungColorArgb),
            unsungColorArgb = p.getInt(KEY_UNSUNG_COLOR, DEFAULT.unsungColorArgb),
        )
    }

    fun write(context: Context, config: StatusBarLyricConfig) {
        prefs(context).edit()
            .putBoolean(KEY_ENABLED, config.enabled)
            .putInt(KEY_X_PERCENT, config.xPercent.coerceIn(0, 100))
            .putInt(KEY_Y_DP, config.yDp.coerceIn(0, 160))
            .putInt(KEY_WIDTH_PERCENT, config.widthPercent.coerceIn(30, 100))
            .putInt(KEY_FONT_SIZE_LEVEL, config.fontSizeLevel.coerceIn(0, 4))
            .putInt(KEY_SUNG_COLOR, config.sungColorArgb)
            .putInt(KEY_UNSUNG_COLOR, config.unsungColorArgb)
            .apply()
    }

    fun reset(context: Context) {
        write(context, DEFAULT)
    }

    fun isEnabled(context: Context): Boolean = read(context).enabled

    fun fontSizeSp(level: Int): Float = when (level.coerceIn(0, 4)) {
        0 -> 11f
        1 -> 13f
        2 -> 15f
        3 -> 17f
        else -> 19f
    }
}
