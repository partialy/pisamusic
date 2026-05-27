package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ActivitySplashBinding
import cn.partialy.pm.model.DeviceReportResult
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.util.DeviceInfoCollector
import cn.partialy.pm.utils.AppUpdateInstaller
import cn.partialy.pm.utils.ServerDevicePrefs
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

/**
 * 启动页：全屏 WebView，状态栏隐藏。实际网页 URL 见 [SPLASH_WEB_URL]。
 */
@SuppressLint("CustomSplashScreen")
@AndroidEntryPoint
class SplashActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySplashBinding
    private var hasNavigated = false
    private var bootstrapRequested = false
    private var latestDownloadUrl: String = ""
    private var latestOfficialUrl: String = ""
    private var pendingAgreementAccepted = false
    private lateinit var appUpdateInstaller: AppUpdateInstaller

    @Inject
    lateinit var configManager: ConfigManager

    private class DeviceLockedException(val report: DeviceReportResult) : RuntimeException()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideStatusBar()

        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)
        appUpdateInstaller = AppUpdateInstaller(
            activity = this,
            callbacks = object : AppUpdateInstaller.Callbacks {
                override fun onDownloadProgress(downloading: Boolean, progress: Int, text: String) {
                    notifySplashDownloadState(downloading, progress, text)
                }

                override fun onError(message: String) {
                    showErrorSheet(message)
                }

                override fun onMessage(message: String) {
                    Toast.makeText(this@SplashActivity, message, Toast.LENGTH_SHORT).show()
                }
            },
        )

        setupWebView(binding.splashWebView)
        binding.splashWebView.loadUrl(SPLASH_WEB_URL)
        binding.splashWebView.addJavascriptInterface(SplashJsBridge(), "AndroidSplash")

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val wv = binding.splashWebView
                    if (wv.canGoBack()) wv.goBack()
                    else finish()
                }
            }
        )
    }

    override fun onResume() {
        super.onResume()
        if (::appUpdateInstaller.isInitialized) {
            appUpdateInstaller.retryPendingInstall()
        }
    }

    override fun onDestroy() {
        if (::appUpdateInstaller.isInitialized) {
            appUpdateInstaller.destroy()
        }
        binding.splashWebView.removeJavascriptInterface("AndroidSplash")
        super.onDestroy()
    }

    private fun hideStatusBar() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.statusBars())
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(webView: WebView) {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
        }
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (bootstrapRequested) return
                bootstrapRequested = true
                tryBootstrapAndUpdate()
            }
        }
    }

    private fun tryBootstrapAndUpdate() {
        lifecycleScope.launch {
            if (!isAgreementAccepted()) {
                runCatching {
                    withContext(Dispatchers.IO) { configManager.getAgreementInfo() }
                }.onSuccess { agreement ->
                    showAgreementSheet(agreement.title, agreement.content)
                }.onFailure {
                    showAgreementSheet(FALLBACK_AGREEMENT_TITLE, FALLBACK_AGREEMENT_CONTENT)
                }
                return@launch
            }

            runCatching {
                withContext(Dispatchers.IO) {
                    configManager.refreshBootstrapConfig()
                    val body = DeviceInfoCollector.build(this@SplashActivity)
                    val deviceReport = configManager.reportDevice(body)
                    saveServerDeviceUuid(deviceReport.id)
                    if (deviceReport.isCurrentlyLocked()) {
                        throw DeviceLockedException(deviceReport)
                    }
                    refreshAccountSessionIfNeeded()
                    configManager.getUpdateInfo()
                }
            }.onSuccess { updateInfo ->
                val localVersion = packageManager.getPackageInfo(packageName, 0).versionName ?: ""
                if (isVersionChanged(localVersion, updateInfo.latestVersion)) {
                    latestDownloadUrl = updateInfo.downloadUrl
                    latestOfficialUrl = updateInfo.officialUrl
                    showUpdateSheet(
                        latestVersion = updateInfo.latestVersion,
                        updateTime = updateInfo.updateTime,
                        updateContent = updateInfo.updateContent,
                        forceUpdate = updateInfo.forceUpdate,
                    )
                    return@onSuccess
                }
                if (hasNavigated) return@onSuccess
                navigateToMainDelayed()
            }.onFailure {
                when {
                    it is DeviceLockedException -> {
                        showUnavailableErrorSheet(it.report.lockedMessage())
                    }
                    else -> {
                        navigateToMainDelayed(it.message ?: getString(R.string.splash_server_connection_failed))
                    }
                }
            }
        }
    }

    private fun saveServerDeviceUuid(id: String) {
        ServerDevicePrefs.setDeviceId(this, id)
    }

    private suspend fun refreshAccountSessionIfNeeded() {
        val session = AccountSessionStore.read(this)
        if (!session.loggedIn) return
        runCatching {
            configManager.refreshAccountToken(session.token)
        }.onSuccess {
            AccountSessionStore.save(this, it)
        }.onFailure {
            AccountSessionStore.clear(this)
        }
    }

    private fun DeviceReportResult.isCurrentlyLocked(nowMillis: Long = System.currentTimeMillis()): Boolean {
        if (!locked) return false
        val endTime = lockEndTime ?: return true
        return endTime > nowMillis
    }

    private fun DeviceReportResult.lockedMessage(): String {
        val endTime = lockEndTime ?: return "当前设备已被封禁，App 服务暂不可用"
        val formatted = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(endTime))
        return "当前设备已被封禁，解封时间：$formatted"
    }

    private fun isVersionChanged(localVersion: String, latestVersion: String): Boolean {
        val local = localVersion.trim().removePrefix("v").removePrefix("V")
        val remote = latestVersion.trim().removePrefix("v").removePrefix("V")
        return local.isNotEmpty() && remote.isNotEmpty() && local != remote
    }

    private fun jsSafe(value: String): String =
        value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")

    private fun showNetworkSheet(message: String) {
        val js = "window.splashSheet && window.splashSheet.showNetwork('${jsSafe(message)}');"
        binding.splashWebView.post { binding.splashWebView.evaluateJavascript(js, null) }
    }

    private fun showErrorSheet(message: String) {
        val js = "window.splashSheet && window.splashSheet.showError('${jsSafe(message)}');"
        binding.splashWebView.post { binding.splashWebView.evaluateJavascript(js, null) }
    }

    private fun showUnavailableErrorSheet(message: String) {
        val js = "window.splashSheet && window.splashSheet.showError({'message':'${jsSafe(message)}','unavailable':true});"
        binding.splashWebView.post { binding.splashWebView.evaluateJavascript(js, null) }
    }

    private fun showUpdateSheet(
        latestVersion: String,
        updateTime: String,
        updateContent: String,
        forceUpdate: Boolean,
    ) {
        val js = "window.splashSheet && window.splashSheet.showUpdate({'latestVersion':'${jsSafe(latestVersion)}','updateTime':'${jsSafe(updateTime)}','updateContent':'${jsSafe(updateContent)}','forceUpdate':$forceUpdate});"
        binding.splashWebView.post { binding.splashWebView.evaluateJavascript(js, null) }
    }

    private fun showAgreementSheet(title: String, content: String) {
        val js = "window.splashSheet && window.splashSheet.showAgreement({'title':'${jsSafe(title)}','content':'${jsSafe(content)}'});"
        binding.splashWebView.post { binding.splashWebView.evaluateJavascript(js, null) }
    }

    private fun navigateToMainDelayed(localModeReason: String? = null) {
        if (hasNavigated) return
        hasNavigated = true
        binding.splashWebView.postDelayed({
            if (!isFinishing && !isDestroyed) {
                MainActivity.start(this@SplashActivity, localModeReason)
                finish()
            }
        }, 1000L)
    }

    private fun openOfficialSite() {
        val url = latestOfficialUrl.trim()
        if (url.isEmpty()) {
            showErrorSheet("官网地址为空")
            return
        }
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    private fun openOfficialHome() {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(OFFICIAL_HOME_URL)))
    }

    private fun isAgreementAccepted(): Boolean {
        val sp = getSharedPreferences(SPLASH_PREFS, MODE_PRIVATE)
        return sp.getBoolean(KEY_AGREEMENT_ACCEPTED, false)
    }

    private fun setAgreementAccepted(accepted: Boolean) {
        val sp = getSharedPreferences(SPLASH_PREFS, MODE_PRIVATE)
        sp.edit().putBoolean(KEY_AGREEMENT_ACCEPTED, accepted).apply()
    }

    private fun startAppUpdateDownload() {
        appUpdateInstaller.startDownload(latestDownloadUrl)
    }

    private fun notifySplashDownloadState(downloading: Boolean, progress: Int, text: String) {
        val js = "window.splashSheet && window.splashSheet.setDownloading({downloading:${if (downloading) "true" else "false"},progress:$progress,text:'${jsSafe(text)}'});"
        binding.splashWebView.post { binding.splashWebView.evaluateJavascript(js, null) }
    }

    inner class SplashJsBridge {
        @JavascriptInterface
        fun retryBootstrap() {
            runOnUiThread {
                bootstrapRequested = false
                tryBootstrapAndUpdate()
            }
        }

        @JavascriptInterface
        fun openOfficialSite() {
            runOnUiThread { this@SplashActivity.openOfficialSite() }
        }

        @JavascriptInterface
        fun openOfficialHome() {
            runOnUiThread { this@SplashActivity.openOfficialHome() }
        }

        @JavascriptInterface
        fun startAppUpdate() {
            runOnUiThread { this@SplashActivity.startAppUpdateDownload() }
        }

        @JavascriptInterface
        fun skipUpdate() {
            runOnUiThread {
                lifecycleScope.launch {
                    runCatching {
                        withContext(Dispatchers.IO) { configManager.getUpdateInfo() }
                    }.onSuccess { updateInfo ->
                        val localVersion = packageManager.getPackageInfo(packageName, 0).versionName ?: ""
                        val hasNewVersion = isVersionChanged(localVersion, updateInfo.latestVersion)
                        if (hasNewVersion && updateInfo.forceUpdate) {
                            latestDownloadUrl = updateInfo.downloadUrl
                            latestOfficialUrl = updateInfo.officialUrl
                            showUpdateSheet(
                                latestVersion = updateInfo.latestVersion,
                                updateTime = updateInfo.updateTime,
                                updateContent = updateInfo.updateContent,
                                forceUpdate = true,
                            )
                            return@onSuccess
                        }
                        if (hasNavigated) return@onSuccess
                        hasNavigated = true
                        MainActivity.start(this@SplashActivity)
                        finish()
                    }.onFailure {
                        MainActivity.start(
                            this@SplashActivity,
                            it.message ?: getString(R.string.splash_update_verify_failed),
                        )
                        finish()
                    }
                }
            }
        }

        @JavascriptInterface
        fun acceptAgreement() {
            runOnUiThread {
                if (pendingAgreementAccepted) return@runOnUiThread
                pendingAgreementAccepted = true
                setAgreementAccepted(true)
                bootstrapRequested = false
                pendingAgreementAccepted = false
                tryBootstrapAndUpdate()
            }
        }

        @JavascriptInterface
        fun declineAgreement() {
            runOnUiThread {
                setAgreementAccepted(false)
                finishAffinity()
            }
        }

        @JavascriptInterface
        fun exitApp() {
            runOnUiThread { finishAffinity() }
        }
    }

    companion object {
        const val SPLASH_WEB_URL = "file:///android_asset/splash/index.html"
        private const val OFFICIAL_HOME_URL = "https://pisamusic.partialy.cn"
        private const val SPLASH_PREFS = "splash_prefs"
        private const val KEY_AGREEMENT_ACCEPTED = "agreement_accepted"
        private const val FALLBACK_AGREEMENT_TITLE = "用户协议与隐私提示"
        private const val FALLBACK_AGREEMENT_CONTENT =
            "<p>欢迎使用 PisaMusic。当前服务暂不可用，请先确认你已阅读并同意用户协议与隐私政策。进入本地模式后，在线搜索、公告、更新检查、同步等功能可能暂不可用，本地音乐播放等离线功能仍可继续使用。</p>"
    }
}
