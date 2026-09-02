package cn.partialy.pm.directmessage

import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 仅在当前进程存活期间尝试回执。已点击的消息不会写入本地持久化，网络失败时下次启动仍会由服务端返回。
 */
@Singleton
class DirectMessageAckDispatcher @Inject constructor(
    private val repository: DirectMessageRepository,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val dismissedThisProcess = ConcurrentHashMap.newKeySet<String>()
    private val inFlight = ConcurrentHashMap.newKeySet<String>()

    fun wasDismissed(messageId: String): Boolean = messageId in dismissedThisProcess

    fun dismissAndAck(
        identity: DirectMessageIdentitySnapshot,
        messageId: String,
    ) {
        if (messageId.isBlank()) return
        dismissedThisProcess += messageId
        if (!inFlight.add(messageId)) return

        scope.launch {
            try {
                for (delayMs in RETRY_DELAYS_MS) {
                    if (delayMs > 0L) delay(delayMs)
                    val sent = runCatching {
                        repository.markRead(identity, messageId)
                    }.isSuccess
                    if (sent) return@launch
                }
                Log.d(TAG, "专属消息已读回执将在下次启动时重试")
            } finally {
                inFlight.remove(messageId)
            }
        }
    }

    private companion object {
        private const val TAG = "DirectMessageAck"
        private val RETRY_DELAYS_MS = longArrayOf(0L, 2_000L, 8_000L)
    }
}
