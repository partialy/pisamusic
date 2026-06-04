package cn.partialy.pm.network.cookie

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

data class MusicCookieState(
    val exist: Boolean,
    val cookie: String,
)

data class MusicLoginProfile(
    val userId: String = "",
    val username: String = "",
    val nickname: String = "",
    val avatarUrl: String = "",
    val backgroundUrl: String = "",
    val isVip: Boolean = false,
    val vipType: String = "",
    val rawProfileJson: String = "{}",
)

private data class MusicLoginSession(
    val source: String,
    val cookie: String,
    val profile: MusicLoginProfile,
)

@Singleton
class MusicCookieManager @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val helper = LocalMusicDbOpenHelper(context)
    private val lock = Any()
    private val sessions = linkedMapOf<String, MusicLoginSession>()
    private var loaded = false

    fun getCookie(source: String): MusicCookieState = synchronized(lock) {
        ensureLoadedLocked()
        val cookie = sessions[normalizeSource(source)]?.cookie.orEmpty()
        MusicCookieState(exist = cookie.isNotBlank(), cookie = cookie)
    }

    fun getProfile(source: String): MusicLoginProfile? = synchronized(lock) {
        ensureLoadedLocked()
        sessions[normalizeSource(source)]?.profile
    }

    fun saveSession(source: String, cookie: String, profile: MusicLoginProfile) {
        val normalized = normalizeSource(source)
        val cleanCookie = cookie.trim()
        if (cleanCookie.isBlank()) {
            clear(normalized)
            return
        }
        val session = MusicLoginSession(normalized, cleanCookie, profile)
        synchronized(lock) {
            helper.writableDatabase.insertWithOnConflict(
                TABLE,
                null,
                session.toContentValues(),
                SQLiteDatabase.CONFLICT_REPLACE,
            )
            sessions[normalized] = session
            loaded = true
        }
    }

    fun clear(source: String) {
        val normalized = normalizeSource(source)
        synchronized(lock) {
            helper.writableDatabase.delete(TABLE, "source = ?", arrayOf(normalized))
            sessions.remove(normalized)
            loaded = true
        }
    }

    fun clearAll() {
        synchronized(lock) {
            helper.writableDatabase.delete(TABLE, null, null)
            sessions.clear()
            loaded = true
        }
    }

    fun loggedInSources(): List<String> = synchronized(lock) {
        ensureLoadedLocked()
        sessions.values
            .filter { it.cookie.isNotBlank() }
            .map { it.source }
    }

    fun hasAnyLogin(): Boolean = loggedInSources().isNotEmpty()

    private fun ensureLoadedLocked() {
        if (loaded) return
        sessions.clear()
        helper.readableDatabase.query(
            TABLE,
            null,
            null,
            null,
            null,
            null,
            null,
        ).use { cursor ->
            while (cursor.moveToNext()) {
                val session = cursor.toSession()
                if (session.cookie.isNotBlank()) {
                    sessions[session.source] = session
                }
            }
        }
        loaded = true
    }

    private fun MusicLoginSession.toContentValues(): ContentValues =
        ContentValues().apply {
            put("source", source)
            put("cookie", cookie)
            put("user_id", profile.userId)
            put("username", profile.username)
            put("nickname", profile.nickname)
            put("avatar_url", profile.avatarUrl)
            put("background_url", profile.backgroundUrl)
            put("is_vip", if (profile.isVip) 1 else 0)
            put("vip_type", profile.vipType)
            put("raw_profile_json", profile.rawProfileJson.ifBlank { "{}" })
            put("updated_at", System.currentTimeMillis())
        }

    private fun android.database.Cursor.toSession(): MusicLoginSession {
        val source = getString(getColumnIndexOrThrow("source"))
        val profile = MusicLoginProfile(
            userId = getString(getColumnIndexOrThrow("user_id")).orEmpty(),
            username = getString(getColumnIndexOrThrow("username")).orEmpty(),
            nickname = getString(getColumnIndexOrThrow("nickname")).orEmpty(),
            avatarUrl = getString(getColumnIndexOrThrow("avatar_url")).orEmpty(),
            backgroundUrl = getString(getColumnIndexOrThrow("background_url")).orEmpty(),
            isVip = getInt(getColumnIndexOrThrow("is_vip")) == 1,
            vipType = getString(getColumnIndexOrThrow("vip_type")).orEmpty(),
            rawProfileJson = getString(getColumnIndexOrThrow("raw_profile_json")).orEmpty(),
        )
        return MusicLoginSession(
            source = source,
            cookie = getString(getColumnIndexOrThrow("cookie")).orEmpty(),
            profile = profile,
        )
    }

    private fun normalizeSource(source: String): String =
        when (source.trim().lowercase()) {
            SOURCE_KG -> SOURCE_KG
            SOURCE_WY -> SOURCE_WY
            else -> error("unsupported cookie source: $source")
        }

    companion object {
        const val SOURCE_KG = "kg"
        const val SOURCE_WY = "wy"
        private const val TABLE = "third_party_login_sessions"
    }
}
