package cn.partialy.pm.download

import java.io.File

/** 下载、修复与删除共享 canonical 路径锁；锁对象不移除，避免等待者交叉。 */
object DownloadFileLocks {
    @JvmStatic fun lockFor(file: File): Any = DownloadPlaybackReservations.lockFor(file)
    fun <T> withFile(file: File, action: () -> T): T = synchronized(lockFor(file), action)
    fun reserveForPlayback(file: File): DownloadPlaybackReservations.Handle? = DownloadPlaybackReservations.reserve(file)
    fun isPlaybackReserved(file: File): Boolean = DownloadPlaybackReservations.isReserved(file)
}
