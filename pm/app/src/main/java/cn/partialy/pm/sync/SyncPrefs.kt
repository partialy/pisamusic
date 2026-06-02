package cn.partialy.pm.sync

import android.content.Context
import cn.partialy.pm.network.auth.AccountSessionStore

object SyncPrefs {
    private const val PREFS_NAME = "pm_sync_prefs"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_LAST_VERSION = "last_version"
    private const val KEY_LAST_SYNC_AT = "last_sync_at"
    private const val KEY_LAST_ERROR = "last_error"

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
        val sp = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val session = AccountSessionStore.read(context)
        val syncedUserId = sp.getString(KEY_USER_ID, "").orEmpty()
        val sameAccount = syncedUserId == session.user.id
        return State(
            token = session.token,
            userId = session.user.id,
            username = session.user.username,
            email = session.user.email,
            syncedUserId = syncedUserId,
            lastVersion = if (sameAccount) sp.getLong(KEY_LAST_VERSION, 0L) else 0L,
            lastSyncAt = if (sameAccount) sp.getLong(KEY_LAST_SYNC_AT, 0L) else 0L,
            lastError = if (sameAccount) sp.getString(KEY_LAST_ERROR, "").orEmpty() else "",
        )
    }

    fun resetForAccount(context: Context, userId: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_USER_ID, userId)
            .putLong(KEY_LAST_VERSION, 0L)
            .putLong(KEY_LAST_SYNC_AT, 0L)
            .putString(KEY_LAST_ERROR, "")
            .apply()
    }

    fun markSyncSuccess(context: Context, userId: String, version: Long) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_USER_ID, userId)
            .putLong(KEY_LAST_VERSION, version)
            .putLong(KEY_LAST_SYNC_AT, System.currentTimeMillis())
            .putString(KEY_LAST_ERROR, "")
            .apply()
    }

    fun markSyncError(context: Context, userId: String, message: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_USER_ID, userId)
            .putString(KEY_LAST_ERROR, message)
            .apply()
    }

    fun clearAccountState(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
