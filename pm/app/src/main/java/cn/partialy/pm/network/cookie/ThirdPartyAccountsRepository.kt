package cn.partialy.pm.network.cookie

import android.content.Context
import cn.partialy.pm.network.cookie.model.WyAccountResponse
import cn.partialy.pm.utils.localdata.AppConfigStore
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/** 管理页与侧栏共享最后一次校验结果；查询不能改写 Cookie 或自动注销。 */
@Singleton
class ThirdPartyAccountsRepository @Inject constructor(
    private val manager: MusicCookieManager,
    private val kg: KugouCookieRepository,
    private val wy: WyCookieRepository,
    @ApplicationContext context: Context,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutex = Mutex()
    private val refreshMutex = Mutex()
    private val settingsMutex = Mutex()
    private val config = AppConfigStore.shared(context)
    private val mutableRefreshState = MutableStateFlow(readRefreshState())
    val refreshState = mutableRefreshState.asStateFlow()
    private val checking = ConcurrentHashMap<String, String>()
    private val publishLock = Any()
    private val gson = Gson()
    private val mutableStates = MutableStateFlow(MusicCookieManager.sources.map {
        ThirdPartyAccountState(it, null, false, ThirdPartyLoginValidity.UNCHECKED)
    })
    val states = mutableStates.asStateFlow()

    /** 只暴露不含凭证的会话标识，供页面判断重建期间是否发生重新登录。 */
    fun sessionKeys(): List<String> = MusicCookieManager.sources.map { manager.snapshot(it).sessionKey }

    init {
        scope.launch { manager.changes.collect { publish() } }
    }

    private fun publish() = synchronized(publishLock) {
        mutableStates.value = manager.accountStates().map { it.copy(checking = checking[it.source] == it.sessionKey) }
    }

    /** true 表示本轮无网络/协议错误；明确过期属于成功取得校验结果。 */
    suspend fun validateAll(): Boolean = mutex.withLock {
        withContext(Dispatchers.IO) {
            val sessions = MusicCookieManager.sources.map(manager::snapshot).filter { it.cookie.isNotBlank() }
            coroutineScope { sessions.map { session -> async { validate(session) } }.awaitAll().all { it } }
        }
    }

    private suspend fun validate(session: MusicSessionSnapshot): Boolean {
        checking[session.source] = session.sessionKey
        publish()
        try {
            if (session.source == MusicCookieManager.SOURCE_KG) {
                val response = kg.getUserDetailRaw(session = session)
                currentCoroutineContext().ensureActive()
                val validity = when {
                    response.code == 502 -> ThirdPartyLoginValidity.EXPIRED
                    response.isSuccessful -> ThirdPartyLoginValidity.VALID
                    else -> error("账号状态查询失败")
                }
                manager.applyValidation(session, validity)
            } else {
                val response = wy.getAccountRaw(session)
                currentCoroutineContext().ensureActive()
                check(response.isSuccessful) { "账号状态查询失败" }
                val account = gson.fromJson(response.body, WyAccountResponse::class.java)
                    ?: error("账号状态响应为空")
                check(account.code == 200) { "账号状态响应无效" }
                val uid = wy.resolveUid(account)?.takeIf { it > 0 }
                val storedUid = session.profile?.userId.orEmpty().trim()
                val matches = uid != null && (storedUid.isBlank() || storedUid.toLongOrNull() == uid)
                val profile = if (matches && storedUid.isBlank()) {
                    (session.profile ?: MusicLoginProfile()).let { previous -> previous.copy(
                        userId = uid.toString(),
                        username = previous.username.ifBlank { account.account?.userName.orEmpty() },
                        nickname = previous.nickname.ifBlank { account.profile?.nickname.orEmpty() },
                        avatarUrl = previous.avatarUrl.ifBlank { account.profile?.avatarUrl.orEmpty() },
                        backgroundUrl = previous.backgroundUrl.ifBlank { account.profile?.backgroundUrl.orEmpty() },
                    ) }
                } else null
                manager.applyValidation(session,
                    if (matches) ThirdPartyLoginValidity.VALID else ThirdPartyLoginValidity.EXPIRED, profile)
            }
            return true
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            // 会话已更换时只丢弃旧结果，不对新账号提示错误。
            return manager.withCurrentSession(session) { false } ?: true
        } finally {
            checking.remove(session.source, session.sessionKey)
            publish()
        }
    }

    suspend fun setAutoRefresh(enabled: Boolean) = settingsMutex.withLock {
        withContext(Dispatchers.IO) {
            config.write(REFRESH_SETTINGS, JSONObject().put("enabled", enabled).toString(), namespace = "third_party_login")
            mutableRefreshState.update { it.copy(autoRefresh = enabled) }
        }
    }

    /** 手动及自动刷新共用凭证校验和落库流程；失败也记录尝试时间，避免进页面反复重试。 */
    suspend fun refresh(expected: List<ThirdPartyAccountState>, onlyIfDue: Boolean = false): ThirdPartyRefreshResult {
        if (!refreshMutex.tryLock()) return ThirdPartyRefreshResult.SKIPPED
        try {
            val state = refreshState.value
            val elapsed = System.currentTimeMillis() - state.lastAttemptAt
            if (onlyIfDue && (!state.autoRefresh || (state.lastAttemptAt > 0 && elapsed <= REFRESH_INTERVAL))) {
                return ThirdPartyRefreshResult.SKIPPED
            }
            val accounts = if (onlyIfDue) manager.accountStates() else expected
            val sessions = accounts.filter { it.loggedIn }.mapNotNull { account ->
                manager.snapshot(account.source).takeIf { it.cookie.isNotBlank() && it.sessionKey == account.sessionKey }
            }
            if (sessions.isEmpty()) return ThirdPartyRefreshResult.SKIPPED
            mutableRefreshState.update { it.copy(refreshing = true) }
            return mutex.withLock {
                withContext(Dispatchers.IO) {
                    val results = coroutineScope { sessions.map { session -> async { session.source to refreshOne(session) } }.awaitAll() }
                        .filter { it.second != null }
                    if (results.isEmpty()) return@withContext ThirdPartyRefreshResult.SKIPPED
                    val failedSources = results.filter { it.second == false }.map { it.first }
                    val succeeded = failedSources.isEmpty()
                    val completedAt = System.currentTimeMillis()
                    config.write(REFRESH_RESULT, JSONObject().put("time", completedAt).put("success", succeeded).toString(),
                        namespace = "third_party_login")
                    mutableRefreshState.update { it.copy(lastAttemptAt = completedAt, lastSucceeded = succeeded) }
                    if (succeeded) ThirdPartyRefreshResult.SUCCESS else ThirdPartyRefreshResult.Failed(failedSources)
                }
            }
        } finally {
            mutableRefreshState.update { it.copy(refreshing = false) }
            refreshMutex.unlock()
        }
    }

    private suspend fun refreshOne(session: MusicSessionSnapshot): Boolean? {
        if (manager.withCurrentSession(session) { true } != true) return null
        try {
            val (cookie, profile) = if (session.source == MusicCookieManager.SOURCE_KG) {
                kg.refreshSession(session).let { it.cookie to it.profile }
            } else {
                wy.refreshCookie(session) to (session.profile ?: MusicLoginProfile())
            }
            currentCoroutineContext().ensureActive()
            val updated = manager.replaceSessionIfCurrent(session, cookie, profile) ?: return null
            validate(updated)
            val current = manager.snapshot(session.source)
            if (current.revision != updated.revision) return null
            // 校验网络异常不回滚已轮换的凭证；明确失效则不能提示刷新成功。
            return manager.withCurrentSession(current) {
                manager.accountStates().first { it.source == session.source }.validity != ThirdPartyLoginValidity.EXPIRED
            }
        } catch (cancelled: CancellationException) {
            throw cancelled
        } catch (_: Exception) {
            return manager.withCurrentSession(session) { false }
        } finally {
            publish()
        }
    }

    private fun readRefreshState(): ThirdPartyRefreshState {
        fun read(key: String) = config.read(key)?.valueJson?.let { runCatching { JSONObject(it) }.getOrNull() }
        val settings = read(REFRESH_SETTINGS)
        val result = read(REFRESH_RESULT)
        return ThirdPartyRefreshState(
            autoRefresh = settings?.optBoolean("enabled", false) ?: false,
            lastAttemptAt = result?.optLong("time", 0L) ?: 0L,
            lastSucceeded = result?.takeIf { it.has("success") }?.optBoolean("success"),
        )
    }

    suspend fun clear(source: String, sessionKey: String): Boolean = withContext(Dispatchers.IO) {
        manager.clearIfCurrent(source, sessionKey).also { publish() }
    }

    suspend fun clearAll(expected: List<ThirdPartyAccountState>): Boolean = withContext(Dispatchers.IO) {
        manager.clearAllIfCurrent(expected).also { publish() }
    }

    private companion object {
        const val REFRESH_SETTINGS = "third_party_login.refresh_settings"
        const val REFRESH_RESULT = "third_party_login.refresh_result"
        const val REFRESH_INTERVAL = 24L * 60 * 60 * 1000
    }
}
