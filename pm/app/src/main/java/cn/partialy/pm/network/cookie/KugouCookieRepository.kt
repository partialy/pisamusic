package cn.partialy.pm.network.cookie

import android.util.Log
import cn.partialy.pm.model.BaseResponse
import cn.partialy.pm.model.HotSearchResponse
import cn.partialy.pm.model.KgPlaylistDetailApiResponse
import cn.partialy.pm.model.KgPlaylistTagsApiResponse
import cn.partialy.pm.model.KgPlaylistTrackAllApiResponse
import cn.partialy.pm.model.KgSearchPlaylistResponse
import cn.partialy.pm.model.LyricResponse
import cn.partialy.pm.model.NewSongResponse
import cn.partialy.pm.model.RecommendSongResponse
import cn.partialy.pm.model.SearchLyricResponse
import cn.partialy.pm.model.SearchSongResponse
import cn.partialy.pm.model.TopCardApiResponse
import cn.partialy.pm.model.TopPlaylistApiResponse
import cn.partialy.pm.network.CookieHttpResult
import cn.partialy.pm.network.CookieRequest
import cn.partialy.pm.network.CookieSessionHttp
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.network.cookie.model.KgDrawerUserInfo
import cn.partialy.pm.network.cookie.model.KgUserPlaylistInfoItem
import cn.partialy.pm.network.cookie.model.KgUserPlaylistResponse
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.lang.reflect.Type
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 独立酷狗「需登录 Cookie」接口（与现有 [cn.partialy.pm.network.api.KgApiService] 无关）。
 *
 * 接口说明见项目根目录 [needCookieAPI.md]。Base URL 使用系统配置下发的 KG 业务地址。
 */
@Singleton
class KugouCookieRepository @Inject constructor(
    private val cookieManager: MusicCookieManager,
    private val configManager: ConfigManager,
) {

    private val http = CookieSessionHttp(MusicCookieManager.SOURCE_KG, cookieManager)
    private val gson = Gson()
    private val loginSessionFinalizer = KugouLoginSessionFinalizer()

    /**
     * 写入 Cookie 串，保留已有账号资料；主要用于调试入口，正式登录请走 [finalizeKgLoginSession]。
     */
    fun setCookie(raw: String) {
        cookieManager.saveSession(
            source = MusicCookieManager.SOURCE_KG,
            cookie = raw,
            profile = cookieManager.getProfile(MusicCookieManager.SOURCE_KG) ?: MusicLoginProfile(),
        )
    }

    /** 读取当前持久化后的 `Cookie` 请求头字符串。 */
    fun getCookie(): String = cookieManager.getCookie(MusicCookieManager.SOURCE_KG).cookie

    fun hasCookie(): Boolean = cookieManager.getCookie(MusicCookieManager.SOURCE_KG).exist

    fun getProfile(): MusicLoginProfile? = cookieManager.getProfile(MusicCookieManager.SOURCE_KG)

    /**
     * 获取用户歌单：`/user/playlist`
     * @param page 页数
     * @param pagesize 每页条数，默认服务端 30
     */
    suspend fun getUserPlaylists(
        page: Int? = null,
        pagesize: Int? = null,
    ): Result<KgUserPlaylistResponse> = withContext(Dispatchers.IO) {
        runCatching {
            val params = buildMap {
                page?.let { put("page", it.toString()) }
                pagesize?.let { put("pagesize", it.toString()) }
            }
            val result = http.getBlocking(urlUserPlaylist, params)
            result.parseOrThrow()
        }
    }

    /**
     * 分页拉取当前账号全部歌单，直到累计条数达到 [KgUserPlaylistData.listCount] 或本页为空。
     */
    suspend fun fetchAllUserPlaylists(pageSize: Int = 30): Result<List<KgUserPlaylistInfoItem>> =
        withContext(Dispatchers.IO) {
            runCatching {
                val all = mutableListOf<KgUserPlaylistInfoItem>()
                var page = 1
                while (page <= 500) {
                    val resp = getUserPlaylists(page, pageSize).getOrThrow()
                    if (resp.status != 1 || resp.errorCode != 0) {
                        error("status=${resp.status} error_code=${resp.errorCode}")
                    }
                    val d = resp.data ?: error("missing data")
                    val batch = d.info.orEmpty()
                    if (batch.isEmpty()) break
                    all.addAll(batch)
                    val total = d.listCount ?: all.size
                    if (all.size >= total) break
                    page++
                }
                all
            }
        }

    /** 原始 HTTP 结果（含 body 与本次沿用的 Cookie 请求头）。 */
    suspend fun getUserPlaylistsRaw(
        page: Int? = null,
        pagesize: Int? = null,
    ): CookieHttpResult = withContext(Dispatchers.IO) {
        val params = buildMap {
            page?.let { put("page", it.toString()) }
            pagesize?.let { put("pagesize", it.toString()) }
        }
        http.getBlocking(urlUserPlaylist, params)
    }

    suspend fun getRecommendSongs(): Result<RecommendSongResponse> = requestBase(
        path = "everyday/recommend",
        params = emptyMap(),
        dataClass = RecommendSongResponse::class.java,
    )

    suspend fun getTopCard(cardId: Int): Result<TopCardApiResponse> = requestJson(
        path = "top/card",
        params = mapOf("card_id" to cardId.toString()),
        type = TopCardApiResponse::class.java,
    )

    suspend fun searchSong(
        keyword: String,
        page: Int = 1,
        pagesize: Int = 20,
        type: String? = null,
    ): Result<SearchSongResponse> = requestBase(
        path = "search",
        params = mapOf(
            "keywords" to keyword,
            "page" to page.toString(),
            "pagesize" to pagesize.toString(),
            "type" to type,
        ),
        dataClass = SearchSongResponse::class.java,
    )

    suspend fun searchPlaylist(
        keyword: String,
        page: Int = 1,
        pagesize: Int = 20,
        type: String = "special",
    ): Result<KgSearchPlaylistResponse> = requestBase(
        path = "search",
        params = mapOf(
            "keywords" to keyword,
            "page" to page.toString(),
            "pagesize" to pagesize.toString(),
            "type" to type,
        ),
        dataClass = KgSearchPlaylistResponse::class.java,
    )

    suspend fun searchLyric(hash: String, man: String? = null): Result<SearchLyricResponse> =
        requestJson(
            path = "search/lyric",
            params = mapOf("hash" to hash, "man" to man),
            type = SearchLyricResponse::class.java,
        )

    suspend fun searchLyricByKeywords(keywords: String, man: String? = null): Result<SearchLyricResponse> =
        requestJson(
            path = "search/lyric",
            params = mapOf("keywords" to keywords, "man" to man),
            type = SearchLyricResponse::class.java,
        )

    suspend fun getLyric(
        id: String,
        accesskey: String,
        fmt: String? = null,
        decode: Boolean? = null,
    ): Result<LyricResponse> = requestJson(
        path = "lyric",
        params = mapOf(
            "id" to id,
            "accesskey" to accesskey,
            "fmt" to fmt,
            "decode" to decode?.toString(),
        ),
        type = LyricResponse::class.java,
    )

    suspend fun getHotSongs(): Result<HotSearchResponse> = requestBase(
        path = "search/hot",
        params = emptyMap(),
        dataClass = HotSearchResponse::class.java,
    )

    suspend fun getNewSongs(): Result<NewSongResponse> = requestBase(
        path = "top/song",
        params = emptyMap(),
        dataClass = NewSongResponse::class.java,
    )

    suspend fun getLinkKeyword(keywords: String): Result<SearchSongResponse> = requestBase(
        path = "search/suggest",
        params = mapOf("keywords" to keywords),
        dataClass = SearchSongResponse::class.java,
    )

    suspend fun getTopPlaylists(
        categoryId: Int = 0,
        withsong: Int? = 0,
        page: Int? = null,
        pagesize: Int? = null,
    ): Result<TopPlaylistApiResponse> = requestJson(
        path = "top/playlist",
        params = mapOf(
            "category_id" to categoryId.toString(),
            "withsong" to withsong?.toString(),
            "page" to page?.toString(),
            "pagesize" to pagesize?.toString(),
        ),
        type = TopPlaylistApiResponse::class.java,
    )

    suspend fun getPlaylistTags(): Result<KgPlaylistTagsApiResponse> = requestJson(
        path = "playlist/tags",
        params = emptyMap(),
        type = KgPlaylistTagsApiResponse::class.java,
    )

    suspend fun getPlaylistDetail(ids: String): Result<KgPlaylistDetailApiResponse> = requestJson(
        path = "playlist/detail",
        params = mapOf("ids" to ids),
        type = KgPlaylistDetailApiResponse::class.java,
    )

    suspend fun getPlaylistTrackAll(
        id: String,
        page: Int = 1,
        pagesize: Int = 30,
    ): Result<KgPlaylistTrackAllApiResponse> = requestJson(
        path = "playlist/track/all",
        params = mapOf(
            "id" to id,
            "page" to page.toString(),
            "pagesize" to pagesize.toString(),
        ),
        type = KgPlaylistTrackAllApiResponse::class.java,
    )

    /** 调试：`GET /user/detail`（无额外 query，可按需扩展 [params]）。 */
    suspend fun getUserDetailRaw(params: Map<String, String?> = emptyMap()): CookieHttpResult =
        withContext(Dispatchers.IO) {
            http.getBlocking(urlUserDetail, params)
        }

    /** 侧栏展示直接读取登录成功时保存的账号摘要。 */
    suspend fun fetchDrawerUserInfo(): Result<KgDrawerUserInfo> = withContext(Dispatchers.IO) {
        runCatching {
            val profile = getProfile() ?: error("no profile")
            KgDrawerUserInfo(
                nickname = profile.nickname.ifBlank { profile.username.ifBlank { "酷狗用户" } },
                avatarUrl = profile.avatarUrl.takeIf { it.isNotBlank() },
            )
        }
    }

    /**
     * 手机/扫码登录成功后用 [token]、[userid] 请求 `/login/token`，再合成持久化 Cookie。
     * `vip_token` 可能为空，不能把空值视为登录失败。
     */
    suspend fun finalizeKgLoginSession(
        cookieHeaderAfterAuth: String,
        token: String,
        userid: String,
        nickname: String = "",
        avatarUrl: String = "",
    ): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            val authPayload = KugouLoginAuthPayload(
                token = token,
                userid = userid,
                nickname = nickname,
                avatarUrl = avatarUrl,
            )
            val cookieForTokenRequest = CookieRequest.parseCookieHeader(cookieHeaderAfterAuth)
                .entries
                .joinToString("; ") { "${it.key}=${it.value}" }

            val tokenUrl = urlFor("login/token")
            val tokenResp = CookieRequest.getBlocking(
                tokenUrl,
                mapOf("token" to token, "userid" to userid),
                cookieForTokenRequest,
                KG_LOGIN_BROWSER_HEADERS,
            )
            if (!tokenResp.isSuccessful) {
                Log.w(TAG, "login/token HTTP ${tokenResp.code}, body=${tokenResp.body.take(MAX_LOG_BODY_LENGTH)}")
                error("login/token HTTP ${tokenResp.code}")
            }
            val envelope = gson.fromJson(tokenResp.body, KgStdEnvelope::class.java)
            if (envelope.status != 1) {
                error(envelope.msg ?: envelope.message ?: "login/token status=${envelope.status}")
            }
            val data = envelope.data ?: error("login/token 无 data")
            val finalized = loginSessionFinalizer.buildSession(
                cookieHeaderAfterAuth = cookieHeaderAfterAuth,
                authPayload = authPayload,
                tokenData = data,
            )
            var profile = finalized.profile
            if (profile.avatarUrl.isBlank()) {
                val fallback = runCatching { fetchPlaylistOwnerInfoForCookie(finalized.cookie) }.getOrNull()
                profile = profile.copy(
                    nickname = profile.nickname.ifBlank { fallback?.nickname.orEmpty() },
                    username = profile.username.ifBlank { fallback?.nickname.orEmpty() },
                    avatarUrl = fallback?.avatarUrl.orEmpty(),
                )
            }

            cookieManager.saveSession(
                source = MusicCookieManager.SOURCE_KG,
                cookie = finalized.cookie,
                profile = profile,
            )
        }
    }

    private fun fetchPlaylistOwnerInfoForCookie(cookie: String): KgDrawerUserInfo? {
        val result = CookieRequest.getBlocking(
            url = urlUserPlaylist,
            params = mapOf("page" to "1", "pagesize" to "30"),
            cookie = cookie,
            mergeResponseSetCookie = false,
        )
        if (!result.isSuccessful) return null
        val playlists = gson.fromJson(result.body, KgUserPlaylistResponse::class.java) ?: return null
        val first = playlists.data?.info?.firstOrNull() ?: return null
        val nickname = first.listCreateUsername?.trim().orEmpty()
        val avatarUrl = first.createUserPic?.trim().orEmpty()
        return KgDrawerUserInfo(
            nickname = nickname.takeIf { it.isNotBlank() } ?: "酷狗用户",
            avatarUrl = avatarUrl.takeIf { it.isNotBlank() },
        )
    }

    private fun CookieHttpResult.parseOrThrow(): KgUserPlaylistResponse {
        if (!isSuccessful) {
            error("HTTP $code")
        }
        return gson.fromJson(body, KgUserPlaylistResponse::class.java)
            ?: error("empty json")
    }

    private suspend fun <T> requestBase(
        path: String,
        params: Map<String, String?>,
        dataClass: Class<T>,
    ): Result<T> = withContext(Dispatchers.IO) {
        runCatching {
            val type = TypeToken.getParameterized(BaseResponse::class.java, dataClass).type
            val response = requestJsonEnvelope<BaseResponse<T>>(path, params, type)
            if (response.code != 0) {
                error(response.message.ifBlank { "error_code=${response.code}" })
            }
            response.data
        }
    }

    private suspend fun <T> requestJson(
        path: String,
        params: Map<String, String?>,
        type: Type,
    ): Result<T> = withContext(Dispatchers.IO) {
        runCatching {
            requestJsonEnvelope(path, params, type)
        }
    }

    private fun <T> requestJsonEnvelope(
        path: String,
        params: Map<String, String?>,
        type: Type,
    ): T {
        val result = http.getBlocking(urlFor(path), params)
        if (!result.isSuccessful) error("HTTP ${result.code}")
        return gson.fromJson<T>(result.body, type) ?: error("empty json")
    }

    private fun urlFor(path: String): String =
        "${apiBaseUrl.trimEnd('/')}/${path.trimStart('/')}"

    private val urlUserPlaylist: String
        get() = urlFor("user/playlist")

    private val urlUserDetail: String
        get() = urlFor("user/vip/detail")

    private val apiBaseUrl: String
        get() = configManager.getKgBaseUrl()

    companion object {
        private const val TAG = "KugouCookieRepository"
        private const val MAX_LOG_BODY_LENGTH = 4000

        val KG_LOGIN_BROWSER_HEADERS: Map<String, String> = emptyMap()
    }
}
