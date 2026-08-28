package cn.partialy.pm.player

import java.util.concurrent.atomic.AtomicLong

/** 整批构造任一项失败时不交付半成品。 */
internal fun <T, R> prepareAllOrNull(
    values: List<T>,
    transform: (T) -> R,
): List<R>? = try {
    values.map(transform)
} catch (_: Exception) {
    null
}

/** 与同步版本语义一致，供需要异步取链的媒体项构造使用。 */
internal suspend fun <T, R> prepareAllOrNullSuspending(
    values: List<T>,
    transform: suspend (T) -> R,
): List<R>? = try {
    values.map { transform(it) }
} catch (_: Exception) {
    null
}

internal data class PreparedRestoredQueue<T, R>(
    val values: List<T>,
    val items: List<R>,
    val currentIndex: Int,
    val selectedOriginalIndex: Int,
)

/**
 * 恢复时仅交付成功构造的真实媒体项；全部失败则放弃恢复，不制造可进入 prepare 的占位 URI。
 */
internal fun <T, R> prepareRestoredQueue(
    values: List<T>,
    requestedIndex: Int,
    transform: (T) -> R,
): PreparedRestoredQueue<T, R>? {
    if (values.isEmpty()) return null
    val safeRequestedIndex = requestedIndex.coerceIn(0, values.lastIndex)
    val successful = values.mapIndexedNotNull { index, value ->
        try {
            Triple(index, value, transform(value))
        } catch (_: Exception) {
            null
        }
    }
    if (successful.isEmpty()) return null

    val selectedOriginalIndex = (0 until values.size)
        .map { offset -> (safeRequestedIndex + offset) % values.size }
        .first { candidate -> successful.any { it.first == candidate } }
    val currentIndex = successful.indexOfFirst { it.first == selectedOriginalIndex }
    return PreparedRestoredQueue(
        values = successful.map { it.second },
        items = successful.map { it.third },
        currentIndex = currentIndex,
        selectedOriginalIndex = selectedOriginalIndex,
    )
}

/** 恢复队列的挂起版本；失败项仍被丢弃，绝不制造可播放占位 URI。 */
internal suspend fun <T, R> prepareRestoredQueueSuspending(
    values: List<T>,
    requestedIndex: Int,
    transform: suspend (T) -> R,
): PreparedRestoredQueue<T, R>? {
    if (values.isEmpty()) return null
    val safeRequestedIndex = requestedIndex.coerceIn(0, values.lastIndex)
    val successful = buildList {
        values.forEachIndexed { index, value ->
            try {
                add(Triple(index, value, transform(value)))
            } catch (_: Exception) {
                Unit
            }
        }
    }
    if (successful.isEmpty()) return null

    val selectedOriginalIndex = (values.indices)
        .map { offset -> (safeRequestedIndex + offset) % values.size }
        .first { candidate -> successful.any { it.first == candidate } }
    val currentIndex = successful.indexOfFirst { it.first == selectedOriginalIndex }
    return PreparedRestoredQueue(
        values = successful.map { it.second },
        items = successful.map { it.third },
        currentIndex = currentIndex,
        selectedOriginalIndex = selectedOriginalIndex,
    )
}

/** 所有异步列表准备共享同一代次，新的替换请求会让旧结果失去提交资格。 */
internal class PlaylistPreparationGate {
    private val generation = AtomicLong(0L)

    fun nextReplacement(): Long = generation.incrementAndGet()

    fun current(): Long = generation.get()

    fun isCurrent(token: Long): Boolean = generation.get() == token

    fun invalidate() {
        generation.incrementAndGet()
    }
}
