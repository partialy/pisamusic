package cn.partialy.pm.directmessage

import android.app.Activity
import android.os.SystemClock
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.suspendCancellableCoroutine
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume

enum class DirectMessageCheckSource {
    STARTUP,
    LOGIN,
    REGISTER,
}

/**
 * 进程内只允许一条专属消息队列展示。队列消费完成前，后续启动/登录检查会串行等待，避免弹窗重叠。
 */
@Singleton
class DirectMessageCoordinator @Inject constructor(
    private val repository: DirectMessageRepository,
    private val ackDispatcher: DirectMessageAckDispatcher,
) {
    private val checkMutex = Mutex()
    private val rules = DirectMessageQueueRules()

    suspend fun checkAndShow(
        activity: Activity,
        @Suppress("UNUSED_PARAMETER") source: DirectMessageCheckSource,
    ): Boolean = checkMutex.withLock {
        if (activity.isFinishing || activity.isDestroyed) return@withLock false
        val identity = repository.captureIdentity()
        val unread = runCatching { repository.getUnread(identity) }.getOrNull() ?: return@withLock false
        val items = rules.normalize(unread.items)
            .filterNot { ackDispatcher.wasDismissed(it.id) }
        if (items.isEmpty()) return@withLock false

        DirectMessageQueueSession(
            activity = activity,
            identity = identity,
            items = items,
            rules = rules,
            ackDispatcher = ackDispatcher,
        ).showUntilFinished()
        true
    }
}

private class DirectMessageQueueSession(
    private val activity: Activity,
    private val identity: DirectMessageIdentitySnapshot,
    items: List<DirectMessageItem>,
    private val rules: DirectMessageQueueRules,
    private val ackDispatcher: DirectMessageAckDispatcher,
) {
    private val queue = DirectMessageQueueState(items)
    private var unlockAt: Long? = null
    private var currentDialog: android.app.Dialog? = null
    private var continuation: CancellableContinuation<Unit>? = null
    private var finished = false

    suspend fun showUntilFinished() {
        suspendCancellableCoroutine<Unit> { next ->
            continuation = next
            next.invokeOnCancellation { closeWithoutAcknowledgement() }
            showNext()
        }
    }

    private fun showNext() {
        if (finished) return
        if (activity.isFinishing || activity.isDestroyed) {
            finishQueue()
            return
        }
        val next = queue.current
        if (next == null) {
            finishQueue()
            return
        }

        val deadline = unlockAt ?: (SystemClock.elapsedRealtime() + CONFIRM_GATE_MS).also {
            unlockAt = it
        }
        currentDialog = DirectMessageDialog.show(
            activity = activity,
            item = next,
            unlockAt = deadline,
            rules = rules,
            onConfirmed = {
                currentDialog = null
                // 先推进本地队列，回执在独立 IO scope 中异步处理，不影响下一条的展示。
                queue.dismissCurrent()
                showNext()
                ackDispatcher.dismissAndAck(identity, next.id)
            },
            onDismissedWithoutConfirmation = ::closeWithoutAcknowledgement,
        )
    }

    private fun closeWithoutAcknowledgement() {
        if (finished) return
        val dialog = currentDialog
        currentDialog = null
        dialog?.dismiss()
        finishQueue()
    }

    private fun finishQueue() {
        if (finished) return
        finished = true
        continuation?.takeIf { it.isActive }?.resume(Unit)
        continuation = null
    }

    private companion object {
        private const val CONFIRM_GATE_MS = 3_000L
    }
}
