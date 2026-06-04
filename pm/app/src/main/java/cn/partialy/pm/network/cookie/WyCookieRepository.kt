package cn.partialy.pm.network.cookie

import cn.partialy.pm.network.CookieHttpResult
import cn.partialy.pm.network.CookieRequest
import cn.partialy.pm.network.CookieSessionHttp
import cn.partialy.pm.network.cookie.model.WyAccountResponse
import cn.partialy.pm.network.cookie.model.WyPlaylistItem
import cn.partialy.pm.network.cookie.model.WyPlaylistTrackAllResponse
import cn.partialy.pm.network.cookie.model.WyUserPlaylistResponse
import cn.partialy.pm.network.wy.WyCloudSearchResponse
import cn.partialy.pm.network.wy.WyLyricResponse
import cn.partialy.pm.network.wy.WyPersonalizedNewSongResponse
import cn.partialy.pm.network.wy.WyPersonalizedPlaylistResponse
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.lang.reflect.Type
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
    private val cookieManager: MusicCookieManager,
) {

    private val http = CookieSessionHttp(MusicCookieManager.SOURCE_WY, cookieManager)
    private val gson = Gson()

    /** 写入 Cookie 串，保留已有账号资料；正式登录请走 [saveLoginSession]。 */
    fun setCookie(raw: String) {
        cookieManager.saveSession(
            source = MusicCookieManager.SOURCE_WY,
            cookie = raw,
            profile = cookieManager.getProfile(MusicCookieManager.SOURCE_WY) ?: MusicLoginProfile(),
        )
    }

    fun getCookie(): String = cookieManager.getCookie(MusicCookieManager.SOURCE_WY).cookie

    fun hasCookie(): Boolean = cookieManager.getCookie(MusicCookieManager.SOURCE_WY).exist

    fun getProfile(): MusicLoginProfile? = cookieManager.getProfile(MusicCookieManager.SOURCE_WY)

    suspend fun saveLoginSession(rawCookie: String): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val cookie = rawCookie.trim()
            if (cookie.isBlank()) error("empty cookie")
            val profile = fetchProfileForCookie(cookie).getOrElse { MusicLoginProfile() }
            cookieManager.saveSession(
                source = MusicCookieManager.SOURCE_WY,
                cookie = cookie,
                profile = profile,
            )
        }
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

    suspend fun cloudSearch(
        keywords: String,
        limit: Int? = null,
        offset: Int? = null,
        type: Int? = null,
    ): Result<WyCloudSearchResponse> = requestJson(
        path = "cloudSearch",
        params = mapOf(
            "keywords" to keywords,
            "limit" to limit?.toString(),
            "offset" to offset?.toString(),
            "type" to type?.toString(),
        ),
        type = WyCloudSearchResponse::class.java,
    )

    suspend fun personalizedPlaylists(limit: Int? = null): Result<WyPersonalizedPlaylistResponse> =
        requestJson(
            path = "personalized",
            params = mapOf("limit" to limit?.toString()),
            type = WyPersonalizedPlaylistResponse::class.java,
        )

    suspend fun personalizedNewSongs(limit: Int? = null): Result<WyPersonalizedNewSongResponse> =
        requestJson(
            path = "personalized/newsong",
            params = mapOf("limit" to limit?.toString()),
            type = WyPersonalizedNewSongResponse::class.java,
        )

    suspend fun lyric(id: Long): Result<WyLyricResponse> = requestJson(
        path = "lyric",
        params = mapOf("id" to id.toString()),
        type = WyLyricResponse::class.java,
    )

    private fun CookieHttpResult.parseAccountOrThrow(): WyAccountResponse {
        if (!isSuccessful) error("HTTP $code")
        return gson.fromJson(body, WyAccountResponse::class.java) ?: error("empty json")
    }

    private fun fetchProfileForCookie(cookie: String): Result<MusicLoginProfile> = runCatching {
        val result = CookieRequest.getBlocking(
            url = urlUserAccount,
            params = emptyMap(),
            cookie = cookie,
            mergeResponseSetCookie = false,
        )
        if (!result.isSuccessful) error("HTTP ${result.code}")
        val account = result.parseAccountOrThrow()
        val p = account.profile
        val a = account.account
        MusicLoginProfile(
            userId = (p?.userId ?: a?.id)?.toString().orEmpty(),
            username = a?.userName.orEmpty(),
            nickname = p?.nickname.orEmpty(),
            avatarUrl = p?.avatarUrl.orEmpty(),
            backgroundUrl = p?.backgroundUrl.orEmpty(),
            rawProfileJson = result.body.ifBlank { "{}" },
        )
    }

    private fun CookieHttpResult.parsePlaylistOrThrow(): WyUserPlaylistResponse {
        if (!isSuccessful) error("HTTP $code")
        return gson.fromJson(body, WyUserPlaylistResponse::class.java) ?: error("empty json")
    }

    private fun CookieHttpResult.parseTrackAllOrThrow(): WyPlaylistTrackAllResponse {
        if (!isSuccessful) error("HTTP $code")
        return gson.fromJson(body, WyPlaylistTrackAllResponse::class.java) ?: error("empty json")
    }

    private suspend fun <T> requestJson(
        path: String,
        params: Map<String, String?>,
        type: Type,
    ): Result<T> = withContext(Dispatchers.IO) {
        runCatching {
            val result = http.getBlocking(urlFor(path), params)
            if (!result.isSuccessful) error("HTTP ${result.code}")
            gson.fromJson<T>(result.body, type) ?: error("empty json")
        }
    }

    private fun urlFor(path: String): String =
        "${API_BASE.trimEnd('/')}/${path.trimStart('/')}"

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
