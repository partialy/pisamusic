package cn.partialy.pm.sync

import android.content.Context
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper

object SyncPrefs {
    data class State(
        val token: String,
        val userId: String,
        val username: String,
        val email: String,
        val syncedUserId: String,
        val lastVersion: Long,
        val lastSyncAt: Long,
        val lastError: String,
    ) {
        val loggedIn: Boolean get() = token.isNotBlank() && userId.isNotBlank()
        val needsAccountSeed: Boolean get() = loggedIn && syncedUserId != userId
    }

    fun getState(context: Context): State {
        val session = AccountSessionStore.read(context)
        val userId = session.user.id.trim()
        val row = if (userId.isNotBlank()) {
            SyncClockAndStateStore.readState(LocalMusicDbOpenHelper.shared(context).readableDatabase, userId)
        } else {
            SyncAccountStateRow("", false, 0L, 0L, "", 0L, 0, 0L)
        }
        return State(
            token = session.token,
            userId = userId,
            username = session.user.username,
            email = session.user.email,
            syncedUserId = if (row.seeded) userId else "",
            lastVersion = row.lastVersion,
            lastSyncAt = row.lastSyncAt,
            lastError = row.lastError,
        )
    }

    fun markSeeded(context: Context, userId: String) {
        SyncClockAndStateStore.markSeeded(LocalMusicDbOpenHelper.shared(context).writableDatabase, userId)
    }

    fun resetForAccount(context: Context, userId: String) {
        SyncClockAndStateStore.resetCursorOnly(LocalMusicDbOpenHelper.shared(context).writableDatabase, userId)
    }

    fun markSyncSuccess(context: Context, userId: String, version: Long) {
        SyncClockAndStateStore.markSyncSuccess(LocalMusicDbOpenHelper.shared(context).writableDatabase, userId, version)
    }

    fun markSyncError(context: Context, userId: String, message: String) {
        SyncClockAndStateStore.markSyncError(LocalMusicDbOpenHelper.shared(context).writableDatabase, userId, message)
    }

    fun updateServerClock(context: Context, userId: String, serverTimeMs: Long) {
        SyncClockAndStateStore.updateServerClock(LocalMusicDbOpenHelper.shared(context).writableDatabase, userId, serverTimeMs)
    }

    /** 保留按账号隔离的 SQLite 同步水位，不再在登出时擦除历史状态防止重登误 re-seed。 */
    fun clearAccountState(context: Context) {
        // 账号切换后 getState 自动按 AccountSessionStore 当前 userId 隔离读取对应行。
    }
}
