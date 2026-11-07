package cn.partialy.pm.download

import java.io.File
import java.util.concurrent.ConcurrentHashMap

/** 下载、修复与删除共享 canonical 路径锁；锁对象不移除，避免等待者交叉。 */
object DownloadFileLocks {
    private val locks = ConcurrentHashMap<String, Any>()
    @JvmStatic fun lockFor(file: File): Any = locks.getOrPut(file.canonicalPath) { Any() }
    fun <T> withFile(file: File, action: () -> T): T = synchronized(lockFor(file), action)
}
