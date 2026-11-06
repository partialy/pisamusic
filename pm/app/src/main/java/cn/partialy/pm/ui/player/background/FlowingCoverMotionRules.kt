package cn.partialy.pm.ui.player.background

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

internal data class FlowingCoverMotionSpec(val phase: Double, val periodSeconds: Double)
internal data class FlowingCoverPosition(val x: Float, val y: Float, val radius: Float)

internal object FlowingCoverMotionRules {
    fun specs(seed: Long): List<FlowingCoverMotionSpec> {
        val random = kotlin.random.Random(seed)
        return List(4) { index -> FlowingCoverMotionSpec(random.nextDouble(0.0, PI * 2), 16.0 + index * 3.7) }
    }

    fun position(spec: FlowingCoverMotionSpec, index: Int, timeSeconds: Double, amplitude: Float): FlowingCoverPosition {
        val result = FloatArray(3)
        positionInto(spec, index, timeSeconds, amplitude, result)
        return FlowingCoverPosition(result[0], result[1], result[2])
    }

    /** 渲染热路径复用输出缓冲区，避免逐帧创建位置对象。 */
    fun positionInto(spec: FlowingCoverMotionSpec, index: Int, timeSeconds: Double, amplitude: Float, result: FloatArray) {
        val phase = timeSeconds * PI * 2 / spec.periodSeconds + spec.phase
        val anchorX = if (index % 2 == 0) 0.22 else 0.78
        val anchorY = if (index < 2) 0.25 else 0.77
        result[0] = (anchorX + amplitude * (0.23 * sin(phase) + 0.09 * sin(phase * 0.61))).toFloat()
        result[1] = (anchorY + amplitude * (0.23 * cos(phase * 0.83) + 0.08 * sin(phase * 1.31))).toFloat()
        result[2] = (0.72 + 0.11 * sin(phase * 0.71)).toFloat()
    }

    fun frameIntervalMs(preview: Boolean, powerSave: Boolean): Long = if (preview || powerSave) 67L else 34L
}
