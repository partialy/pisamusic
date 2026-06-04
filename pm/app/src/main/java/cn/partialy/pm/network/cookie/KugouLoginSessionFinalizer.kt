package cn.partialy.pm.network.cookie

import cn.partialy.pm.network.CookieRequest
import com.google.gson.JsonElement
import com.google.gson.JsonObject

data class KugouLoginAuthPayload(
    val token: String,
    val userid: String,
    val nickname: String = "",
    val avatarUrl: String = "",
)

data class KugouLoginSessionFinalized(
    val cookie: String,
    val profile: MusicLoginProfile,
)

class KugouLoginSessionFinalizer {

    fun buildSession(
        cookieHeaderAfterAuth: String,
        authPayload: KugouLoginAuthPayload,
        tokenData: JsonObject,
    ): KugouLoginSessionFinalized {
        val step1Map = CookieRequest.parseCookieHeader(cookieHeaderAfterAuth)
        val vipType = tokenData.scalar("vip_type").ifBlank { "0" }
        val vipToken = tokenData.scalar("vip_token")
        val uid = tokenData.scalar("userid").ifBlank { authPayload.userid }
        val tok = tokenData.scalar("token").ifBlank { authPayload.token }
        require(uid.isNotBlank() && tok.isNotBlank()) {
            "login/token 缺少 userid/token"
        }

        val synthetic = buildSyntheticCookie(
            token = tok,
            userid = uid,
            vipType = vipType,
            vipToken = vipToken,
        )
        val merged = LinkedHashMap(step1Map)
        for ((k, v) in CookieRequest.parseCookieHeader(synthetic)) {
            merged[k] = v
        }

        val nickname = tokenData.firstScalar("nickname", "username", "user_name")
            .ifBlank { authPayload.nickname }
            .ifBlank { "酷狗用户" }
        val username = tokenData.firstScalar("username", "user_name", "nickname")
            .ifBlank { uid }
        val avatarUrl = tokenData.firstScalar("pic", "arttoy_avatar", "avatar")
            .ifBlank { authPayload.avatarUrl }

        return KugouLoginSessionFinalized(
            cookie = merged.entries.joinToString("; ") { "${it.key}=${it.value}" },
            profile = MusicLoginProfile(
                userId = uid,
                username = username,
                nickname = nickname,
                avatarUrl = avatarUrl,
                isVip = vipType.toIntOrNull()?.let { it > 0 }
                    ?: (vipType.isNotBlank() && vipType != "0"),
                vipType = vipType,
                rawProfileJson = tokenData.toString(),
            ),
        )
    }

    private fun buildSyntheticCookie(
        token: String,
        userid: String,
        vipType: String,
        vipToken: String,
    ): String =
        "KUGOU_API_PLATFORM=undefined; token=$token; userid=$userid; vip_type=$vipType; vip_token=$vipToken"

    private fun JsonObject.firstScalar(vararg keys: String): String {
        for (key in keys) {
            val value = scalar(key)
            if (value.isNotBlank()) return value
        }
        return ""
    }

    private fun JsonObject.scalar(key: String): String =
        get(key).toScalarString().trim()

    private fun JsonElement?.toScalarString(): String {
        if (this == null || isJsonNull || !isJsonPrimitive) return ""
        val primitive = asJsonPrimitive
        return when {
            primitive.isString -> primitive.asString
            primitive.isNumber -> primitive.asNumber.toString()
            primitive.isBoolean -> primitive.asBoolean.toString()
            else -> ""
        }
    }
}
