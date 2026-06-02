package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityAccountAssistBinding
import cn.partialy.pm.model.AccountAuthResult
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.sync.SyncManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import javax.inject.Inject

@AndroidEntryPoint
class AccountAssistActivity : BaseActivity() {
    private lateinit var binding: ActivityAccountAssistBinding
    private var statusBarInsets: Insets = Insets.NONE
    private var navigationBarInsets: Insets = Insets.NONE
    private val mode: String
        get() = intent.getStringExtra(EXTRA_MODE)?.takeIf { it == MODE_RESET } ?: MODE_REGISTER

    @Inject
    lateinit var configManager: ConfigManager

    @Inject
    lateinit var syncManager: SyncManager

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityAccountAssistBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !isNight
            isAppearanceLightNavigationBars = !isNight
        }

        setupWebView(binding.accountAssistWebView)
        applySystemBarInsets(binding.accountAssistWebView)
        binding.accountAssistWebView.addJavascriptInterface(AccountAssistBridge(), JS_INTERFACE_NAME)
        binding.accountAssistWebView.loadUrl(ASSIST_WEB_URL)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() = navigateBackOrFinish()
            },
        )
    }

    override fun onDestroy() {
        if (::binding.isInitialized) {
            binding.accountAssistWebView.removeJavascriptInterface(JS_INTERFACE_NAME)
            binding.accountAssistWebView.destroy()
        }
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(webView: WebView) {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
        }
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                applySystemBarStyles(view)
            }
        }
        webView.webChromeClient = WebChromeClient()
    }

    private fun applySystemBarInsets(webView: WebView) {
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
            statusBarInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            navigationBarInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            applySystemBarStyles(webView)
            insets
        }
        webView.post { ViewCompat.requestApplyInsets(webView) }
    }

    private fun applySystemBarStyles(webView: WebView) {
        val density = resources.displayMetrics.density
        val statusBarPhysicalPx = statusBarHeightPhysicalPx(this).takeIf { it > 0 } ?: statusBarInsets.top
        val statusBarCssPx = if (statusBarPhysicalPx > 0) (statusBarPhysicalPx / density + 0.5f).toInt() else 24
        val navigationBarPhysicalPx = navigationBarInsets.bottom
        val navigationBarCssPx = if (navigationBarPhysicalPx > 0) (navigationBarPhysicalPx / density + 0.5f).toInt() else 0
        val js = """
            (function() {
                var statusBar = document.getElementById('android-status-bar');
                if (statusBar) {
                    statusBar.style.setProperty('height', '${statusBarCssPx}px', 'important');
                }
            })();
            document.documentElement.style.setProperty('--native-navigation-bar-height', '${navigationBarCssPx}px');
        """.trimIndent()
        webView.evaluateJavascript(js, null)
    }

    private fun statusBarHeightPhysicalPx(context: Context): Int {
        val resId = context.resources.getIdentifier("status_bar_height", "dimen", "android")
        return if (resId > 0) context.resources.getDimensionPixelSize(resId) else 0
    }

    private fun navigateBackOrFinish() {
        val webView = binding.accountAssistWebView
        if (webView.canGoBack()) webView.goBack() else finish()
    }

    private fun notifySuccess(message: String) {
        binding.accountAssistWebView.post {
            binding.accountAssistWebView.evaluateJavascript(
                "window.assistPage && window.assistPage.success(${JSONObject.quote(message)})",
                null,
            )
        }
    }

    private fun notifyError(message: String) {
        binding.accountAssistWebView.post {
            binding.accountAssistWebView.evaluateJavascript(
                "window.assistPage && window.assistPage.error(${JSONObject.quote(message)})",
                null,
            )
        }
    }

    private fun notifyEmailCodeSent() {
        binding.accountAssistWebView.post {
            binding.accountAssistWebView.evaluateJavascript(
                "window.assistPage && window.assistPage.emailCodeSent()",
                null,
            )
        }
    }

    private fun notifyRegistered(result: AccountAuthResult) {
        val previousUserId = AccountSessionStore.read(this).user.id
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                if (previousUserId.isNotBlank() && previousUserId != result.user.id) {
                    syncManager.clearLocalSyncState()
                }
                AccountSessionStore.save(this@AccountAssistActivity, result)
                syncManager.startAccountSync()
            }
            binding.accountAssistWebView.post {
                binding.accountAssistWebView.evaluateJavascript("window.assistPage && window.assistPage.registered()", null)
            }
        }
    }

    inner class AccountAssistBridge {
        @JavascriptInterface
        fun close() {
            runOnUiThread { finish() }
        }

        @JavascriptInterface
        fun getMode(): String = mode

        @JavascriptInterface
        fun sendEmailCode(raw: String) {
            lifecycleScope.launch {
                runCatching {
                    val json = JSONObject(raw)
                    val email = json.optString("email")
                    val purpose = if (mode == MODE_RESET) "reset_password" else "register"
                    withContext(Dispatchers.IO) { configManager.sendAccountEmailCode(email, purpose) }
                }.onSuccess {
                    notifyEmailCodeSent()
                    notifySuccess("验证码已发送")
                }.onFailure {
                    notifyError(it.message ?: "验证码发送失败")
                }
            }
        }

        @JavascriptInterface
        fun registerAccount(raw: String) {
            lifecycleScope.launch {
                runCatching {
                    val json = JSONObject(raw)
                    withContext(Dispatchers.IO) {
                        configManager.registerAccount(
                            email = json.optString("email"),
                            username = json.optString("username"),
                            password = json.optString("password"),
                            code = json.optString("code"),
                        )
                    }
                }.onSuccess(::notifyRegistered)
                    .onFailure { notifyError(it.message ?: "注册失败") }
            }
        }

        @JavascriptInterface
        fun resetPassword(raw: String) {
            lifecycleScope.launch {
                runCatching {
                    val json = JSONObject(raw)
                    withContext(Dispatchers.IO) {
                        configManager.resetAccountPassword(
                            email = json.optString("email"),
                            code = json.optString("code"),
                            password = json.optString("password"),
                        )
                    }
                }.onSuccess {
                    binding.accountAssistWebView.post {
                        binding.accountAssistWebView.evaluateJavascript("window.assistPage && window.assistPage.resetDone()", null)
                    }
                }.onFailure {
                    notifyError(it.message ?: "密码重置失败")
                }
            }
        }
    }

    companion object {
        const val MODE_REGISTER = "register"
        const val MODE_RESET = "reset"
        private const val EXTRA_MODE = "cn.partialy.pm.extra.ACCOUNT_ASSIST_MODE"
        private const val ASSIST_WEB_URL = "file:///android_asset/account-assist/index.html"
        private const val JS_INTERFACE_NAME = "AndroidAccountAssist"

        fun start(context: Context, mode: String) {
            context.startActivity(
                Intent(context, AccountAssistActivity::class.java)
                    .putExtra(EXTRA_MODE, if (mode == MODE_RESET) MODE_RESET else MODE_REGISTER),
            )
            AppActivityTransitions.applyForward(context)
        }
    }
}
