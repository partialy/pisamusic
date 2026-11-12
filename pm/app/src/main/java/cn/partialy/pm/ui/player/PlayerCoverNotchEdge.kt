package cn.partialy.pm.ui.player

import com.google.android.material.shape.EdgeTreatment
import com.google.android.material.shape.ShapePath

/** 复用封面自身的形状遮罩，右侧半圆真正透明，直接露出后方 CD。 */
internal class PlayerCoverNotchEdge(private val radius: Float) : EdgeTreatment(), Cloneable {
    override fun getEdgePath(length: Float, center: Float, interpolation: Float, shapePath: ShapePath) {
        val cutout = (radius * interpolation).coerceIn(0f, minOf(center, length - center).coerceAtLeast(0f))
        if (cutout > 0f) {
            shapePath.lineTo(center - cutout, 0f)
            // 边的局部正 Y 指向形状内部，负向半圆弧形成内凹缺口。
            shapePath.addArc(center - cutout, -cutout, center + cutout, cutout, 180f, -180f)
        }
        shapePath.lineTo(length, 0f)
    }
}
