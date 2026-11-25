package cn.partialy.pm.ui.player.lyricstyle

import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlin.math.roundToInt

enum class LyricEffectStyleId(val id: String) {
    DEFAULT("default"),
    ACCOMPANIST("accompanist"),
    TYPEWRITER("typewriter"),
    INK("ink"),
    BOUNCE("bounce"),
    SPOTLIGHT("spotlight"),
    NEON("neon"),
    OCEAN("ocean"),
    ;

    val hasParameters: Boolean get() = this != DEFAULT

    companion object {
        fun fromId(raw: String?): LyricEffectStyleId =
            values().firstOrNull { it.id == raw } ?: DEFAULT
    }
}

object LyricRenderFps {
    const val DEFAULT = 60
    const val UNLIMITED = 0
    val ALLOWED_VALUES: List<Int> = listOf(30, 60, 90, 120, UNLIMITED)

    fun normalize(fps: Int): Int = if (fps in ALLOWED_VALUES) fps else DEFAULT
}

@Serializable
data class TypewriterEffectConfig(
    val textColorArgb: Int = 0xFF38BDF8.toInt(),
    val latestGlowColorArgb: Int = 0xFF7DD3FC.toInt(),
    val lineRevealDurationMs: Int = 600,
    val showCursor: Boolean = true,
) {
    fun normalized(): TypewriterEffectConfig = copy(
        lineRevealDurationMs = lineRevealDurationMs.coerceIn(150, 1500),
    )
}

@Serializable
data class InkEffectConfig(
    val unlitColorArgb: Int = 0x5CF1F5F9.toInt(),
    val highlightStartColorArgb: Int = 0xFF2897FF.toInt(),
    val highlightTipColorArgb: Int = 0xFF67E8F9.toInt(),
    val featherWidthDp: Int = 16,
    val liftOffsetDp: Float = 2.5f,
    val lineSweepDurationMs: Int = 950,
) {
    fun normalized(): InkEffectConfig = copy(
        featherWidthDp = featherWidthDp.coerceIn(6, 36),
        liftOffsetDp = roundToHalf(liftOffsetDp.coerceIn(0f, 8f)),
        lineSweepDurationMs = lineSweepDurationMs.coerceIn(200, 2000),
    )
}

@Serializable
data class BounceEffectConfig(
    val unlitColorArgb: Int = 0x5CF1F5F9.toInt(),
    val sungColorArgb: Int = 0xFF20B46B.toInt(),
    val activeColorArgb: Int = 0xFF34D399.toInt(),
    val jumpHeightDp: Int = 7,
    val jumpScale: Float = 1.14f,
) {
    fun normalized(): BounceEffectConfig = copy(
        jumpHeightDp = jumpHeightDp.coerceIn(2, 16),
        jumpScale = roundToTwoDecimals(jumpScale.coerceIn(1f, 1.3f)),
    )
}

@Serializable
data class SpotlightEffectConfig(
    val unlitColorArgb: Int = 0x57F1F5F9.toInt(),
    val sungColorArgb: Int = 0xFFF8FAFC.toInt(),
    val activeColorArgb: Int = 0xFFFFFFFF.toInt(),
    val glowColorArgb: Int = 0xEB38BDF8.toInt(),
    val blurIntensityDp: Float = 4f,
    val activeScale: Float = 1.07f,
) {
    fun normalized(): SpotlightEffectConfig = copy(
        blurIntensityDp = roundToHalf(blurIntensityDp.coerceIn(0f, 8f)),
        activeScale = roundToTwoDecimals(activeScale.coerceIn(1f, 1.25f)),
    )
}

@Serializable
data class NeonEffectConfig(
    val unlitColorArgb: Int = 0x57F1F5F9.toInt(),
    val colorStartArgb: Int = 0xFF20B46B.toInt(),
    val colorMidArgb: Int = 0xFF38BDF8.toInt(),
    val colorEndArgb: Int = 0xFFA78BFA.toInt(),
    val lineRevealDurationMs: Int = 650,
    val flowSpeed: Float = 1.0f,
) {
    fun normalized(): NeonEffectConfig = copy(
        lineRevealDurationMs = lineRevealDurationMs.coerceIn(150, 1500),
        flowSpeed = roundToOneDecimal(flowSpeed.coerceIn(0f, 2f)),
    )
}

@Serializable
data class OceanEffectConfig(
    val unlitColorArgb: Int = 0x57F1F5F9.toInt(),
    val sungColorArgb: Int = 0xFF38BDF8.toInt(),
    val crestColorArgb: Int = 0xFFE0F7FF.toInt(),
    val glowColorArgb: Int = 0xE038BDF8.toInt(),
    val jumpHeightDp: Int = 13,
    val showWaveLine: Boolean = true,
    val swayEnabled: Boolean = true,
) {
    fun normalized(): OceanEffectConfig = copy(
        jumpHeightDp = jumpHeightDp.coerceIn(4, 24),
    )
}

enum class AccompanistLyricAlignment { LEFT, CENTER, RIGHT }

enum class AccompanistLyricPosition(val fraction: Float) { TOP(0f), CENTER(0.5f), BOTTOM(1f) }

@Serializable
data class AccompanistLyricConfig(
    val fontSizeSp: Int = 34,
    val bold: Boolean = true,
    val alignment: AccompanistLyricAlignment = AccompanistLyricAlignment.LEFT,
    val position: AccompanistLyricPosition = AccompanistLyricPosition.TOP,
    val textColorArgb: Int = -1,
    val additiveBlend: Boolean = true,
    val blurEnabled: Boolean = false,
    val blurStrength: Int = 3,
    val dotsCount: Int = 3,
    val dotsSizeDp: Int = 16,
    val dotsSpacingDp: Int = 12,
    val dotsColorArgb: Int = -1,
) {
    fun normalized() = copy(
        fontSizeSp = fontSizeSp.coerceIn(FONT_SIZE_SP),
        blurStrength = blurStrength.coerceIn(BLUR_STRENGTH),
        dotsCount = dotsCount.coerceIn(DOTS_COUNT),
        dotsSizeDp = dotsSizeDp.coerceIn(DOTS_SIZE_DP),
        dotsSpacingDp = dotsSpacingDp.coerceIn(DOTS_SPACING_DP),
    )

    companion object {
        val FONT_SIZE_SP = 18..48
        val BLUR_STRENGTH = 1..6
        val DOTS_COUNT = 0..5
        val DOTS_SIZE_DP = 8..24
        val DOTS_SPACING_DP = 4..20
    }
}

@Serializable
data class LyricEffectConfig(
    val style: String = LyricEffectStyleId.DEFAULT.id,
    val fps: Int = LyricRenderFps.DEFAULT,
    val typewriter: TypewriterEffectConfig = TypewriterEffectConfig(),
    val ink: InkEffectConfig = InkEffectConfig(),
    val bounce: BounceEffectConfig = BounceEffectConfig(),
    val spotlight: SpotlightEffectConfig = SpotlightEffectConfig(),
    val neon: NeonEffectConfig = NeonEffectConfig(),
    val ocean: OceanEffectConfig = OceanEffectConfig(),
    val accompanist: AccompanistLyricConfig = AccompanistLyricConfig(),
) {
    val styleId: LyricEffectStyleId
        get() = LyricEffectStyleId.fromId(style)

    fun normalized(): LyricEffectConfig = copy(
        style = LyricEffectStyleId.fromId(style).id,
        fps = LyricRenderFps.normalize(fps),
        typewriter = typewriter.normalized(),
        ink = ink.normalized(),
        bounce = bounce.normalized(),
        spotlight = spotlight.normalized(),
        neon = neon.normalized(),
        ocean = ocean.normalized(),
        accompanist = accompanist.normalized(),
    )

    fun withStyle(styleId: LyricEffectStyleId): LyricEffectConfig =
        copy(style = styleId.id).normalized()

    fun resetStyle(styleId: LyricEffectStyleId): LyricEffectConfig = when (styleId) {
        LyricEffectStyleId.DEFAULT -> this
        LyricEffectStyleId.ACCOMPANIST -> copy(accompanist = AccompanistLyricConfig())
        LyricEffectStyleId.TYPEWRITER -> copy(typewriter = TypewriterEffectConfig())
        LyricEffectStyleId.INK -> copy(ink = InkEffectConfig())
        LyricEffectStyleId.BOUNCE -> copy(bounce = BounceEffectConfig())
        LyricEffectStyleId.SPOTLIGHT -> copy(spotlight = SpotlightEffectConfig())
        LyricEffectStyleId.NEON -> copy(neon = NeonEffectConfig())
        LyricEffectStyleId.OCEAN -> copy(ocean = OceanEffectConfig())
    }

    fun toJson(): String = serializerJson.encodeToString(normalized())

    companion object {
        val DEFAULT = LyricEffectConfig()

        private val serializerJson = Json {
            ignoreUnknownKeys = true
            encodeDefaults = true
            coerceInputValues = true
        }

        fun fromJson(json: String?): LyricEffectConfig {
            if (json.isNullOrBlank()) return DEFAULT
            return runCatching {
                serializerJson.decodeFromString<LyricEffectConfig>(json).normalized()
            }.getOrDefault(DEFAULT)
        }
    }
}

private fun roundToHalf(value: Float): Float = (value * 2f).roundToInt() / 2f
private fun roundToOneDecimal(value: Float): Float = (value * 10f).roundToInt() / 10f
private fun roundToTwoDecimals(value: Float): Float = (value * 100f).roundToInt() / 100f
