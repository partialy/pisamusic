package cn.partialy.pm.sync

import android.content.Context
import cn.partialy.pm.network.auth.AccountSessionStore

object SyncPrefs {
    private const val PREFS_NAME = "pm_sync_prefs"
    private const val KEY_LAST_VERSION = "last_version"
    private const val KEY_LAST_SYNC_AT = "last_sync_at"
    private const val KEY_LAST_ERROR = "last_error"

    data class State(
        val token: String,
        val userId: String,
        val username: String,
        val email: String,
        val lastVersion: Long,
        val lastSyncAt: Long,
        val lastError: String,
    ) {
        val bound: Boolean get() = token.isNotBlank() && userId.isNotBlank()
    }

    fun getState(context: Context): State {
        val sp = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val session = AccountSessionStore.read(context)
        return State(
            token = session.token,
            userId = session.user.id,
            username = session.user.username,
            email = session.user.email,
            lastVersion = sp.getLong(KEY_LAST_VERSION, 0L),
            lastSyncAt = sp.getLong(KEY_LAST_SYNC_AT, 0L),
            lastError = sp.getString(KEY_LAST_ERROR, "").orEmpty(),
        )
    }

    fun markSyncSuccess(context: Context, version: Long) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_VERSION, version)
            .putLong(KEY_LAST_SYNC_AT, System.currentTimeMillis())
            .putString(KEY_LAST_ERROR, "")
            .apply()
    }

    fun markSyncError(context: Context, message: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_ERROR, message)
            .apply()
    }

    fun clearVersion(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
