package cn.partialy.pm.sync

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit
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

    fun scheduleRetry(context: Context) {
        if (!SyncPrefs.getState(context).loggedIn) return
        val work = OneTimeWorkRequestBuilder<SyncRetryWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInitialDelay(30, TimeUnit.SECONDS)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork("account-sync-retry", ExistingWorkPolicy.KEEP, work)
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

/** 标准 Worker 构造，复用应用 Hilt entry point，无需额外 WorkerFactory。 */
class SyncRetryWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        if (!SyncPrefs.getState(applicationContext).loggedIn) return Result.success()
        val entryPoint = EntryPointAccessors.fromApplication(applicationContext, SyncWorkRunner.SyncEntryPoint::class.java)
        val state = entryPoint.syncManager().syncNow()
        return if (!state.loggedIn || state.lastError.isBlank()) Result.success() else Result.retry()
    }
}
