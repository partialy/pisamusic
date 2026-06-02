package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.util.Log
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
import cn.partialy.pm.BuildConfig
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
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
        }
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                applyInsetCssVariables(view)
            }
        }
        webView.webChromeClient = WebChromeClient()
    }

    private fun applySystemBarInsets(webView: WebView) {
        ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
            statusBarInsets = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            navigationBarInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            applyInsetCssVariables(webView)
            insets
        }
        webView.post { ViewCompat.requestApplyInsets(webView) }
    }

    private fun applyInsetCssVariables(webView: WebView) {
        val statusBarHeight = statusBarInsets.top
        val navigationBarHeight = navigationBarInsets.bottom
        Log.d(
            LOG_TAG,
            "${javaClass.simpleName} --native-status-bar-height=${statusBarHeight}px, " +
                "--native-navigation-bar-height=${navigationBarHeight}px",
        )
        val js = """
            document.documentElement.style.setProperty('--native-status-bar-height', '${statusBarHeight}px');
            document.documentElement.style.setProperty('--native-navigation-bar-height', '${navigationBarHeight}px');
            console.log('[AccountInsets] ${javaClass.simpleName} --native-status-bar-height=${statusBarHeight}px, --native-navigation-bar-height=${navigationBarHeight}px');
            (function() {
                const rect = (selector) => {
                    const node = document.querySelector(selector);
                    if (!node) return null;
                    const value = node.getBoundingClientRect();
                    return {
                        top: Math.round(value.top),
                        bottom: Math.round(value.bottom),
                        height: Math.round(value.height)
                    };
                };
                const styles = getComputedStyle(document.body);
                console.log('[AccountLayout] ${javaClass.simpleName} ' + JSON.stringify({
                    innerHeight: window.innerHeight,
                    statusCss: getComputedStyle(document.documentElement).getPropertyValue('--native-status-bar-height').trim(),
                    navigationCss: getComputedStyle(document.documentElement).getPropertyValue('--native-navigation-bar-height').trim(),
                    bodyPaddingTop: styles.paddingTop,
                    bodyPaddingBottom: styles.paddingBottom,
                    main: rect('main'),
                    header: rect('header'),
                    section: rect('section'),
                    form: rect('form')
                }));
            })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
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

    private fun notifyRegistered(result: AccountAuthResult) {
        AccountSessionStore.save(this, result)
        lifecycleScope.launch {
            withContext(Dispatchers.IO) { syncManager.startAccountSync() }
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
        private const val LOG_TAG = "AccountInsets"
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
