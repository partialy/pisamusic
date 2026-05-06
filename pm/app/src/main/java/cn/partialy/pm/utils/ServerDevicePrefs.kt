package cn.partialy.pm.utils

import android.content.Context

object ServerDevicePrefs {
    private const val PREFS_NAME = "splash_prefs"
    private const val KEY_SERVER_DEVICE_UUID = "server_device_uuid"

    fun getDeviceId(context: Context): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_SERVER_DEVICE_UUID, "")
            .orEmpty()
    }

    fun setDeviceId(context: Context, id: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SERVER_DEVICE_UUID, id)
            .apply()
    }
}
