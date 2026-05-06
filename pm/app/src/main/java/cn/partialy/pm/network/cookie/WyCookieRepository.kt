package cn.partialy.pm.network.cookie

import android.content.Context
import cn.partialy.pm.network.CookieHttpResult
import cn.partialy.pm.network.CookieSessionHttp
import cn.partialy.pm.network.cookie.model.WyAccountResponse
import cn.partialy.pm.network.cookie.model.WyPlaylistItem
import cn.partialy.pm.network.cookie.model.WyPlaylistTrackAllResponse
import cn.partialy.pm.network.cookie.model.WyUserPlaylistResponse
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 独立网易「需登录 Cookie」接口（与现有 [cn.partialy.pm.network.wy.WyApiService] 无关）。
 *
 * 流程：[needCookieAPI.md] 先 [getAccount] 取 uid，再 [getUserPlaylists]。
 * Base 默认 `https://music.163.com/api`，若与你环境不一致请改 [API_BASE]。
 */
@Singleton
class WyCookieRepository @Inject constructor(
    @ApplicationContext context: Context,
) {

    private val store = PersistedUserCookieStore(context, CookiePersistenceFileNames.WY)
    private val http = CookieSessionHttp(store)
    private val gson = Gson()

    fun setCookie(raw: String) {
        store.setCookie(raw)
    }

    fun getCookie(): String = store.getCookie()

    /** 丢弃内存条目并从磁盘 JSON 重新加载（与 [getCookie] 同源）。 */
    fun reloadPersistedCookieFromDisk() {
        store.reloadFromDisk()
    }

    /** 第一步：`/user/account` */
    suspend fun getAccount(): Result<WyAccountResponse> = withContext(Dispatchers.IO) {
        runCatching {
            val result = http.getBlocking(urlUserAccount, emptyMap())
            result.parseAccountOrThrow()
        }
    }

    suspend fun getAccountRaw(): CookieHttpResult = withContext(Dispatchers.IO) {
        http.getBlocking(urlUserAccount, emptyMap())
    }

    /**
     * 第二步：`/user/playlist?uid=...`
     * @param uid 来自 [WyAccountResponse.account.id] 或 [WyAccountResponse.profile.userId]
     */
    suspend fun getUserPlaylists(
        uid: Long,
        limit: Int? = null,
        offset: Int? = null,
    ): Result<WyUserPlaylistResponse> = withContext(Dispatchers.IO) {
        runCatching {
            val params = buildMap {
                put("uid", uid.toString())
                limit?.let { put("limit", it.toString()) }
                offset?.let { put("offset", it.toString()) }
            }
            val result = http.getBlocking(urlUserPlaylist, params)
            result.parsePlaylistOrThrow()
        }
    }

    /** [WyAccountResponse.profile.userId] 优先，否则 [WyAccountResponse.account.id]。 */
    fun resolveUid(account: WyAccountResponse): Long? =
        account.profile?.userId ?: account.account?.id

    /**
     * 分页拉取用户全部歌单：[WyUserPlaylistResponse.more] 为 true 时继续，[offset] 累加本批条数。
     */
    suspend fun fetchAllUserPlaylists(
        uid: Long,
        limit: Int = 30,
    ): Result<List<WyPlaylistItem>> = withContext(Dispatchers.IO) {
        runCatching {
            val all = mutableListOf<WyPlaylistItem>()
            var offset = 0
            var guard = 0
            while (guard++ < 500) {
                val resp = getUserPlaylists(uid, limit, offset).getOrThrow()
                if (resp.code != 200) error("code=${resp.code}")
                val batch = resp.playlist.orEmpty()
                all.addAll(batch)
                if (resp.more != true || batch.isEmpty()) break
                offset += batch.size
            }
            all
        }
    }

    suspend fun getUserPlaylistsRaw(
        uid: Long,
        limit: Int? = null,
        offset: Int? = null,
    ): CookieHttpResult = withContext(Dispatchers.IO) {
        val params = buildMap {
            put("uid", uid.toString())
            limit?.let { put("limit", it.toString()) }
            offset?.let { put("offset", it.toString()) }
        }
        http.getBlocking(urlUserPlaylist, params)
    }

    /**
     * 歌单全部歌曲（分页）：`/playlist/track/all?id=&limit=&offset=`。
     * @param limit null 时由服务端按歌单曲目数决定（尽量不传以免超大响应）。
     */
    suspend fun getPlaylistTrackAll(
        id: String,
        limit: Int? = null,
        offset: Int = 0,
    ): Result<WyPlaylistTrackAllResponse> = withContext(Dispatchers.IO) {
        runCatching {
            val params = buildMap {
                put("id", id)
                put("offset", offset.toString())
                limit?.let { put("limit", it.toString()) }
            }
            val result = http.getBlocking(urlPlaylistTrackAll, params)
            result.parseTrackAllOrThrow()
        }
    }

    private fun CookieHttpResult.parseAccountOrThrow(): WyAccountResponse {
        if (!isSuccessful) error("HTTP $code")
        return gson.fromJson(body, WyAccountResponse::class.java) ?: error("empty json")
    }

    private fun CookieHttpResult.parsePlaylistOrThrow(): WyUserPlaylistResponse {
        if (!isSuccessful) error("HTTP $code")
        return gson.fromJson(body, WyUserPlaylistResponse::class.java) ?: error("empty json")
    }

    private fun CookieHttpResult.parseTrackAllOrThrow(): WyPlaylistTrackAllResponse {
        if (!isSuccessful) error("HTTP $code")
        return gson.fromJson(body, WyPlaylistTrackAllResponse::class.java) ?: error("empty json")
    }

    private val urlUserAccount: String
        get() = "${API_BASE.trimEnd('/')}/user/account"

    private val urlUserPlaylist: String
        get() = "${API_BASE.trimEnd('/')}/user/playlist"

    private val urlPlaylistTrackAll: String
        get() = "${API_BASE.trimEnd('/')}/playlist/track/all"

    companion object {
        const val API_BASE: String = "https://gateway.partialy.cn/wy-service"

        /** 与 music-login-hub `musicApi.ts` 中 `realIP` 查询参数一致 */
        const val WY_LOGIN_REAL_IP: String = "116.25.146.177"

        /** 网关登录类接口请求头（Referer / Origin 指向 music.163.com） */
        val WY_LOGIN_BROWSER_HEADERS: Map<String, String> = mapOf(
            "User-Agent" to
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
            "Referer" to "https://music.163.com",
            "Origin" to "https://music.163.com",
            "Accept" to "application/json, text/plain, */*",
            "Accept-Language" to "zh-CN,zh;q=0.9",
            "Content-Type" to "application/json",
            "Cache-Control" to "no-cache",
            "Pragma" to "no-cache",
        )
    }
}
