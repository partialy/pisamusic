package cn.partialy.pm.ui.player.lyricstyle

import android.content.Context
import cn.partialy.pm.R
import cn.partialy.pm.ui.dialog.SettingsOption

internal object LyricStyleParamsMeta {

    fun styleLabel(context: Context, styleId: LyricEffectStyleId): String = when (styleId) {
        LyricEffectStyleId.DEFAULT -> context.getString(R.string.lyric_effect_style_default)
        LyricEffectStyleId.TYPEWRITER -> context.getString(R.string.lyric_effect_style_typewriter)
        LyricEffectStyleId.INK -> context.getString(R.string.lyric_effect_style_ink)
        LyricEffectStyleId.BOUNCE -> context.getString(R.string.lyric_effect_style_bounce)
        LyricEffectStyleId.SPOTLIGHT -> context.getString(R.string.lyric_effect_style_spotlight)
        LyricEffectStyleId.NEON -> context.getString(R.string.lyric_effect_style_neon)
        LyricEffectStyleId.OCEAN -> context.getString(R.string.lyric_effect_style_ocean)
    }

    fun styleDescription(context: Context, styleId: LyricEffectStyleId): String = when (styleId) {
        LyricEffectStyleId.DEFAULT -> context.getString(R.string.lyric_effect_style_default_desc)
        LyricEffectStyleId.TYPEWRITER -> context.getString(R.string.lyric_effect_style_typewriter_desc)
        LyricEffectStyleId.INK -> context.getString(R.string.lyric_effect_style_ink_desc)
        LyricEffectStyleId.BOUNCE -> context.getString(R.string.lyric_effect_style_bounce_desc)
        LyricEffectStyleId.SPOTLIGHT -> context.getString(R.string.lyric_effect_style_spotlight_desc)
        LyricEffectStyleId.NEON -> context.getString(R.string.lyric_effect_style_neon_desc)
        LyricEffectStyleId.OCEAN -> context.getString(R.string.lyric_effect_style_ocean_desc)
    }

    fun styleOptions(context: Context): List<SettingsOption> =
        LyricEffectStyleId.values().map { id ->
            SettingsOption(
                id = id.id,
                label = styleLabel(context, id),
                summary = styleDescription(context, id),
            )
        }

    fun fpsShortLabel(context: Context, fps: Int): String {
        val normalized = LyricRenderFps.normalize(fps)
        return if (normalized == LyricRenderFps.UNLIMITED) {
            context.getString(R.string.lyric_fps_option_unlimited_short)
        } else {
            context.getString(R.string.lyric_fps_option_value, normalized)
        }
    }

    fun fpsOptions(context: Context): List<SettingsOption> = listOf(
        SettingsOption(
            id = "30",
            label = context.getString(R.string.lyric_fps_option_value, 30),
            summary = context.getString(R.string.lyric_fps_option_30_desc),
        ),
        SettingsOption(
            id = "60",
            label = context.getString(R.string.lyric_fps_option_value, 60),
            summary = context.getString(R.string.lyric_fps_option_60_desc),
        ),
        SettingsOption(
            id = "90",
            label = context.getString(R.string.lyric_fps_option_value, 90),
            summary = context.getString(R.string.lyric_fps_option_90_desc),
        ),
        SettingsOption(
            id = "120",
            label = context.getString(R.string.lyric_fps_option_value, 120),
            summary = context.getString(R.string.lyric_fps_option_120_desc),
        ),
        SettingsOption(
            id = "0",
            label = context.getString(R.string.lyric_fps_option_unlimited),
            summary = context.getString(R.string.lyric_fps_option_unlimited_desc),
        ),
    )

    val DEFAULT_EFFECT_PALETTE: List<Int> = listOf(
        0xFFFFFFFF.toInt(),
        0xFF38BDF8.toInt(),
        0xFF2897FF.toInt(),
        0xFF67E8F9.toInt(),
        0xFFE0F7FF.toInt(),
        0xFF20B46B.toInt(),
        0xFF34D399.toInt(),
        0xFFA78BFA.toInt(),
        0xFFFFE082.toInt(),
        0xFFFF7AA2.toInt(),
    )

    val DEFAULT_UNLIT_PALETTE: List<Int> = listOf(
        0x57F1F5F9.toInt(),
        0x5CF1F5F9.toInt(),
        0x80FFFFFF.toInt(),
        0x66CBD5E1.toInt(),
        0x6694A3B8.toInt(),
        0x99E2E8F0.toInt(),
    )
}
