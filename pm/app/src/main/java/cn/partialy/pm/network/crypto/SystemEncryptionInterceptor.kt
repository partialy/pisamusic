package cn.partialy.pm.network.crypto

import android.util.Log
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okio.Buffer
import org.json.JSONObject
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 仅作用于自有后端（SystemApiService 链路）：
 *
 * - 请求方向：生成 128 字符随机 hex `reqKey`，写入头 `x-pm-random`；如果原请求是 JSON body
 *   且非空，则按 `{ts, nonce, p:<原 body>}` 包装成明文，AES-GCM 加密为 `{isEnc, encData}` 信封。
 * - 响应方向：若响应体形如 `{isEnc:true, encData:<base64url>}`，则用响应头里的 `x-pm-random`
 *   解密并把响应体替换回原始明文 JSON；若 `isEnc=false` 或响应体不是该信封形态，原样透传
 *   （白名单接口走这一路径）。
 *
 * 不在此处做任何鉴权 / 重试，避免拖垮上层。
 */
@Singleton
class SystemEncryptionInterceptor @Inject constructor() : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        val reqKey = AesGcmCrypto.randomFullKey()

        val builder = original.newBuilder()
            .header(EncryptionConstants.HEADER_RANDOM, reqKey)
            .header(EncryptionConstants.HEADER_VER, EncryptionConstants.ENC_VER)

        val rewritten = rewriteRequestBody(original, reqKey, builder)
        val outgoing = rewritten.build()
        val response = chain.proceed(outgoing)
        return rewriteResponseBody(response)
    }

    private fun rewriteRequestBody(
        original: Request,
        reqKey: String,
        builder: Request.Builder,
    ): Request.Builder {
        val body = original.body ?: return builder
        if (!isJsonBody(body)) return builder

        val plain = readBodyAsString(body)
        if (plain.isBlank()) return builder

        val payload = buildString {
            append("{\"ts\":").append(System.currentTimeMillis())
            append(",\"nonce\":\"").append(UUID.randomUUID().toString()).append("\"")
            append(",\"p\":").append(plain)
            append('}')
        }
        val encData = AesGcmCrypto.encrypt(reqKey, payload)
        val envelope = JSONObject()
            .put("isEnc", true)
            .put("encData", encData)
            .toString()
        val newBody = envelope.toRequestBody(JSON_MEDIA_TYPE)
        builder.method(original.method, newBody)
        return builder
    }

    private fun rewriteResponseBody(response: Response): Response {
        val body = response.body ?: return response
        val contentType = body.contentType()
        if (contentType != null && !contentType.toString().contains("json", ignoreCase = true)) {
            return response
        }

        val raw = try {
            body.string()
        } catch (e: Exception) {
            Log.w(TAG, "read response body failed", e)
            return response
        }

        if (raw.isEmpty()) {
            return response.newBuilder()
                .body(raw.toResponseBody(contentType))
                .build()
        }

        val parsed = try {
            JSONObject(raw)
        } catch (_: Exception) {
            return response.newBuilder()
                .body(raw.toResponseBody(contentType))
                .build()
        }

        val isEnc = parsed.optBoolean("isEnc", false)
        if (!isEnc) {
            return response.newBuilder()
                .body(raw.toResponseBody(contentType))
                .build()
        }

        val encData = parsed.optString("encData", "")
        val respKey = response.header(EncryptionConstants.HEADER_RANDOM)
        if (encData.isEmpty() || respKey.isNullOrEmpty()) {
            Log.w(TAG, "encrypted response missing encData / x-pm-random header")
            return response.newBuilder()
                .body(raw.toResponseBody(contentType))
                .build()
        }

        val plain = try {
            AesGcmCrypto.decrypt(respKey, encData)
        } catch (e: Exception) {
            Log.w(TAG, "decrypt response failed", e)
            return response.newBuilder()
                .body(raw.toResponseBody(contentType))
                .build()
        }

        return response.newBuilder()
            .body(plain.toResponseBody(JSON_MEDIA_TYPE))
            .build()
    }

    private fun isJsonBody(body: RequestBody): Boolean {
        val ct = body.contentType()?.toString() ?: return false
        return ct.contains("json", ignoreCase = true)
    }

    private fun readBodyAsString(body: RequestBody): String {
        val buffer = Buffer()
        body.writeTo(buffer)
        return buffer.readUtf8()
    }

    companion object {
        private const val TAG = "SystemEncInterceptor"
        private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}
