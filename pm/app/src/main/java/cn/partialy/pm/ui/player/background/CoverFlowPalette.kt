package cn.partialy.pm.ui.player.background

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sqrt

internal data class CoverFlowPalette(
    val baseColor: Int,
    val blobColors: List<Int>,
) {
    init {
        require(blobColors.size == 4)
    }
}

internal object CoverFlowPaletteRules {
    private const val MIN_ALPHA = 0x80
    private const val MIN_COLOR_DISTANCE = 0.08
    private const val MIN_BLOB_SATURATION = 0.38
    private const val MAX_BLOB_SATURATION = 0.82
    private const val MIN_BLOB_LIGHTNESS = 0.30
    private const val MAX_BLOB_LIGHTNESS = 0.68
    private const val MIN_BASE_LIGHTNESS = 0.07
    private const val MAX_BASE_LIGHTNESS = 0.16

    private val fallbackPalette = CoverFlowPalette(
        baseColor = 0xFF081426.toInt(),
        blobColors = listOf(
            0xFF3178C6.toInt(),
            0xFF6A5CCB.toInt(),
            0xFF1696A7.toInt(),
            0xFFC05283.toInt(),
        ),
    )

    fun fromCandidates(colors: List<Int>): CoverFlowPalette {
        val selected = colors.fold(mutableListOf<Int>()) { result, color ->
            if (alpha(color) >= MIN_ALPHA && result.all { colorDistance(it, color) >= MIN_COLOR_DISTANCE }) {
                result += color
            }
            result
        }
        if (selected.isEmpty()) return fallbackPalette

        val dominantHsl = rgbToHsl(selected.first())
        val blobSaturation = dominantHsl.saturation.coerceIn(MIN_BLOB_SATURATION, MAX_BLOB_SATURATION)
        val blobLightness = dominantHsl.lightness.coerceIn(MIN_BLOB_LIGHTNESS, MAX_BLOB_LIGHTNESS)
        val hueRotations = doubleArrayOf(28.0, -34.0, 58.0)

        hueRotations.forEach { rotation ->
            if (selected.size == 4) return@forEach
            selected += hslToColor(dominantHsl.hue + rotation, blobSaturation, blobLightness)
        }

        return CoverFlowPalette(
            baseColor = hslToColor(
                dominantHsl.hue,
                dominantHsl.saturation,
                dominantHsl.lightness.coerceIn(MIN_BASE_LIGHTNESS, MAX_BASE_LIGHTNESS),
            ),
            blobColors = selected.take(4),
        )
    }

    fun colorDistance(first: Int, second: Int): Double {
        val redDifference = red(first) / 255.0 - red(second) / 255.0
        val greenDifference = green(first) / 255.0 - green(second) / 255.0
        val blueDifference = blue(first) / 255.0 - blue(second) / 255.0
        return sqrt(
            (redDifference * redDifference + greenDifference * greenDifference + blueDifference * blueDifference) / 3.0,
        )
    }

    fun relativeLuminance(color: Int): Double =
        0.2126 * linearized(red(color)) +
            0.7152 * linearized(green(color)) +
            0.0722 * linearized(blue(color))

    private fun alpha(color: Int): Int = color ushr 24 and 0xFF

    private fun red(color: Int): Int = color ushr 16 and 0xFF

    private fun green(color: Int): Int = color ushr 8 and 0xFF

    private fun blue(color: Int): Int = color and 0xFF

    private fun linearized(component: Int): Double {
        val normalized = component / 255.0
        return if (normalized <= 0.04045) {
            normalized / 12.92
        } else {
            ((normalized + 0.055) / 1.055).pow(2.4)
        }
    }

    private fun rgbToHsl(color: Int): Hsl {
        val red = red(color) / 255.0
        val green = green(color) / 255.0
        val blue = blue(color) / 255.0
        val maximum = max(red, max(green, blue))
        val minimum = min(red, min(green, blue))
        val delta = maximum - minimum
        val lightness = (maximum + minimum) / 2.0
        if (delta == 0.0) return Hsl(0.0, 0.0, lightness)

        val hue = when (maximum) {
            red -> 60.0 * (((green - blue) / delta) % 6.0)
            green -> 60.0 * ((blue - red) / delta + 2.0)
            else -> 60.0 * ((red - green) / delta + 4.0)
        }.let { if (it < 0.0) it + 360.0 else it }
        val saturation = delta / (1.0 - abs(2.0 * lightness - 1.0))
        return Hsl(hue, saturation, lightness)
    }

    private fun hslToColor(hue: Double, saturation: Double, lightness: Double): Int {
        val normalizedHue = ((hue % 360.0) + 360.0) % 360.0 / 360.0
        val chroma = (1.0 - abs(2.0 * lightness - 1.0)) * saturation
        val secondary = chroma * (1.0 - abs((normalizedHue * 6.0) % 2.0 - 1.0))
        val match = lightness - chroma / 2.0
        val (red, green, blue) = when ((normalizedHue * 6.0).toInt()) {
            0 -> Triple(chroma, secondary, 0.0)
            1 -> Triple(secondary, chroma, 0.0)
            2 -> Triple(0.0, chroma, secondary)
            3 -> Triple(0.0, secondary, chroma)
            4 -> Triple(secondary, 0.0, chroma)
            else -> Triple(chroma, 0.0, secondary)
        }
        return 0xFF000000.toInt() or
            (toColorComponent(red + match) shl 16) or
            (toColorComponent(green + match) shl 8) or
            toColorComponent(blue + match)
    }

    private fun toColorComponent(component: Double): Int =
        (component.coerceIn(0.0, 1.0) * 255.0).roundToInt()

    private data class Hsl(
        val hue: Double,
        val saturation: Double,
        val lightness: Double,
    )
}
