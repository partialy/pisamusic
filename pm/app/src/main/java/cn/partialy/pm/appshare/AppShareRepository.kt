package cn.partialy.pm.appshare

import android.content.Context
import android.content.SharedPreferences
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.R
import cn.partialy.pm.network.api.SystemApiService
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.util.DeviceInfoCollector
import cn.partialy.pm.utils.ServerDevicePrefs
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import retrofit2.HttpException
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppShareRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: SystemApiService,
    private val configManager: ConfigManager,
) {
    data class Identity(val deviceId: String, val userId: String) {
        val cacheKey: String get() = MessageDigest.getInstance("SHA-256")
            .digest("$deviceId|$userId".toByteArray()).joinToString("") { "%02x".format(it) }
    }

    private val preferences = context.getSharedPreferences("app_share", Context.MODE_PRIVATE)
    private val gson = Gson()
    private val refreshMutex = Mutex()

    fun identity() = Identity(
        ServerDevicePrefs.getDeviceId(context),
        AccountSessionStore.read(context).user.id,
    )

    /** 同一身份的凭证续期不重启自己的刷新任务；账号或设备变更立即取消旧任务。 */
    fun observeIdentity(onChanged: () -> Unit): AutoCloseable {
        var previous = identity()
        val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
            val current = identity()
            if (current != previous) {
                previous = current
                onChanged()
            }
        }
        val stores = listOf("pm_account_session", "splash_prefs").map {
            context.getSharedPreferences(it, Context.MODE_PRIVATE)
        }
        stores.forEach { it.registerOnSharedPreferenceChangeListener(listener) }
        return AutoCloseable { stores.forEach { it.unregisterOnSharedPreferenceChangeListener(listener) } }
    }

    fun cached(identity: Identity): AppShareConfig? = runCatching {
        if (identity.deviceId.isBlank()) return@runCatching null
        val json = preferences.getString("identity_${identity.cacheKey}", null) ?: return@runCatching null
        normalize(gson.fromJson(json, AppShareConfig::class.java)).also { requireTracked(it) }
    }.getOrNull()

    fun displayConfig(): AppShareConfig = runCatching {
        val json = preferences.getString("display", null) ?: return@runCatching defaults()
        normalize(gson.fromJson(json, AppShareConfig::class.java))
    }.getOrElse { defaults() }

    fun clearCached(identity: Identity) {
        preferences.edit().remove("identity_${identity.cacheKey}").apply()
    }

    suspend fun refresh(expected: Identity): Pair<Identity, AppShareConfig> = refreshMutex.withLock {
        withContext(Dispatchers.IO) {
            checkIdentity(expected)
            if (ServerDevicePrefs.getMessageToken(context).isBlank() || expected.deviceId.isBlank()) {
                refreshDevice(expected)
            }
            var current = identity()
            check(current.userId == expected.userId) { "分享身份已变更，请重试" }
            val session = AccountSessionStore.read(context)
            check(session.user.id.isBlank() || session.loggedIn) { "登录已失效，请重新登录" }
            if (session.loggedIn && session.expiresAt <= System.currentTimeMillis() + 60_000) {
                refreshAccount(current)
            }
            checkIdentity(current)
            val response = try {
                request(current)
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                val unauthorized = (error is HttpException && error.code() == 401) ||
                    (error is ConfigManager.ApiException && error.code == 401)
                if (!unauthorized) throw error
                // 任一凭证失效只重试一次，始终保留账号，不自动降级为游客。
                refreshDevice(current)
                current = identity()
                check(current.userId == expected.userId) { "分享身份已变更，请重试" }
                if (current.userId.isNotBlank()) refreshAccount(current)
                request(current)
            }
            checkIdentity(current)
            if (!response.success || response.code != 0) {
                preferences.edit().remove("identity_${current.cacheKey}").apply()
                error(response.msg.ifBlank { "获取专属链接失败" })
            }
            val config = normalize(requireNotNull(response.data))
            requireTracked(config)
            checkIdentity(current)
            preferences.edit()
                .putString("identity_${current.cacheKey}", gson.toJson(config))
                .putString("display", gson.toJson(config.copy(shareCode = null, trackingEnabled = false,
                    qrCodeText = defaults().qrCodeText, copyText = defaults().copyText)))
                .apply()
            current to config
        }
    }

    private suspend fun request(expected: Identity): AppShareResponse {
        checkIdentity(expected)
        val session = AccountSessionStore.read(context)
        check(session.user.id == expected.userId) { "分享身份已变更，请重试" }
        check(session.user.id.isBlank() || session.loggedIn) { "登录已失效，请重新登录" }
        val result = api.getAppShare(ServerDevicePrefs.getMessageToken(context),
            session.token.takeIf { expected.userId.isNotBlank() }?.let { "Bearer $it" })
        if (result.code == 401) throw ConfigManager.ApiException(401, result.msg)
        return result
    }

    private suspend fun refreshDevice(expected: Identity) {
        val report = configManager.reportDevice(DeviceInfoCollector.build(context))
        checkIdentity(expected)
        check(!report.locked) { "当前设备不可用" }
        require(report.id.isNotBlank() && report.messageToken.isNotBlank())
        ServerDevicePrefs.saveReportIdentity(context, report.id, report.messageToken)
    }

    private suspend fun refreshAccount(expected: Identity) {
        checkIdentity(expected)
        val session = AccountSessionStore.read(context)
        check(session.user.id == expected.userId) { "分享身份已变更，请重试" }
        check(session.loggedIn) { "登录已失效，请重新登录" }
        val refreshed = configManager.refreshAccountToken(session.token)
        checkIdentity(expected)
        check(refreshed.user.id == expected.userId) { "账号已变更，请重新获取链接" }
        check(AccountSessionStore.read(context).token == session.token) { "登录状态已更新，请重试" }
        AccountSessionStore.save(context, refreshed)
    }

    private fun checkIdentity(expected: Identity) {
        check(identity() == expected) { "分享身份已变更，请重试" }
    }

    private fun requireTracked(config: AppShareConfig) {
        require(config.trackingEnabled && config.shareCode?.matches(Regex("[A-Za-z0-9]{6}")) == true)
        val url = requireNotNull(config.qrCodeText.toHttpUrlOrNull())
        require(url.queryParameterValues("code") == listOf(config.shareCode))
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
        return url.username.isEmpty() && url.password.isEmpty()
    }

    private fun defaults() = AppShareConfig(
        appName = "Pisa Music",
        version = BuildConfig.VERSION_NAME,
        description = context.getString(R.string.app_share_default_description),
        qrCodeText = "https://pisamusic.partialy.cn/app-share/",
        copyText = context.getString(R.string.app_share_default_copy),
    )
}
