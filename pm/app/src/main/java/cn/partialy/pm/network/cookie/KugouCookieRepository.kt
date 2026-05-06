package cn.partialy.pm.network.cookie

import android.content.Context
import cn.partialy.pm.network.CookieHttpResult
import cn.partialy.pm.network.CookieRequest
import cn.partialy.pm.network.CookieSessionHttp
import cn.partialy.pm.network.cookie.model.KgDrawerUserInfo
import cn.partialy.pm.network.cookie.model.KgUserPlaylistInfoItem
import cn.partialy.pm.network.cookie.model.KgUserPlaylistResponse
import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 独立酷狗「需登录 Cookie」接口（与现有 [cn.partialy.pm.network.api.KgApiService] 无关）。
 *
 * 接口说明见项目根目录 [needCookieAPI.md]。Base URL 需与登录 Cookie 域一致，可按实际网关调整 [API_BASE].
 */
@Singleton
class KugouCookieRepository @Inject constructor(
    @ApplicationContext context: Context,
) {

    private val store = PersistedUserCookieStore(context, CookiePersistenceFileNames.KUGOU)
    private val http = CookieSessionHttp(store)
    private val gson = Gson()

    /**
     * 写入 WebView 等来源的 Cookie 串：解析、过期约 50 年、落盘。
     */
    fun setCookie(raw: String) {
        store.setCookie(raw)
    }

    /** 读取当前持久化后的 `Cookie` 请求头字符串。 */
    fun getCookie(): String = store.getCookie()

    /** 丢弃内存条目并从磁盘 JSON 重新加载（与 [getCookie] 同源）。 */
    fun reloadPersistedCookieFromDisk() {
        store.reloadFromDisk()
    }

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

    /** 原始 HTTP 结果（含 body、合并后的 Cookie 建议值）。 */
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

    /** 调试：`GET /user/detail`（无额外 query，可按需扩展 [params]）。 */
    suspend fun getUserDetailRaw(params: Map<String, String?> = emptyMap()): CookieHttpResult =
        withContext(Dispatchers.IO) {
            http.getBlocking(urlUserDetail, params)
        }

    /**
     * 侧栏展示：Cookie 中 `userid` + `token` 请求 `/login/token`，从 `data` 解析昵称与头像；
     * 缺省时用 `/user/playlist` 首条里的 `list_create_username` / `create_user_pic`。
     */
    suspend fun fetchDrawerUserInfo(): Result<KgDrawerUserInfo> = withContext(Dispatchers.IO) {
        runCatching {
            val cookie = getCookie().trim()
            if (cookie.isEmpty()) error("no cookie")
            val map = CookieRequest.parseCookieHeader(cookie)
            val byLowerKey = map.entries.associate { it.key.lowercase().trim() to it.value.trim() }
            fun cookieVal(vararg keys: String): String? {
                for (k in keys) {
                    byLowerKey[k.lowercase()]?.takeIf { it.isNotEmpty() }?.let { return it }
                }
                return null
            }
            val userid = cookieVal("userid") ?: error("no userid in cookie")
            val token = cookieVal("token") ?: error("no token in cookie")

            val tokenUrl = "${API_BASE.trimEnd('/')}/login/token"
            val tokenResp = CookieRequest.getBlocking(
                tokenUrl,
                mapOf("token" to token, "userid" to userid),
                cookie,
                KG_LOGIN_BROWSER_HEADERS,
            )
            if (!tokenResp.isSuccessful) error("login/token HTTP ${tokenResp.code}")
            val envelope = gson.fromJson(tokenResp.body, KgStdEnvelope::class.java)
            val data = envelope.data ?: error("login/token no data")
            var nickname = data.stringFromKeys(
                "nickname"
            )
            var avatarUrl = data.stringFromKeys(
                "arttoy_avatar", "avatar"
            )

            if (nickname.isNullOrBlank() || avatarUrl.isNullOrBlank()) {
                val playlists = getUserPlaylists(page = 1, pagesize = 30).getOrNull()
                val first = playlists?.data?.info?.firstOrNull()
                if (nickname.isNullOrBlank()) {
                    nickname = first?.listCreateUsername?.trim().orEmpty()
                }
                if (avatarUrl.isNullOrBlank()) {
                    avatarUrl = first?.createUserPic?.trim()?.takeIf { it.isNotEmpty() }
                }
            }

            KgDrawerUserInfo(
                nickname = nickname.takeIf { it.isNotBlank() } ?: "酷狗用户",
                avatarUrl = avatarUrl?.takeIf { it.isNotBlank() },
            )
        }
    }

    private fun JsonObject.stringFromKeys(vararg keys: String): String? {
        for (k in keys) {
            val el = get(k) ?: continue
            val s = el.jsonPrimitiveTrimmed() ?: continue
            if (s.isNotEmpty()) return s
        }
        return null
    }

    private fun JsonElement.jsonPrimitiveTrimmed(): String? {
        if (isJsonNull || !isJsonPrimitive) return null
        val p = asJsonPrimitive
        return when {
            p.isString -> p.asString.trim()
            p.isNumber -> p.asNumber.toString().trim()
            else -> null
        }
    }

    /**
     * 手机/扫码登录成功并已拿到响应体中的 [token]、[userid] 与合并后的 `Cookie` 请求头串（含 Set-Cookie）后：
     * 1. 解析 [cookieHeaderAfterAuth] 暂存；2. 携带该 Cookie 请求 `/login/token`；
     * 3. 从响应体取 vip_type、vip_token、userid、token；4. 拼 synthetic 串再解析；
     * 5. 以同名覆盖合并入步骤 1；6. [setCookie] 落盘。
     */
    suspend fun finalizeKgLoginSession(
        cookieHeaderAfterAuth: String,
        token: String,
        userid: String,
    ): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            // 1. 解析登录成功后的 Cookie 串（含服务端 Set-Cookie 合并结果）暂存为 map
            val step1Map = CookieRequest.parseCookieHeader(cookieHeaderAfterAuth)
            val cookieForTokenRequest = step1Map.entries.joinToString("; ") { "${it.key}=${it.value}" }

            // 2. 携带步骤 1 的 Cookie 请求 /login/token（对齐网关 query：token、userid）
            val tokenUrl = "${API_BASE.trimEnd('/')}/login/token"
            val tokenResp = CookieRequest.getBlocking(
                tokenUrl,
                mapOf("token" to token, "userid" to userid),
                cookieForTokenRequest,
                KG_LOGIN_BROWSER_HEADERS,
            )
            if (!tokenResp.isSuccessful) {
                error("login/token HTTP ${tokenResp.code}")
            }
            val envelope = gson.fromJson(tokenResp.body, KgStdEnvelope::class.java)
            if (envelope.status != 1) {
                error(envelope.msg ?: envelope.message ?: "login/token status=${envelope.status}")
            }
            val data = envelope.data ?: error("login/token 无 data")

            // 3. 从 data 取出 vip_type、vip_token、userid、token（兼容数值/字符串）
            val vipType = data.get("vip_type").toCookieValueString().ifBlank { "0" }
            val vipToken = data.get("vip_token").toCookieValueString()
            val uid = data.get("userid").toCookieValueString()
            val tok = data.get("token").toCookieValueString()
            if (vipToken.isBlank() || uid.isBlank() || tok.isBlank()) {
                error("login/token 缺少 vip_token/userid/token")
            }

            // 4. 按产品约定拼一段「类 Cookie」串并解析（与 TS 侧一致）
            val synthetic =
                "KUGOU_API_PLATFORM=undefined; token=$tok; userid=$uid; vip_type=$vipType; vip_token=$vipToken"
            val syntheticMap = CookieRequest.parseCookieHeader(synthetic)

            // 5. 将解析结果并入步骤 1（同名覆盖）
            val merged = LinkedHashMap(step1Map)
            for ((k, v) in syntheticMap) {
                merged[k] = v
            }
            val finalHeader = merged.entries.joinToString("; ") { "${it.key}=${it.value}" }

            // 6. 写入本地文件（走现有 PersistedUserCookieStore）
            setCookie(finalHeader)
        }
    }

    private fun JsonElement?.toCookieValueString(): String {
        if (this == null || isJsonNull) return ""
        if (!isJsonPrimitive) return ""
        val p = asJsonPrimitive
        return when {
            p.isString -> p.asString
            p.isNumber -> p.asNumber.toString()
            p.isBoolean -> p.asBoolean.toString()
            else -> ""
        }
    }

    private fun CookieHttpResult.parseOrThrow(): KgUserPlaylistResponse {
        if (!isSuccessful) {
            error("HTTP $code")
        }
        return gson.fromJson(body, KgUserPlaylistResponse::class.java)
            ?: error("empty json")
    }

    private val urlUserPlaylist: String
        get() = "${API_BASE.trimEnd('/')}/user/playlist"

    private val urlUserDetail: String
        get() = "${API_BASE.trimEnd('/')}/user/vip/detail"

    companion object {
        /** 与 [cn.partialy.pm.activity.PlaylistImportActivity] 登录域一致，可按实际接口主机修改 */
        const val API_BASE: String = "https://gateway.partialy.cn/kg-service"

        /** 与 music-login-hub `musicApi.ts` 中酷狗请求头一致，便于网关校验 */
        val KG_LOGIN_BROWSER_HEADERS: Map<String, String> = mapOf(
            "User-Agent" to
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0",
            "Referer" to "https://www.kugou.com",
            "Origin" to "https://www.kugou.com",
            "Accept" to "application/json, text/plain, */*",
            "Accept-Language" to "zh-CN,zh;q=0.9",
            "Content-Type" to "application/json",
            "Cache-Control" to "no-cache",
            "Pragma" to "no-cache",
        )
    }
}
