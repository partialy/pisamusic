package cn.partialy.pm.ui.player.background

internal data class FlowingCoverMotionSpec(
    val translationXFraction: Float,
    val translationYFraction: Float,
    val scale: Float,
    val rotationDegrees: Float,
    val durationMs: Long,
)

internal object FlowingCoverMotionRules {
    fun specs(seed: Long): List<FlowingCoverMotionSpec> {
        val random = kotlin.random.Random(seed)
        val durations = longArrayOf(29_000L, 37_000L, 43_000L, 53_000L)
        return List(4) { index ->
            FlowingCoverMotionSpec(
                translationXFraction = random.nextDouble(-0.12, 0.12).toFloat(),
                translationYFraction = random.nextDouble(-0.12, 0.12).toFloat(),
                scale = random.nextDouble(1.04, 1.18).toFloat(),
                rotationDegrees = random.nextDouble(-2.0, 2.0).toFloat(),
                durationMs = durations[index],
            )
        }
    }
}
