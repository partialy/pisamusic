package cn.partialy.pm.ui.web

import java.nio.charset.StandardCharsets
import java.security.MessageDigest

/**
 * 为内嵌 H5 提供宿主身份动态挑战签名，防止普通浏览器直接预览 H5 页面。
 * 与 `server/app-h5/src/utils/hostBridge.ts` 保持同一派生算法。
 */
object WebHostBridgeSecurity {
    private const val SALT = "pisa-h5-host-guard-v1"
    private const val PREFIX = "pmh5:"

    fun signChallenge(nonce: String?): String {
        val clean = nonce?.trim().orEmpty()
        if (clean.isEmpty() || clean.length > 128) return ""
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("$clean:$SALT".toByteArray(StandardCharsets.UTF_8))
        val hex = StringBuilder(64)
        for (b in digest) {
            val v = b.toInt() and 0xff
            if (v < 16) hex.append('0')
            hex.append(v.toString(16))
        }
        return "$PREFIX${hex.substring(0, 32)}"
    }
}
