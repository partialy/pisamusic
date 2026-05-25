package cn.partialy.pm.sync

import android.content.Context

object SyncPrefs {
    private const val PREFS_NAME = "pm_sync_prefs"
    private const val KEY_TOKEN = "token"
    private const val KEY_SYNC_CODE = "sync_code"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_SPACE_ID = "space_id"
    private const val KEY_LAST_VERSION = "last_version"
    private const val KEY_LAST_SYNC_AT = "last_sync_at"
    private const val KEY_LAST_ERROR = "last_error"

    data class State(
        val token: String,
        val syncCode: String,
        val deviceId: String,
        val spaceId: String,
        val lastVersion: Long,
        val lastSyncAt: Long,
        val lastError: String,
    ) {
        val bound: Boolean get() = token.isNotBlank()
    }

    fun getState(context: Context): State {
        val sp = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return State(
            token = sp.getString(KEY_TOKEN, "").orEmpty(),
            syncCode = sp.getString(KEY_SYNC_CODE, "").orEmpty(),
            deviceId = sp.getString(KEY_DEVICE_ID, "").orEmpty(),
            spaceId = sp.getString(KEY_SPACE_ID, "").orEmpty(),
            lastVersion = sp.getLong(KEY_LAST_VERSION, 0L),
            lastSyncAt = sp.getLong(KEY_LAST_SYNC_AT, 0L),
            lastError = sp.getString(KEY_LAST_ERROR, "").orEmpty(),
        )
    }

    fun saveBinding(
        context: Context,
        token: String,
        syncCode: String,
        deviceId: String,
        spaceId: String,
        version: Long,
    ) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_SYNC_CODE, syncCode)
            .putString(KEY_DEVICE_ID, deviceId)
            .putString(KEY_SPACE_ID, spaceId)
            .putLong(KEY_LAST_VERSION, version)
            .putString(KEY_LAST_ERROR, "")
            .apply()
    }

    fun setLastVersion(context: Context, version: Long) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(KEY_LAST_VERSION, version)
            .apply()
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

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
    }
}
