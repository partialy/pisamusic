package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
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
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.home.MainStartupCoordinator.Companion.isServiceUnavailable
import cn.partialy.pm.utils.loveUtil.LoveManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import javax.inject.Inject

/**
 * 启动页：全屏 WebView，状态栏隐藏。
 * 仅拉取必须的 Bootstrap 配置（含唯一 1 次服务发现），完成后立即进入主页；
 * 协议校验、设备上报、升级弹窗及账号刷新统一交由 [MainActivity] 处理。
 */
@SuppressLint("CustomSplashScreen")
@AndroidEntryPoint
class SplashActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySplashBinding
    private var hasNavigated = false
    private var bootstrapRequested = false
    private var pendingScanLink: String? = null
    private var localModeButtonJob: Job? = null
    private var localModeButtonVisible = false
    private var openingMain = false

    @Inject
    lateinit var configManager: ConfigManager

    @Inject
    lateinit var loveManager: LoveManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        captureScanLink(intent)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideStatusBar()

        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        setupWebView(binding.splashWebView)
        binding.splashWebView.addJavascriptInterface(SplashJsBridge(), "AndroidSplash")
        binding.splashWebView.loadUrl(SPLASH_WEB_URL)

        // 与 WebView 渲染并行立即发起 Bootstrap 配置拉取，不再阻塞等待 onPageFinished
        tryBootstrap()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    val wv = binding.splashWebView
                    if (wv.canGoBack()) wv.goBack()
                    else finish()
                }
            },
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        captureScanLink(intent)
    }

    override fun onDestroy() {
        localModeButtonJob?.cancel()
        if (::binding.isInitialized) {
            binding.splashWebView.removeJavascriptInterface("AndroidSplash")
        }
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
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (localModeButtonVisible && !hasNavigated) {
                    showLocalModeInWebView(true)
                }
            }
        }
    }

    private fun tryBootstrap() {
        if (bootstrapRequested || hasNavigated) return
        bootstrapRequested = true

        lifecycleScope.launch {
            if (hasNavigated) return@launch
            configManager.beginOnlineStartup()
            scheduleLocalModeButtonIfNeeded()

            runCatching {
                withTimeout(SPLASH_BOOTSTRAP_TIMEOUT_MS) {
                    withContext(Dispatchers.IO) {
                        configManager.refreshBootstrapConfig()
                    }
                }
            }.onSuccess {
                if (hasNavigated) return@onSuccess
                hasNavigated = true
                cancelLocalModeButton()
                startMainActivity()
            }.onFailure { error ->
                if (hasNavigated) return@onFailure
                when {
                    error.isServiceUnavailable() -> {
                        hasNavigated = true
                        cancelLocalModeButton()
                        val apiError = error as? ConfigManager.ApiException
                        ServiceInterceptActivity.startForServiceUnavailable(
                            activity = this@SplashActivity,
                            message = error.message ?: getString(R.string.startup_unavailable_title),
                            code = apiError?.code ?: -233,
                        )
                    }

                    error is TimeoutCancellationException -> {
                        enterLocalModeImmediately(getString(R.string.splash_server_connection_failed))
                    }

                    else -> {
                        enterLocalModeImmediately(
                            error.message ?: getString(R.string.splash_server_connection_failed),
                        )
                    }
                }
            }
        }
    }

    private fun scheduleLocalModeButtonIfNeeded() {
        if (hasNavigated) return
        if (localModeButtonJob?.isActive == true) return
        localModeButtonJob = lifecycleScope.launch {
            delay(LOCAL_MODE_BUTTON_DELAY_MS)
            if (!hasNavigated && !isFinishing && !isDestroyed) {
                localModeButtonVisible = true
                showLocalModeInWebView(true)
            }
        }
    }

    private fun cancelLocalModeButton() {
        localModeButtonJob?.cancel()
        localModeButtonJob = null
        localModeButtonVisible = false
        showLocalModeInWebView(false)
    }

    private fun showLocalModeInWebView(show: Boolean) {
        if (!::binding.isInitialized) return
        val js = "window.showLocalMode && window.showLocalMode($show);"
        binding.splashWebView.post { binding.splashWebView.evaluateJavascript(js, null) }
    }

    private fun enterLocalModeImmediately(localModeReason: String) {
        if (hasNavigated) return
        hasNavigated = true
        cancelLocalModeButton()
        if (!isFinishing && !isDestroyed) {
            startMainActivity(localModeReason)
        }
    }

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

    private fun captureScanLink(intent: Intent?) {
        intent?.dataString?.trim()?.takeIf { it.isNotEmpty() }?.let { pendingScanLink = it }
    }

    private fun startMainActivity(localModeReason: String? = null) {
        if (openingMain) return
        openingMain = true
        lifecycleScope.launch {
            try {
                loveManager.awaitPreloaded()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                openingMain = false
                hasNavigated = false
                showErrorDialog(e.message ?: "收藏数据读取失败")
                return@launch
            }
            if (!localModeReason.isNullOrBlank()) {
                configManager.enterLocalMode()
            }
            MainActivity.start(
                context = this@SplashActivity,
                localModeReason = localModeReason,
                scanLink = pendingScanLink,
            )
            pendingScanLink = null
            finish()
        }
    }

    inner class SplashJsBridge {
        @JavascriptInterface
        fun enterLocalMode() {
            runOnUiThread {
                enterLocalModeImmediately(getString(R.string.splash_local_mode_manual_reason))
            }
        }
    }

    companion object {
        const val SPLASH_WEB_URL = "file:///android_asset/splash/index.html"
        private const val LOCAL_MODE_BUTTON_DELAY_MS = 3_000L
        private const val SPLASH_BOOTSTRAP_TIMEOUT_MS = 10_000L
    }
}
