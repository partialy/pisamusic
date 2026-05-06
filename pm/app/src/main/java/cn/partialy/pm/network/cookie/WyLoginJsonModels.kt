package cn.partialy.pm.network.cookie

import com.google.gson.annotations.SerializedName

internal data class WyQrKeyEnvelope(
    @SerializedName("code") val code: Int = 0,
    @SerializedName("data") val data: WyQrKeyData? = null,
)

internal data class WyQrKeyData(
    @SerializedName("unikey") val unikey: String = "",
)

internal data class WyQrCreateEnvelope(
    @SerializedName("code") val code: Int = 0,
    @SerializedName("data") val data: WyQrCreateData? = null,
)

internal data class WyQrCreateData(
    @SerializedName("qrimg") val qrimg: String = "",
)

internal data class WyQrCheckEnvelope(
    @SerializedName("code") val code: Int = 0,
    @SerializedName("message") val message: String? = null,
    @SerializedName("cookie") val cookie: String? = null,
)
