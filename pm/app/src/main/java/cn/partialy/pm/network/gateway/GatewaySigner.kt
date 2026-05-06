package cn.partialy.pm.network.gateway

import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import okhttp3.HttpUrl

internal object GatewaySigner {
    private val reservedQueryKeys = setOf("s", "t", "n", "enc")

    fun buildSignature(
        method: String,
        url: HttpUrl,
        bodyBytes: ByteArray,
        timestamp: String,
        nonce: String,
        asValue: String,
        secret: String,
    ): String {
        val canonical = buildCanonicalString(
            method = method,
            url = url,
            bodyBytes = bodyBytes,
            timestamp = timestamp,
            nonce = nonce,
            asValue = asValue,
        )
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256"))
        return Base64.getEncoder().encodeToString(
            mac.doFinal(canonical.toByteArray(StandardCharsets.UTF_8)),
        )
    }

    fun buildCanonicalString(
        method: String,
        url: HttpUrl,
        bodyBytes: ByteArray,
        timestamp: String,
        nonce: String,
        asValue: String,
    ): String = listOf(
        "v2",
        method.uppercase(),
        url.encodedPath,
        canonicalQuery(url),
        sha256Base64(bodyBytes),
        timestamp,
        nonce,
        asValue,
    ).joinToString("\n")

    fun canonicalQuery(url: HttpUrl): String {
        if (url.querySize == 0) return ""
        val groups = sortedMapOf<String, MutableList<String>>()
        for (i in 0 until url.querySize) {
            val name = url.queryParameterName(i)
            if (reservedQueryKeys.contains(name)) continue
            val value = url.queryParameterValue(i).orEmpty()
            groups.getOrPut(name) { mutableListOf() }.add(value)
        }
        if (groups.isEmpty()) return ""
        return groups.entries.flatMap { (name, values) ->
            values.sorted().map { value ->
                "${javaUrlEncode(name)}=${javaUrlEncode(value)}"
            }
        }.joinToString("&")
    }

    fun sha256Base64(bytes: ByteArray): String {
        if (bytes.isEmpty()) return ""
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        return Base64.getEncoder().encodeToString(digest)
    }

    private fun javaUrlEncode(value: String): String {
        val bytes = value.toByteArray(StandardCharsets.UTF_8)
        val sb = StringBuilder(bytes.size)
        for (byte in bytes) {
            val c = byte.toInt() and 0xFF
            if (c == ' '.code) {
                sb.append('+')
            } else if (isJavaUrlEncodeSafe(c)) {
                sb.append(c.toChar())
            } else {
                sb.append('%')
                sb.append(HEX[c ushr 4])
                sb.append(HEX[c and 0x0F])
            }
        }
        return sb.toString()
    }

    private fun isJavaUrlEncodeSafe(c: Int): Boolean =
        c in 'A'.code..'Z'.code ||
            c in 'a'.code..'z'.code ||
            c in '0'.code..'9'.code ||
            c == '-'.code ||
            c == '_'.code ||
            c == '.'.code ||
            c == '*'.code

    private val HEX = "0123456789ABCDEF".toCharArray()
}
