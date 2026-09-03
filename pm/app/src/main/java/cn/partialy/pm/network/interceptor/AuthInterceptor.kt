package cn.partialy.pm.network.interceptor

import android.os.Build
import android.util.Base64
import cn.partialy.pm.network.auth.TokenManager
import okhttp3.Interceptor
import okhttp3.Request
import okhttp3.Response

class AuthInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        return makeRequest(chain, originalRequest)
    }
    
    private fun makeRequest(chain: Interceptor.Chain, originalRequest: Request): Response {
        val token = TokenManager.getToken()
        val hasExplicitAuthorization = originalRequest.headers.names()
            .any { it.equals("Authorization", ignoreCase = true) }
        // 专属消息的设备身份是捕获时的快照。访客快照不得在异步回执时混入之后登录的账号。
        val hasDeviceMessageToken = !originalRequest.header("x-pm-device-token").isNullOrBlank()
        val newRequest = originalRequest.newBuilder().apply {
            token?.takeIf { !hasExplicitAuthorization && !hasDeviceMessageToken }?.let {
                header("Authorization", "Bearer $it")
            }
            header("Device-Model", encodeDeviceModel())
            header("Device-Info", encodeDeviceInfo())
            header("Content-Type", "application/json")
        }.build()
        
        return chain.proceed(newRequest)
    }

    // 编码设备型号
    private fun encodeDeviceModel(): String {
        val deviceModel = Build.MODEL  // 例如：M2102J2SC
        return Base64.encodeToString(deviceModel.toByteArray(), Base64.NO_WRAP)
    }
    
    // 编码设备信息
    private fun encodeDeviceInfo(): String {
        val deviceInfo = buildString {
            append("Model: ${Build.MODEL},")
            append("Brand: ${Build.BRAND},")
            append("Manufacturer: ${Build.MANUFACTURER}")
        }
        return Base64.encodeToString(deviceInfo.toByteArray(), Base64.NO_WRAP)
    }
}
