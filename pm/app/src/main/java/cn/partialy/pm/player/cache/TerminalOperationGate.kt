package cn.partialy.pm.player.cache

import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * 让普通操作与不可逆终止串行：终止会等待已进入操作，之后拒绝所有迟到操作。
 *
 * 使用可重入锁，允许门面内部组合多个受保护的 helper 而不引入自身死锁。
 */
internal class TerminalOperationGate(
    private val closedMessage: String,
) {
    private val lock = ReentrantLock()
    private var terminalClosed = false

    fun <T> runOpen(operation: () -> T): T = lock.withLock {
        check(!terminalClosed) { closedMessage }
        operation()
    }

    fun shutdown(cleanup: () -> Unit) {
        lock.withLock {
            if (terminalClosed) return
            terminalClosed = true
            cleanup()
        }
    }
}
