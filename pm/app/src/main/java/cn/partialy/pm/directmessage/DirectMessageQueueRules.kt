package cn.partialy.pm.directmessage

import kotlin.math.max

/** 纯队列规则，便于在不依赖 Android UI 的情况下验证消息展示顺序与共享门禁。 */
class DirectMessageQueueRules {
    fun canConfirm(unlockAt: Long, now: Long): Boolean = now >= unlockAt

    fun remainingMs(unlockAt: Long, now: Long): Long = max(0L, unlockAt - now)

    fun normalize(items: List<DirectMessageItem>): List<DirectMessageItem> =
        items
            .asSequence()
            .filter { it.id.isNotBlank() }
            .distinctBy { it.id }
            .sortedWith(compareBy<DirectMessageItem> { it.createdAt }.thenBy { it.id })
            .toList()
}

/** 队列推进不依赖网络回执，供 Coordinator 与单测共享。 */
class DirectMessageQueueState(items: List<DirectMessageItem>) {
    private val pending = ArrayDeque(items)

    var current: DirectMessageItem? = pending.removeFirstOrNull()
        private set

    fun dismissCurrent() {
        current = pending.removeFirstOrNull()
    }
}
