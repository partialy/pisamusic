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
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    fun request(context: Context) {
        if (!SyncPrefs.getState(context).bound) return
        if (!running.compareAndSet(false, true)) return
        val appContext = context.applicationContext
        scope.launch {
            try {
                val entryPoint = EntryPointAccessors.fromApplication(
                    appContext,
                    SyncEntryPoint::class.java,
                )
                entryPoint.syncManager().syncNow()
            } finally {
                running.set(false)
            }
        }
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface SyncEntryPoint {
        fun syncManager(): SyncManager
    }
}
