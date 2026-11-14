package cn.partialy.pm.ui.dialog

import android.app.Activity
import android.content.Context
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.sync.UnassociatedLibraryImporter
import cn.partialy.pm.ui.message.PmMessage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume

/** 登录与设置共用确认；只有明确确认才建立账号副本，不改本机未关联原件。 */
object UnassociatedLibraryImportPrompt {
    suspend fun show(activity: Activity, force: Boolean = false): Boolean {
        val session = AccountSessionStore.read(activity)
        if (!session.loggedIn) return false
        val accountId = session.user.id
        val generation = AccountSessionStore.libraryGeneration
        val prefs = activity.getSharedPreferences("pm_library_import_prompt", Context.MODE_PRIVATE)
        if (!force && prefs.getBoolean(accountId, false)) return false
        val importer = UnassociatedLibraryImporter(activity.applicationContext)
        val count = withContext(Dispatchers.IO) { importer.count() }
        if (count == 0 || activity.isFinishing || activity.isDestroyed) return false
        val accepted = suspendCancellableCoroutine { continuation ->
            val dialog = PmMinimalDialog.show(activity,
                title = "导入本机未关联数据",
                message = "本机有 $count 项未关联歌单或收藏。是否合并到当前账号？歌单会创建新的账号副本，本机原数据保留。",
                cancelText = "暂不导入", confirmText = "导入并合并",
                onConfirm = { if (continuation.isActive) continuation.resume(true) },
                onCancel = { if (continuation.isActive) continuation.resume(false) })
            dialog.setOnDismissListener { if (continuation.isActive) continuation.resume(false) }
            continuation.invokeOnCancellation { dialog.dismiss() }
        }
        if (AccountSessionStore.read(activity).user.id != accountId || generation != AccountSessionStore.libraryGeneration) return false
        if (!accepted) { prefs.edit().putBoolean(accountId,true).apply(); return false }
        return try {
            withContext(Dispatchers.IO) { importer.importInto(accountId, generation) }
            prefs.edit().putBoolean(accountId,true).apply()
            PmMessage.success(activity, "已合并到当前账号，本机原数据已保留")
            true
        } catch (error: Exception) {
            if (error is kotlinx.coroutines.CancellationException) throw error
            PmMessage.error(activity,error.message ?: "导入失败，请重试")
            false
        }
    }
}
