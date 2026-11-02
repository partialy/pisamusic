package cn.partialy.pm.ui.message

import java.util.concurrent.atomic.AtomicBoolean

/** 只携带消息编号；迟到的 dismiss 不会关闭后来的消息。 */
class MessageHandle internal constructor(internal val id: Long) {
    internal val dismissed = AtomicBoolean(false)
    fun dismiss() {
        if (dismissed.compareAndSet(false, true)) PmMessageHost.dismiss(id)
    }
}
