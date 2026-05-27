package cn.partialy.pm.network.auth

import android.content.Context
import cn.partialy.pm.model.AccountAuthResult
import cn.partialy.pm.model.AccountUser

object AccountSessionStore {
    private const val PREFS_NAME = "pm_account_session"
    private const val KEY_TOKEN = "token"
    private const val KEY_EXPIRES_AT = "expires_at"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_USERNAME = "username"
    private const val KEY_EMAIL = "email"
    private const val KEY_AVATAR = "avatar"

    data class Session(
        val token: String,
        val expiresAt: Long,
        val user: AccountUser,
    ) {
        val loggedIn: Boolean get() = token.isNotBlank() && user.id.isNotBlank()
    }

    fun read(context: Context): Session {
        val sp = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return Session(
            token = sp.getString(KEY_TOKEN, "").orEmpty(),
            expiresAt = sp.getLong(KEY_EXPIRES_AT, 0L),
            user = AccountUser(
                id = sp.getString(KEY_USER_ID, "").orEmpty(),
                username = sp.getString(KEY_USERNAME, "").orEmpty(),
                email = sp.getString(KEY_EMAIL, "").orEmpty(),
                avatar = sp.getString(KEY_AVATAR, "").orEmpty(),
            ),
        )
    }

    fun save(context: Context, result: AccountAuthResult) {
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_TOKEN, result.token)
            .putLong(KEY_EXPIRES_AT, result.expiresAt)
            .putString(KEY_USER_ID, result.user.id)
            .putString(KEY_USERNAME, result.user.username)
            .putString(KEY_EMAIL, result.user.email)
            .putString(KEY_AVATAR, result.user.avatar)
            .apply()
        TokenManager.setToken(result.token)
    }

    fun clear(context: Context) {
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
        TokenManager.clearToken()
    }
}
