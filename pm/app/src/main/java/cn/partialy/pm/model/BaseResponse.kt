package cn.partialy.pm.model

import com.google.gson.annotations.SerializedName

/** 蓝/部分网关接口 body 为 error_code、error_msg、data，与字段名 code/message 对齐 */
data class BaseResponse<T>(
    @SerializedName("error_code") val code: Int = 0,
    @SerializedName("error_msg") val message: String = "",
    val data: T,
)