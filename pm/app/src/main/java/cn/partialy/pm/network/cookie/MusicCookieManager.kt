package cn.partialy.pm.network.cookie

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import cn.partialy.pm.utils.localdata.LocalMusicDbOpenHelper
import cn.partialy.pm.utils.localdata.AppConfigStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject
import java.security.MessageDigest
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
    private val helper = LocalMusicDbOpenHelper.shared(context.applicationContext)
    private val lock = Any()
    private val sessions = linkedMapOf<String, MusicLoginSession>()
    private var loaded = false
    private val config = AppConfigStore.shared(context)
    private val revisions = mutableMapOf<String, Long>()
    private val mutableChanges = MutableStateFlow(0L)
    val changes = mutableChanges.asStateFlow()

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
            ensureLoadedLocked()
            val previousUserId = sessions[normalized]?.profile?.userId?.trim().orEmpty()
            val nextUserId = profile.userId.trim()
            val previous = sessions[normalized]
            val sameKnownAccount = previousUserId.isNotEmpty() && previousUserId == nextUserId
            val accountSwitched = previous != null && !sameKnownAccount &&
                (previous.cookie != cleanCookie || previousUserId != nextUserId)
            val db = helper.writableDatabase
            db.insertWithOnConflict(
                TABLE,
                null,
                session.toContentValues(),
                SQLiteDatabase.CONFLICT_REPLACE,
            )
            if (accountSwitched) {
                ThirdPartyPlaylistCandidateStore.clearSourceInDb(db, normalized)
            }
            sessions[normalized] = session
            loaded = true
            invalidateValidationLocked(normalized)
            publishLocked()
        }
    }

    fun clear(source: String) {
        val normalized = normalizeSource(source)
        synchronized(lock) {
            ensureLoadedLocked()
            val db = helper.writableDatabase
            db.delete(TABLE, "source = ?", arrayOf(normalized))
            ThirdPartyPlaylistCandidateStore.clearSourceInDb(db, normalized)
            sessions.remove(normalized)
            loaded = true
            invalidateValidationLocked(normalized)
            publishLocked()
        }
    }

    fun clearAll() {
        synchronized(lock) {
            val db = helper.writableDatabase
            db.delete(TABLE, null, null)
            ThirdPartyPlaylistCandidateStore.clearAllInDb(db)
            sessions.clear()
            loaded = true
            sources.forEach(::invalidateValidationLocked)
            publishLocked()
        }
    }

    fun loggedInSources(): List<String> = synchronized(lock) {
        ensureLoadedLocked()
        sessions.values
            .filter { it.cookie.isNotBlank() }
            .map { it.source }
    }

    fun hasAnyLogin(): Boolean = loggedInSources().isNotEmpty()

    fun snapshot(source: String): MusicSessionSnapshot = synchronized(lock) {
        ensureLoadedLocked()
        val normalized = normalizeSource(source)
        val session = sessions[normalized]
        val cookie = session?.cookie.orEmpty()
        val identity = "$normalized\u0000$cookie\u0000${session?.profile?.userId.orEmpty()}"
        val fingerprint = MessageDigest.getInstance("SHA-256").digest(identity.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it.toInt() and 0xff) }
        MusicSessionSnapshot(normalized, cookie, session?.profile, revisions[normalized] ?: 0L, fingerprint)
    }

    /** 校验、缓存落库及清除均复用同一会话边界，防止重登后的旧请求回写。 */
    fun <T> withCurrentSession(expected: MusicSessionSnapshot, action: () -> T): T? = synchronized(lock) {
        if (snapshot(expected.source).sessionKey != expected.sessionKey) null else action()
    }

    fun accountStates(): List<ThirdPartyAccountState> = synchronized(lock) {
        sources.map { source ->
            val session = snapshot(source)
            val saved = config.read(validationKey(source))?.valueJson?.let {
                runCatching { JSONObject(it) }.getOrNull()
            }
            val validity = if (session.cookie.isNotBlank() && saved?.optString("session") == session.fingerprint) {
                ThirdPartyLoginValidity.values().firstOrNull { it.name == saved.optString("validity") }
                    ?: ThirdPartyLoginValidity.UNCHECKED
            } else ThirdPartyLoginValidity.UNCHECKED
            ThirdPartyAccountState(source, session.profile, session.cookie.isNotBlank(), validity, sessionKey = session.sessionKey)
        }
    }

    fun applyValidation(
        expected: MusicSessionSnapshot,
        validity: ThirdPartyLoginValidity,
        profile: MusicLoginProfile? = null,
    ): Boolean = withCurrentSession(expected) {
        if (profile != null) {
            val session = MusicLoginSession(expected.source, expected.cookie, profile)
            helper.writableDatabase.insertWithOnConflict(TABLE, null, session.toContentValues(), SQLiteDatabase.CONFLICT_REPLACE)
            sessions[expected.source] = session
        }
        val current = snapshot(expected.source)
        config.write(validationKey(expected.source), JSONObject()
            .put("session", current.fingerprint).put("validity", validity.name).toString(), namespace = "third_party_login")
        publishLocked()
        true
    } ?: false

    fun clearIfCurrent(source: String, sessionKey: String): Boolean = synchronized(lock) {
        if (snapshot(source).sessionKey != sessionKey) return@synchronized false
        clear(source)
        true
    }

    fun clearAllIfCurrent(expected: List<ThirdPartyAccountState>): Boolean = synchronized(lock) {
        if (sources.any { source -> expected.none { it.source == source && it.sessionKey == snapshot(source).sessionKey } }) {
            return@synchronized false
        }
        clearAll()
        true
    }

    private fun invalidateValidationLocked(source: String) {
        revisions[source] = (revisions[source] ?: 0L) + 1L
        config.delete(validationKey(source))
    }

    private fun publishLocked() { mutableChanges.value += 1L }
    private fun validationKey(source: String) = "third_party_login.validity.$source"

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
        val sources = listOf(SOURCE_KG, SOURCE_WY)
        private const val TABLE = "third_party_login_sessions"
    }
}
