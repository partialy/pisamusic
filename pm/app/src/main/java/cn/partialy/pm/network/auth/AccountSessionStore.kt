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
    private const val KEY_AVATAR_KEY = "avatar_key"
    private const val KEY_AVATAR_URL = "avatar_url"
    private const val KEY_CREATED_AT = "created_at"

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
                avatarKey = sp.getString(KEY_AVATAR_KEY, "default").orEmpty().ifBlank { "default" },
                avatarUrl = sp.getString(KEY_AVATAR_URL, "").orEmpty(),
                createdAt = sp.getLong(KEY_CREATED_AT, 0L),
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
            .putString(KEY_AVATAR_KEY, result.user.avatarKey.ifBlank { "default" })
            .putString(KEY_AVATAR_URL, result.user.avatarUrl.ifBlank { result.user.avatar })
            .putLong(KEY_CREATED_AT, result.user.createdAt)
            .apply()
        TokenManager.setToken(result.token)
    }

    fun updateUser(context: Context, user: AccountUser) {
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_USER_ID, user.id)
            .putString(KEY_USERNAME, user.username)
            .putString(KEY_EMAIL, user.email)
            .putString(KEY_AVATAR, user.avatar)
            .putString(KEY_AVATAR_KEY, user.avatarKey.ifBlank { "default" })
            .putString(KEY_AVATAR_URL, user.avatarUrl.ifBlank { user.avatar })
            .putLong(KEY_CREATED_AT, user.createdAt)
            .apply()
    }

    fun clear(context: Context) {
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
        TokenManager.clearToken()
    }
}
