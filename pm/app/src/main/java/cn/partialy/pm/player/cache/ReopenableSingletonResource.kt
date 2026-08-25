package cn.partialy.pm.player.cache

/** 线程安全地维持至多一个资源；release 后下一次访问会重新读取环境并创建。 */
internal class ReopenableSingletonResource<T : Any>(
    private val create: () -> T,
    private val close: (T) -> Unit,
) {
    private val lock = Any()

    @Volatile
    private var current: T? = null

    fun get(): T = current ?: synchronized(lock) {
        current ?: create().also { current = it }
    }

    fun <R> use(block: (T) -> R): R = synchronized(lock) {
        block(current ?: create().also { current = it })
    }

    fun release() {
        synchronized(lock) {
            val resource = current ?: return
            current = null
            close(resource)
        }
    }
}
