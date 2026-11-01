package cn.partialy.pm.appshare

import android.content.Context
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.R
import cn.partialy.pm.network.api.SystemApiService
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppShareRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: SystemApiService,
) {
    private val preferences = context.getSharedPreferences("app_share", Context.MODE_PRIVATE)
    private val gson = Gson()

    fun cachedOrDefault(): AppShareConfig = runCatching {
        val json = preferences.getString("config", null) ?: return@runCatching defaults()
        normalize(gson.fromJson(json, AppShareConfig::class.java))
    }.getOrElse { defaults() }

    suspend fun refresh(): AppShareConfig {
        val response = api.getAppShare()
        check(response.success && response.code == 0) { response.msg }
        val received = requireNotNull(response.data)
        val config = normalize(received)
        // 单个 JSON 是完整发布快照，避免分字段缓存产生跨版本混合。
        preferences.edit().putString("config", gson.toJson(received)).apply()
        return config
    }

    private fun normalize(config: AppShareConfig): AppShareConfig {
        require(config.appName.isNotBlank() && config.appName.length <= 60)
        require(config.copyText.isNotBlank() && isWebUrl(config.qrCodeText))
        require(config.qrCodeText.length <= 1000 && config.qrCodeText.toByteArray(Charsets.UTF_8).size <= 2000)
        require(config.iconUrl.isBlank() || isWebUrl(config.iconUrl))
        return config.copy(version = config.version.takeUnless {
            it.isBlank() || it.removePrefix("v") == "0.0.0"
        } ?: BuildConfig.VERSION_NAME)
    }

    private fun isWebUrl(value: String): Boolean {
        val url = value.toHttpUrlOrNull() ?: return false
        // 只校验，不改写配置中的原始二维码文本；同时兼容大小写协议与国际化域名。
        return url.username.isEmpty() && url.password.isEmpty()
    }

    private fun defaults() = AppShareConfig(
        appName = "Pisa Music",
        version = BuildConfig.VERSION_NAME,
        description = context.getString(R.string.app_share_default_description),
        qrCodeText = "https://pisamusic.partialy.cn/download/",
        copyText = context.getString(R.string.app_share_default_copy),
    )
}
