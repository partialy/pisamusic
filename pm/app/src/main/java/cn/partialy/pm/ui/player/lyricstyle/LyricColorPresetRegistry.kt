package cn.partialy.pm.ui.player.lyricstyle

import android.content.Context
import cn.partialy.pm.R

internal data class LyricColorSlotSpec(
    val styleId: LyricEffectStyleId,
    val slotKey: String,
    val titleRes: Int,
    val allowAlpha: Boolean,
    val defaultColor: Int,
    val defaultPresets: List<Int>,
    val readEffectColor: ((LyricEffectConfig) -> Int)? = null,
    val writeEffectColor: ((LyricEffectConfig, Int) -> LyricEffectConfig)? = null,
) {
    fun storageKey(): String = "lyric.color_presets.${styleId.id}.$slotKey"

    fun normalizeColor(color: Int): Int =
        if (allowAlpha) color else ((0xFF shl 24) or (color and 0x00FFFFFF))
}

/**
 * 统一注册每种歌词样式的独立颜色设置项（Slot）及其默认色板与联动读写规则。
 */
internal object LyricColorPresetRegistry {

    const val SLOT_DEFAULT_NORMAL = "normal"
    const val SLOT_DEFAULT_CURRENT = "current"

    private fun buildDefaultEffectPresets(
        defaultColor: Int,
        isUnlitPalette: Boolean,
    ): List<Int> {
        val seed = LinkedHashSet<Int>()
        seed += defaultColor
        seed += if (isUnlitPalette) {
            LyricStyleParamsMeta.DEFAULT_UNLIT_PALETTE
        } else {
            LyricStyleParamsMeta.DEFAULT_EFFECT_PALETTE
        }
        return seed.take(12)
    }

    private fun effectSlot(
        styleId: LyricEffectStyleId,
        slotKey: String,
        titleRes: Int,
        defaultColor: Int,
        isUnlitPalette: Boolean = false,
        read: (LyricEffectConfig) -> Int,
        write: (LyricEffectConfig, Int) -> LyricEffectConfig,
    ): LyricColorSlotSpec = LyricColorSlotSpec(
        styleId = styleId,
        slotKey = slotKey,
        titleRes = titleRes,
        allowAlpha = true,
        defaultColor = defaultColor,
        defaultPresets = buildDefaultEffectPresets(defaultColor, isUnlitPalette),
        readEffectColor = read,
        writeEffectColor = write,
    )

    private val defaultSlots: List<LyricColorSlotSpec> = listOf(
        LyricColorSlotSpec(
            styleId = LyricEffectStyleId.DEFAULT,
            slotKey = SLOT_DEFAULT_NORMAL,
            titleRes = R.string.lyric_color_picker_title_normal,
            allowAlpha = false,
            defaultColor = 0xFFBFBFBF.toInt(),
            defaultPresets = emptyList(),
        ),
        LyricColorSlotSpec(
            styleId = LyricEffectStyleId.DEFAULT,
            slotKey = SLOT_DEFAULT_CURRENT,
            titleRes = R.string.lyric_color_picker_title_current,
            allowAlpha = true,
            defaultColor = 0xFFFFFFFF.toInt(),
            defaultPresets = emptyList(),
        ),
    )

    private val typewriterSlots: List<LyricColorSlotSpec> = listOf(
        effectSlot(
            styleId = LyricEffectStyleId.TYPEWRITER,
            slotKey = "textColor",
            titleRes = R.string.lyric_param_text_color,
            defaultColor = TypewriterEffectConfig().textColorArgb,
            read = { it.typewriter.textColorArgb },
            write = { cfg, c -> cfg.copy(typewriter = cfg.typewriter.copy(textColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.TYPEWRITER,
            slotKey = "latestGlowColor",
            titleRes = R.string.lyric_param_latest_glow_color,
            defaultColor = TypewriterEffectConfig().latestGlowColorArgb,
            read = { it.typewriter.latestGlowColorArgb },
            write = { cfg, c -> cfg.copy(typewriter = cfg.typewriter.copy(latestGlowColorArgb = c)) },
        ),
    )

    private val inkSlots: List<LyricColorSlotSpec> = listOf(
        effectSlot(
            styleId = LyricEffectStyleId.INK,
            slotKey = "unlitColor",
            titleRes = R.string.lyric_param_unlit_color,
            defaultColor = InkEffectConfig().unlitColorArgb,
            isUnlitPalette = true,
            read = { it.ink.unlitColorArgb },
            write = { cfg, c -> cfg.copy(ink = cfg.ink.copy(unlitColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.INK,
            slotKey = "highlightStartColor",
            titleRes = R.string.lyric_param_highlight_start_color,
            defaultColor = InkEffectConfig().highlightStartColorArgb,
            read = { it.ink.highlightStartColorArgb },
            write = { cfg, c -> cfg.copy(ink = cfg.ink.copy(highlightStartColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.INK,
            slotKey = "highlightTipColor",
            titleRes = R.string.lyric_param_highlight_tip_color,
            defaultColor = InkEffectConfig().highlightTipColorArgb,
            read = { it.ink.highlightTipColorArgb },
            write = { cfg, c -> cfg.copy(ink = cfg.ink.copy(highlightTipColorArgb = c)) },
        ),
    )

    private val bounceSlots: List<LyricColorSlotSpec> = listOf(
        effectSlot(
            styleId = LyricEffectStyleId.BOUNCE,
            slotKey = "unlitColor",
            titleRes = R.string.lyric_param_unlit_color,
            defaultColor = BounceEffectConfig().unlitColorArgb,
            isUnlitPalette = true,
            read = { it.bounce.unlitColorArgb },
            write = { cfg, c -> cfg.copy(bounce = cfg.bounce.copy(unlitColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.BOUNCE,
            slotKey = "sungColor",
            titleRes = R.string.lyric_param_sung_color,
            defaultColor = BounceEffectConfig().sungColorArgb,
            read = { it.bounce.sungColorArgb },
            write = { cfg, c -> cfg.copy(bounce = cfg.bounce.copy(sungColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.BOUNCE,
            slotKey = "activeColor",
            titleRes = R.string.lyric_param_active_color,
            defaultColor = BounceEffectConfig().activeColorArgb,
            read = { it.bounce.activeColorArgb },
            write = { cfg, c -> cfg.copy(bounce = cfg.bounce.copy(activeColorArgb = c)) },
        ),
    )

    private val spotlightSlots: List<LyricColorSlotSpec> = listOf(
        effectSlot(
            styleId = LyricEffectStyleId.SPOTLIGHT,
            slotKey = "unlitColor",
            titleRes = R.string.lyric_param_unlit_color,
            defaultColor = SpotlightEffectConfig().unlitColorArgb,
            isUnlitPalette = true,
            read = { it.spotlight.unlitColorArgb },
            write = { cfg, c -> cfg.copy(spotlight = cfg.spotlight.copy(unlitColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.SPOTLIGHT,
            slotKey = "sungColor",
            titleRes = R.string.lyric_param_sung_color,
            defaultColor = SpotlightEffectConfig().sungColorArgb,
            read = { it.spotlight.sungColorArgb },
            write = { cfg, c -> cfg.copy(spotlight = cfg.spotlight.copy(sungColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.SPOTLIGHT,
            slotKey = "activeColor",
            titleRes = R.string.lyric_param_spotlight_active_color,
            defaultColor = SpotlightEffectConfig().activeColorArgb,
            read = { it.spotlight.activeColorArgb },
            write = { cfg, c -> cfg.copy(spotlight = cfg.spotlight.copy(activeColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.SPOTLIGHT,
            slotKey = "glowColor",
            titleRes = R.string.lyric_param_spotlight_glow_color,
            defaultColor = SpotlightEffectConfig().glowColorArgb,
            read = { it.spotlight.glowColorArgb },
            write = { cfg, c -> cfg.copy(spotlight = cfg.spotlight.copy(glowColorArgb = c)) },
        ),
    )

    private val neonSlots: List<LyricColorSlotSpec> = listOf(
        effectSlot(
            styleId = LyricEffectStyleId.NEON,
            slotKey = "unlitColor",
            titleRes = R.string.lyric_param_unlit_color,
            defaultColor = NeonEffectConfig().unlitColorArgb,
            isUnlitPalette = true,
            read = { it.neon.unlitColorArgb },
            write = { cfg, c -> cfg.copy(neon = cfg.neon.copy(unlitColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.NEON,
            slotKey = "colorStart",
            titleRes = R.string.lyric_param_neon_color_1,
            defaultColor = NeonEffectConfig().colorStartArgb,
            read = { it.neon.colorStartArgb },
            write = { cfg, c -> cfg.copy(neon = cfg.neon.copy(colorStartArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.NEON,
            slotKey = "colorMid",
            titleRes = R.string.lyric_param_neon_color_2,
            defaultColor = NeonEffectConfig().colorMidArgb,
            read = { it.neon.colorMidArgb },
            write = { cfg, c -> cfg.copy(neon = cfg.neon.copy(colorMidArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.NEON,
            slotKey = "colorEnd",
            titleRes = R.string.lyric_param_neon_color_3,
            defaultColor = NeonEffectConfig().colorEndArgb,
            read = { it.neon.colorEndArgb },
            write = { cfg, c -> cfg.copy(neon = cfg.neon.copy(colorEndArgb = c)) },
        ),
    )

    private val oceanSlots: List<LyricColorSlotSpec> = listOf(
        effectSlot(
            styleId = LyricEffectStyleId.OCEAN,
            slotKey = "unlitColor",
            titleRes = R.string.lyric_param_unlit_color,
            defaultColor = OceanEffectConfig().unlitColorArgb,
            isUnlitPalette = true,
            read = { it.ocean.unlitColorArgb },
            write = { cfg, c -> cfg.copy(ocean = cfg.ocean.copy(unlitColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.OCEAN,
            slotKey = "sungColor",
            titleRes = R.string.lyric_param_sung_color,
            defaultColor = OceanEffectConfig().sungColorArgb,
            read = { it.ocean.sungColorArgb },
            write = { cfg, c -> cfg.copy(ocean = cfg.ocean.copy(sungColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.OCEAN,
            slotKey = "crestColor",
            titleRes = R.string.lyric_param_ocean_crest_color,
            defaultColor = OceanEffectConfig().crestColorArgb,
            read = { it.ocean.crestColorArgb },
            write = { cfg, c -> cfg.copy(ocean = cfg.ocean.copy(crestColorArgb = c)) },
        ),
        effectSlot(
            styleId = LyricEffectStyleId.OCEAN,
            slotKey = "glowColor",
            titleRes = R.string.lyric_param_ocean_glow_color,
            defaultColor = OceanEffectConfig().glowColorArgb,
            read = { it.ocean.glowColorArgb },
            write = { cfg, c -> cfg.copy(ocean = cfg.ocean.copy(glowColorArgb = c)) },
        ),
    )

    private val slotsByStyle: Map<LyricEffectStyleId, List<LyricColorSlotSpec>> = mapOf(
        LyricEffectStyleId.DEFAULT to defaultSlots,
        LyricEffectStyleId.TYPEWRITER to typewriterSlots,
        LyricEffectStyleId.INK to inkSlots,
        LyricEffectStyleId.BOUNCE to bounceSlots,
        LyricEffectStyleId.SPOTLIGHT to spotlightSlots,
        LyricEffectStyleId.NEON to neonSlots,
        LyricEffectStyleId.OCEAN to oceanSlots,
    )

    fun slotsFor(styleId: LyricEffectStyleId): List<LyricColorSlotSpec> =
        slotsByStyle[styleId] ?: defaultSlots

    fun findSlot(styleId: LyricEffectStyleId, slotKey: String): LyricColorSlotSpec? =
        slotsFor(styleId).firstOrNull { it.slotKey == slotKey }

    fun slotTitle(context: Context, spec: LyricColorSlotSpec): String =
        context.getString(spec.titleRes)
}
