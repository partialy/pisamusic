package cn.partialy.pm.ui.player

import kotlin.math.abs

/** 一次手势只锁定一次方向；近似对角线继续交给后续位移判定。 */
object PlayerSwipeDirectionPolicy {
    enum class Direction { UNDECIDED, HORIZONTAL, VERTICAL }

    fun resolve(dx: Float, dy: Float, touchSlop: Float, previous: Direction = Direction.UNDECIDED): Direction {
        if (previous != Direction.UNDECIDED) return previous
        val x = abs(dx)
        val y = abs(dy)
        if (maxOf(x, y) <= touchSlop) return Direction.UNDECIDED
        return when {
            x > y * 1.2f -> Direction.HORIZONTAL
            y > x * 1.2f -> Direction.VERTICAL
            else -> Direction.UNDECIDED
        }
    }
}
