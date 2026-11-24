package cn.partialy.pm.network.cookie

import cn.partialy.pm.network.cookie.model.WyAccountResponse
import com.google.gson.Gson
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
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap
import javax.inject.Inject
import javax.inject.Singleton

/** 管理页与侧栏共享最后一次校验结果；查询不能改写 Cookie 或自动注销。 */
@Singleton
class ThirdPartyAccountsRepository @Inject constructor(
    private val manager: MusicCookieManager,
    private val kg: KugouCookieRepository,
    private val wy: WyCookieRepository,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val mutex = Mutex()
    private val checking = ConcurrentHashMap<String, String>()
    private val publishLock = Any()
    private val gson = Gson()
    private val mutableStates = MutableStateFlow(MusicCookieManager.sources.map {
        ThirdPartyAccountState(it, null, false, ThirdPartyLoginValidity.UNCHECKED)
    })
    val states = mutableStates.asStateFlow()

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

    suspend fun clear(source: String, sessionKey: String): Boolean = withContext(Dispatchers.IO) {
        manager.clearIfCurrent(source, sessionKey).also { publish() }
    }

    suspend fun clearAll(expected: List<ThirdPartyAccountState>): Boolean = withContext(Dispatchers.IO) {
        manager.clearAllIfCurrent(expected).also { publish() }
    }
}
