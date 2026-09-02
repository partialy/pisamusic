package cn.partialy.pm.utils

import android.content.Context

object ServerDevicePrefs {
    private const val PREFS_NAME = "splash_prefs"
    private const val KEY_SERVER_DEVICE_UUID = "server_device_uuid"
    private const val KEY_MESSAGE_TOKEN = "message_token"

    fun getDeviceId(context: Context): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_SERVER_DEVICE_UUID, "")
            .orEmpty()
    }

    fun getMessageToken(context: Context): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_MESSAGE_TOKEN, "")
            .orEmpty()
    }

    fun saveReportIdentity(context: Context, deviceId: String, messageToken: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SERVER_DEVICE_UUID, deviceId)
            .putString(KEY_MESSAGE_TOKEN, messageToken)
            .apply()
    }
}
