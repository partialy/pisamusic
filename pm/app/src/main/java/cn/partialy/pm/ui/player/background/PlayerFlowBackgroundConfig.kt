package cn.partialy.pm.ui.player.background

import kotlin.math.roundToInt

internal enum class PlayerFlowColorMode { FOLLOW_COVER, SOFT, VIVID }

internal data class PlayerFlowBackgroundConfig(
    val speedX10: Int = 10,
    val motionAmplitudePercent: Int = 50,
    val glowIntensityPercent: Int = 50,
    val brightnessPercent: Int = 50,
    val saturationPercent: Int = 50,
    val colorMode: PlayerFlowColorMode = PlayerFlowColorMode.FOLLOW_COVER,
) {
    val speedMultiplier: Float get() = speedX10.coerceIn(5, 20) / 10f
    val isDefault: Boolean get() = normalized() == PlayerFlowBackgroundConfig()

    fun normalized(): PlayerFlowBackgroundConfig = copy(
        speedX10 = speedX10.coerceIn(5, 20),
        motionAmplitudePercent = normalizePercent(motionAmplitudePercent),
        glowIntensityPercent = normalizePercent(glowIntensityPercent),
        brightnessPercent = normalizePercent(brightnessPercent),
        saturationPercent = normalizePercent(saturationPercent),
    )

    private fun normalizePercent(value: Int): Int =
        (value.coerceIn(0, 100) / 5f).roundToInt() * 5
}
