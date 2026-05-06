package cn.partialy.pm.network.gateway

import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import okhttp3.Interceptor
import okhttp3.Response
import okio.Buffer

@Singleton
class GatewaySignInterceptor @Inject constructor() : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()
        if (!GatewaySignRuntime.shouldSign(original.url)) {
            return chain.proceed(original)
        }

        val signedUrl = original.url.newBuilder()
            .setQueryParameter("res-dec", "1")
            .build()
        val bodyBytes = original.body?.let { body ->
            val buffer = Buffer()
            body.writeTo(buffer)
            buffer.readByteArray()
        } ?: ByteArray(0)
        val timestamp = System.currentTimeMillis().toString()
        val nonce = UUID.randomUUID().toString().replace("-", "")
        val signConfig = GatewaySignRuntime.current()
        val signature = GatewaySigner.buildSignature(
            method = original.method,
            url = signedUrl,
            bodyBytes = bodyBytes,
            timestamp = timestamp,
            nonce = nonce,
            asValue = signConfig.asValue,
            secret = signConfig.secret,
        )

        val signedRequest = original.newBuilder()
            .url(signedUrl)
            .header("t", timestamp)
            .header("n", nonce)
            .header("s", signature)
            .build()
        return chain.proceed(signedRequest)
    }
}
