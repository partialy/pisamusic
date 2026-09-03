package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.widget.Toast
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ActivitySplashBinding
import cn.partialy.pm.model.DeviceReportResult
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.sync.SyncOutboxStore
import cn.partialy.pm.sync.SyncPrefs
import cn.partialy.pm.util.DeviceInfoCollector
import cn.partialy.pm.utils.AppUpdateInstaller
import cn.partialy.pm.utils.AppVersionComparator
import cn.partialy.pm.utils.ServerDevicePrefs
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.dialog.SplashActionBottomSheet
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
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
    private var agreementDialogShowing = false
    private var pendingScanLink: String? = null
    private var localModeButtonJob: Job? = null
    private var updateSheetHandle: SplashActionBottomSheet.Handle? = null
    private var networkSheetHandle: SplashActionBottomSheet.Handle? = null
    private lateinit var appUpdateInstaller: AppUpdateInstaller

    @Inject
    lateinit var configManager: ConfigManager

    private class DeviceLockedException(val report: DeviceReportResult) : RuntimeException()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        captureScanLink(intent)
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
                    showErrorDialog(message)
                }

                override fun onMessage(message: String) {
                    Toast.makeText(this@SplashActivity, message, Toast.LENGTH_SHORT).show()
                }
            },
        )

        setupWebView(binding.splashWebView)
        scheduleLocalModeButtonIfNeeded()
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

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        captureScanLink(intent)
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
        updateSheetHandle?.dismiss()
        updateSheetHandle = null
        networkSheetHandle?.dismiss()
        networkSheetHandle = null
        localModeButtonJob?.cancel()
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
            if (hasNavigated) return@launch
            val agreement = runCatching {
                withContext(Dispatchers.IO) {
                    configManager.refreshServiceDiscovery()
                    configManager.getAgreementInfo()
                }
            }
            if (agreement.isSuccess) {
                val currentAgreement = agreement.getOrThrow()
                if (!isAgreementAccepted(currentAgreement.version)) {
                    cancelLocalModeButton()
                    showAgreementDialog(currentAgreement.title, currentAgreement.content, currentAgreement.version)
                    return@launch
                }
            } else if (!isAgreementAccepted()) {
                cancelLocalModeButton()
                showAgreementDialog(
                    getString(R.string.startup_fallback_agreement_title),
                    getString(R.string.startup_fallback_agreement_text),
                    DEFAULT_AGREEMENT_VERSION,
                )
                return@launch
            }

            configManager.beginOnlineStartup()
            scheduleLocalModeButtonIfNeeded()
            runCatching {
                withTimeout(SPLASH_BOOTSTRAP_TIMEOUT_MS) {
                    withContext(Dispatchers.IO) {
                        configManager.refreshBootstrapConfig()
                        val body = DeviceInfoCollector.build(this@SplashActivity)
                        val deviceReport = configManager.reportDevice(body)
                        saveServerDeviceIdentity(deviceReport.id, deviceReport.messageToken)
                        if (deviceReport.isCurrentlyLocked()) {
                            throw DeviceLockedException(deviceReport)
                        }
                        refreshAccountSessionIfNeeded()
                        configManager.getUpdateInfo()
                    }
                }
            }.onSuccess { updateInfo ->
                if (hasNavigated) return@onSuccess
                val localVersion = packageManager.getPackageInfo(packageName, 0).versionName ?: ""
                val shouldPromptUpdate = !BuildConfig.DEBUG && AppVersionComparator.isServerVersionNewer(localVersion, updateInfo.latestVersion)
                if (shouldPromptUpdate) {
                    cancelLocalModeButton()
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
                cancelLocalModeButton()
                navigateToMainDelayed()
            }.onFailure {
                if (hasNavigated) return@onFailure
                when {
                    it is DeviceLockedException -> {
                        cancelLocalModeButton()
                        showUnavailableErrorDialog(it.report.lockedMessage())
                    }
                    it is TimeoutCancellationException -> {
                        enterLocalModeImmediately(getString(R.string.splash_server_connection_failed))
                    }
                    else -> {
                        navigateToMainDelayed(it.message ?: getString(R.string.splash_server_connection_failed))
                    }
                }
            }
        }
    }

    private fun saveServerDeviceIdentity(id: String, messageToken: String) {
        ServerDevicePrefs.saveReportIdentity(this, id, messageToken)
    }

    private fun scheduleLocalModeButtonIfNeeded() {
        if (!isAgreementAccepted() || hasNavigated) return
        if (localModeButtonJob?.isActive == true) return
        localModeButtonJob = lifecycleScope.launch {
            delay(LOCAL_MODE_BUTTON_DELAY_MS)
            if (!hasNavigated && !isFinishing && !isDestroyed && isAgreementAccepted()) {
                showLocalModeInWebView(true)
            }
        }
    }

    private fun cancelLocalModeButton() {
        localModeButtonJob?.cancel()
        localModeButtonJob = null
        showLocalModeInWebView(false)
    }

    private fun showLocalModeInWebView(show: Boolean) {
        val js = "window.showLocalMode && window.showLocalMode($show);"
        binding.splashWebView.post { binding.splashWebView.evaluateJavascript(js, null) }
    }

    private fun enterLocalModeImmediately(localModeReason: String) {
        if (hasNavigated) return
        hasNavigated = true
        cancelLocalModeButton()
        if (!isFinishing && !isDestroyed) {
            startMainActivity(localModeReason)
            finish()
        }
    }

    private suspend fun refreshAccountSessionIfNeeded() {
        val session = AccountSessionStore.read(this)
        if (!session.loggedIn) return
        runCatching {
            configManager.refreshAccountToken(session.token)
        }.onSuccess { refreshed ->
            if (refreshed.user.id != session.user.id) {
                SyncOutboxStore(this).clearAll()
                SyncPrefs.clearAccountState(this)
            }
            AccountSessionStore.save(this, refreshed)
        }.onFailure { error ->
            if (error.isAccountAuthExpired()) {
                SyncOutboxStore(this).clearAll()
                SyncPrefs.clearAccountState(this)
                AccountSessionStore.clear(this)
            }
        }
    }

    private fun Throwable.isAccountAuthExpired(): Boolean {
        val apiError = this as? ConfigManager.ApiException ?: return false
        return apiError.httpStatus == 401 || apiError.code == 401
    }

    private fun DeviceReportResult.isCurrentlyLocked(nowMillis: Long = System.currentTimeMillis()): Boolean {
        if (!locked) return false
        val endTime = lockEndTime ?: return true
        return endTime > nowMillis
    }

    private fun DeviceReportResult.lockedMessage(): String {
        val endTime = lockEndTime ?: return getString(R.string.startup_device_banned)
        val formatted = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(endTime))
        return getString(R.string.startup_device_banned_until, formatted)
    }

    private fun jsSafe(value: String): String =
        value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")

    private fun showErrorDialog(message: String) {
        if (isFinishing || isDestroyed) return
        PmMinimalDialog.show(
            context = this,
            title = getString(R.string.startup_error_title),
            message = message,
            confirmText = getString(R.string.dialog_ok),
            singleButton = true,
            cancelable = false,
            onConfirm = { finishAffinity() },
        )
    }

    private fun showUnavailableErrorDialog(message: String) {
        if (isFinishing || isDestroyed) return
        PmMinimalDialog.show(
            context = this,
            title = getString(R.string.startup_unavailable_title),
            message = message,
            confirmText = getString(R.string.startup_exit_app),
            confirmColor = ContextCompat.getColor(this, R.color.pm_dialog_danger),
            singleButton = true,
            cancelable = false,
            onConfirm = { finishAffinity() },
        )
    }

    private fun showUpdateSheet(
        latestVersion: String,
        updateTime: String,
        updateContent: String,
        forceUpdate: Boolean,
    ) {
        if (isFinishing || isDestroyed) return
        updateSheetHandle?.dismiss()
        updateSheetHandle = SplashActionBottomSheet.showUpdate(
            activity = this,
            latestVersion = latestVersion,
            updateTime = updateTime,
            updateContent = updateContent,
            forceUpdate = forceUpdate,
            onUpdateClick = {
                startAppUpdateDownload()
            },
            onOfficialClick = {
                openOfficialSite()
            },
            onSkipClick = {
                handleSkipUpdate()
            },
        )
    }

    private fun showAgreementDialog(title: String, content: String, version: Long) {
        if (agreementDialogShowing || isFinishing || isDestroyed) return
        agreementDialogShowing = true
        PmMinimalDialog.show(
            context = this,
            title = title,
            message = content,
            cancelText = getString(R.string.startup_agreement_exit),
            confirmText = getString(R.string.startup_agreement_accept),
            cancelColor = ContextCompat.getColor(this, R.color.pm_dialog_danger),
            confirmColor = ContextCompat.getColor(this, R.color.pm_dialog_confirm),
            widthDp = 340,
            messageGravity = Gravity.START,
            messageSelectable = true,
            messageMaxHeightDp = 420,
            cancelable = false,
            onCancel = { finishAffinity() },
            onConfirm = {
                agreementDialogShowing = false
                setAgreementAccepted(true, version)
                bootstrapRequested = false
                tryBootstrapAndUpdate()
            },
        )
    }

    private fun navigateToMainDelayed(localModeReason: String? = null) {
        if (hasNavigated) return
        hasNavigated = true
        cancelLocalModeButton()
        binding.splashWebView.postDelayed({
            if (!isFinishing && !isDestroyed) {
                startMainActivity(localModeReason)
                finish()
            }
        }, 1000L)
    }

    private fun captureScanLink(intent: Intent?) {
        intent?.dataString?.trim()?.takeIf { it.isNotEmpty() }?.let { pendingScanLink = it }
    }

    private fun startMainActivity(localModeReason: String? = null) {
        if (!localModeReason.isNullOrBlank()) {
            configManager.enterLocalMode()
        }
        MainActivity.start(
            context = this,
            localModeReason = localModeReason,
            scanLink = pendingScanLink,
        )
        pendingScanLink = null
    }

    private fun openOfficialSite() {
        val url = latestOfficialUrl.trim()
        if (url.isEmpty()) {
            showErrorDialog(getString(R.string.startup_official_url_empty))
            return
        }
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    }

    private fun isAgreementAccepted(version: Long? = null): Boolean {
        val sp = getSharedPreferences(SPLASH_PREFS, MODE_PRIVATE)
        if (!sp.getBoolean(KEY_AGREEMENT_ACCEPTED, false)) return false
        return version == null || sp.getLong(KEY_AGREEMENT_VERSION, Long.MIN_VALUE) == version
    }

    private fun setAgreementAccepted(accepted: Boolean, version: Long = DEFAULT_AGREEMENT_VERSION) {
        val sp = getSharedPreferences(SPLASH_PREFS, MODE_PRIVATE)
        sp.edit().apply {
            putBoolean(KEY_AGREEMENT_ACCEPTED, accepted)
            if (accepted) putLong(KEY_AGREEMENT_VERSION, version)
            else remove(KEY_AGREEMENT_VERSION)
        }.apply()
    }

    private fun startAppUpdateDownload() {
        appUpdateInstaller.startDownload(latestDownloadUrl)
    }

    private fun notifySplashDownloadState(downloading: Boolean, progress: Int, text: String) {
        runOnUiThread {
            updateSheetHandle?.updateDownloadProgress(downloading, progress, text)
        }
        val js = "window.splashSheet && window.splashSheet.setDownloading({downloading:${if (downloading) "true" else "false"},progress:$progress,text:'${jsSafe(text)}'});"
        binding.splashWebView.post { binding.splashWebView.evaluateJavascript(js, null) }
    }

    private fun handleSkipUpdate() {
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { configManager.getUpdateInfo() }
            }.onSuccess { updateInfo ->
                val localVersion = packageManager.getPackageInfo(packageName, 0).versionName ?: ""
                val hasNewVersion = !BuildConfig.DEBUG && AppVersionComparator.isServerVersionNewer(localVersion, updateInfo.latestVersion)
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
                updateSheetHandle?.dismiss()
                updateSheetHandle = null
                if (hasNavigated) return@onSuccess
                hasNavigated = true
                startMainActivity()
                finish()
            }.onFailure {
                updateSheetHandle?.dismiss()
                updateSheetHandle = null
                if (hasNavigated) return@onFailure
                hasNavigated = true
                startMainActivity(it.message ?: getString(R.string.splash_update_verify_failed))
                finish()
            }
        }
    }

    private fun openOfficialHome() {
        val url = latestOfficialUrl.trim().ifEmpty { "https://pisamusic.partialy.cn" }
        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }

    private fun showNetworkSheet(message: String? = null) {
        if (isFinishing || isDestroyed) return
        networkSheetHandle?.dismiss()
        networkSheetHandle = SplashActionBottomSheet.showNetwork(
            activity = this,
            message = message,
            onRetryClick = { handle ->
                handle.dismiss()
                networkSheetHandle = null
                bootstrapRequested = false
                tryBootstrapAndUpdate()
            },
            onOfficialClick = {
                openOfficialHome()
            },
            onSettingsClick = {
                runCatching {
                    startActivity(Intent(android.provider.Settings.ACTION_WIRELESS_SETTINGS))
                }.onFailure {
                    runCatching {
                        startActivity(Intent(android.provider.Settings.ACTION_SETTINGS))
                    }
                }
            },
        )
    }

    inner class SplashJsBridge {
        @JavascriptInterface
        fun openOfficialSite() {
            runOnUiThread { this@SplashActivity.openOfficialSite() }
        }

        @JavascriptInterface
        fun startAppUpdate() {
            runOnUiThread { this@SplashActivity.startAppUpdateDownload() }
        }

        @JavascriptInterface
        fun skipUpdate() {
            runOnUiThread { handleSkipUpdate() }
        }

        @JavascriptInterface
        fun enterLocalMode() {
            runOnUiThread {
                enterLocalModeImmediately(getString(R.string.splash_local_mode_manual_reason))
            }
        }
    }

    companion object {
        const val SPLASH_WEB_URL = "file:///android_asset/splash/index.html"
        private const val SPLASH_PREFS = "splash_prefs"
        private const val KEY_AGREEMENT_ACCEPTED = "agreement_accepted"
        private const val KEY_AGREEMENT_VERSION = "agreement_version"
        private const val DEFAULT_AGREEMENT_VERSION = 1L
        private const val LOCAL_MODE_BUTTON_DELAY_MS = 3_000L
        private const val SPLASH_BOOTSTRAP_TIMEOUT_MS = 10_000L
    }
}
