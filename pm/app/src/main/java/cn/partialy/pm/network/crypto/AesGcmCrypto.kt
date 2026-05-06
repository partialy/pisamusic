package cn.partialy.pm.network.crypto

import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * AES-GCM 加解密 + HMAC-SHA256 派生（与 Node 后端 server/src/crypto/aesGcm.ts 双端一致）。
 *
 * - aesKey = HMAC_SHA256(SECRET, fullKey_utf8)[0..16) → AES-128
 * - encData = base64url(IV(12) || ciphertext || tag(16))
 */
internal object AesGcmCrypto {

    private val secureRandom = SecureRandom()

    fun randomFullKey(): String {
        val bytes = ByteArray(EncryptionConstants.FULL_KEY_HEX_LENGTH / 2)
        secureRandom.nextBytes(bytes)
        return bytesToHex(bytes)
    }

    fun deriveAesKey(fullKeyHex: String): ByteArray {
        require(fullKeyHex.length == EncryptionConstants.FULL_KEY_HEX_LENGTH) {
            "invalid fullKey length"
        }
        val mac = Mac.getInstance("HmacSHA256")
        val secretBytes = EncryptionConstants.SECRET.toByteArray(StandardCharsets.UTF_8)
        mac.init(SecretKeySpec(secretBytes, "HmacSHA256"))
        val full = mac.doFinal(fullKeyHex.toByteArray(StandardCharsets.UTF_8))
        return full.copyOfRange(0, 16)
    }

    fun encrypt(fullKeyHex: String, plain: String): String {
        val keyBytes = deriveAesKey(fullKeyHex)
        val iv = ByteArray(EncryptionConstants.IV_LENGTH)
        secureRandom.nextBytes(iv)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.ENCRYPT_MODE,
            SecretKeySpec(keyBytes, "AES"),
            GCMParameterSpec(EncryptionConstants.TAG_LENGTH_BITS, iv),
        )
        val ctAndTag = cipher.doFinal(plain.toByteArray(StandardCharsets.UTF_8))
        val combined = ByteArray(iv.size + ctAndTag.size)
        System.arraycopy(iv, 0, combined, 0, iv.size)
        System.arraycopy(ctAndTag, 0, combined, iv.size, ctAndTag.size)
        return base64UrlEncode(combined)
    }

    fun decrypt(fullKeyHex: String, encDataB64Url: String): String {
        val keyBytes = deriveAesKey(fullKeyHex)
        val raw = base64UrlDecode(encDataB64Url)
        require(raw.size > EncryptionConstants.IV_LENGTH) { "encData too short" }
        val iv = raw.copyOfRange(0, EncryptionConstants.IV_LENGTH)
        val ctAndTag = raw.copyOfRange(EncryptionConstants.IV_LENGTH, raw.size)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            SecretKeySpec(keyBytes, "AES"),
            GCMParameterSpec(EncryptionConstants.TAG_LENGTH_BITS, iv),
        )
        val plain = cipher.doFinal(ctAndTag)
        return String(plain, StandardCharsets.UTF_8)
    }

    private fun base64UrlEncode(bytes: ByteArray): String {
        return Base64.encodeToString(bytes, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }

    private fun base64UrlDecode(s: String): ByteArray {
        return Base64.decode(s, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
    }

    private fun bytesToHex(bytes: ByteArray): String {
        val sb = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            val v = b.toInt() and 0xFF
            sb.append(HEX_CHARS[v ushr 4])
            sb.append(HEX_CHARS[v and 0x0F])
        }
        return sb.toString()
    }

    private val HEX_CHARS = "0123456789abcdef".toCharArray()
}
