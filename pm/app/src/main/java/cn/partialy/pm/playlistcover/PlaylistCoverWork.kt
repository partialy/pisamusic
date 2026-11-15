package cn.partialy.pm.playlistcover

import android.content.Context
import androidx.work.*
import cn.partialy.pm.network.auth.AccountSessionStore
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit

object PlaylistCoverWork {
    private const val NAME="playlist-cover-upload"
    fun request(context: Context, replace: Boolean=false) {
        runCatching { schedule(context.applicationContext,replace) }
            .onFailure { android.util.Log.w("PlaylistCoverWork","封面排队失败，持久任务保留",it) }
    }
    private fun schedule(context: Context, replace: Boolean) {
        val session=AccountSessionStore.read(context)
        if(!session.loggedIn) { WorkManager.getInstance(context).cancelUniqueWork(NAME); return }
        val work=OneTimeWorkRequestBuilder<PlaylistCoverWorker>()
            .setInputData(workDataOf("account" to session.user.id))
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL,30,TimeUnit.SECONDS).build()
        WorkManager.getInstance(context).enqueueUniqueWork(NAME,
            if(replace) ExistingWorkPolicy.REPLACE else ExistingWorkPolicy.APPEND_OR_REPLACE,work)
    }
    @EntryPoint @InstallIn(SingletonComponent::class)
    interface Dependencies { fun coverUploadManager(): PlaylistCoverUploadManager }
}

class PlaylistCoverWorker(context: Context,params: WorkerParameters): CoroutineWorker(context,params) {
    override suspend fun doWork(): Result {
        val account=inputData.getString("account") ?: return Result.success()
        val session=AccountSessionStore.read(applicationContext)
        if(!session.loggedIn || session.user.id!=account) return Result.success()
        val manager=EntryPointAccessors.fromApplication(applicationContext,PlaylistCoverWork.Dependencies::class.java).coverUploadManager()
        return try {
            // 每个持久任务最多五次；队列较长时分批继续，不按 Worker 次数截断尚未执行的合法任务。
            if(manager.drain(account)) Result.retry() else Result.success()
        } catch(e: kotlinx.coroutines.CancellationException) { throw e }
        catch(e: Exception) { if(runAttemptCount<5) Result.retry() else Result.failure() }
    }
}
