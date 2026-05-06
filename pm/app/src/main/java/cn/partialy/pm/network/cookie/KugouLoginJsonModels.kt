package cn.partialy.pm.network.cookie

import com.google.gson.JsonObject
import com.google.gson.annotations.SerializedName

/** 酷狗网关常见外层：`status == 1` 表示成功（与 music-login-hub 一致）。 */
internal data class KgStdEnvelope(
    @SerializedName("status") val status: Int = 0,
    @SerializedName("error_code") val errorCode: Int = 0,
    @SerializedName("data") val data: JsonObject? = null,
    @SerializedName("msg") val msg: String? = null,
    @SerializedName("message") val message: String? = null,
)

internal data class KgQrKeyEnvelope(
    @SerializedName("status") val status: Int = 0,
    @SerializedName("data") val data: KgQrKeyData? = null,
)

internal data class KgQrKeyData(
    @SerializedName("qrcode") val qrcode: String = "",
    @SerializedName("qrcode_img") val qrcodeImg: String = "",
)
