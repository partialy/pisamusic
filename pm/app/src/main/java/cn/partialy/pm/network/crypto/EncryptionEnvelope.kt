package cn.partialy.pm.network.crypto

/**
 * 端到端加密信封：请求和响应在加密时统一被打包成这个结构。
 *
 * - isEnc=true 表示 encData 是 Base64URL 编码的 AES-GCM 密文（IV‖ciphertext‖tag）。
 * - isEnc=false 表示该响应未加密，业务层应直接读取响应的实际 JSON。
 */
internal data class EncryptedEnvelope(
    val isEnc: Boolean,
    val encData: String?,
)
