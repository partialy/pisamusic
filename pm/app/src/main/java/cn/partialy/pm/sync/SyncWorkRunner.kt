package cn.partialy.pm.sync

import android.content.Context
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

object SyncWorkRunner {
    private val running = AtomicBoolean(false)
    private val requested = AtomicBoolean(false)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun request(context: Context) {
        if (!SyncPrefs.getState(context).loggedIn) return
        requested.set(true)
        startIfNeeded(context.applicationContext)
    }

    private fun startIfNeeded(appContext: Context) {
        if (!running.compareAndSet(false, true)) return
        scope.launch {
            try {
                val entryPoint = EntryPointAccessors.fromApplication(
                    appContext,
                    SyncEntryPoint::class.java,
                )
                do {
                    requested.set(false)
                    entryPoint.syncManager().syncNow()
                } while (requested.get())
            } finally {
                running.set(false)
                // 关闭运行标记前后到达的请求都必须能启动下一轮。
                if (requested.get()) startIfNeeded(appContext)
            }
        }
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface SyncEntryPoint {
        fun syncManager(): SyncManager
    }
}
