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
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityLoginBinding
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
class LoginActivity : BaseActivity() {
    private lateinit var binding: ActivityLoginBinding
    private var statusBarInsets: Insets = Insets.NONE
    private var navigationBarInsets: Insets = Insets.NONE

    @Inject
    lateinit var configManager: ConfigManager

    @Inject
    lateinit var syncManager: SyncManager

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLoginBinding.inflate(layoutInflater)
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
        setupWebView(binding.accountLoginWebView)
        applySystemBarInsets(binding.accountLoginWebView)
        binding.accountLoginWebView.addJavascriptInterface(AccountBridge(), "AndroidAccount")
        binding.accountLoginWebView.loadUrl(LOGIN_WEB_URL)
    }

    override fun onDestroy() {
        binding.accountLoginWebView.removeJavascriptInterface("AndroidAccount")
        binding.accountLoginWebView.destroy()
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

    private fun jsSafe(value: String): String =
        value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "")

    private fun notifySuccess(message: String) {
        binding.accountLoginWebView.post {
            binding.accountLoginWebView.evaluateJavascript("window.accountPage && window.accountPage.success('${jsSafe(message)}')", null)
        }
    }

    private fun notifyError(message: String) {
        binding.accountLoginWebView.post {
            binding.accountLoginWebView.evaluateJavascript("window.accountPage && window.accountPage.error('${jsSafe(message)}')", null)
        }
    }

    private fun notifyLoggedIn(result: AccountAuthResult) {
        AccountSessionStore.save(this, result)
        lifecycleScope.launch {
            withContext(Dispatchers.IO) { syncManager.startAccountSync() }
            binding.accountLoginWebView.post {
                binding.accountLoginWebView.evaluateJavascript("window.accountPage && window.accountPage.loggedIn()", null)
            }
        }
    }

    inner class AccountBridge {
        @JavascriptInterface
        fun close() {
            runOnUiThread { finish() }
        }

        @JavascriptInterface
        fun openRegister() {
            runOnUiThread {
                AccountAssistActivity.start(this@LoginActivity, AccountAssistActivity.MODE_REGISTER)
            }
        }

        @JavascriptInterface
        fun openResetPassword() {
            runOnUiThread {
                AccountAssistActivity.start(this@LoginActivity, AccountAssistActivity.MODE_RESET)
            }
        }

        @JavascriptInterface
        fun sendEmailCode(raw: String) {
            lifecycleScope.launch {
                runCatching {
                    val json = JSONObject(raw)
                    val email = json.optString("email")
                    val purpose = json.optString("purpose")
                    withContext(Dispatchers.IO) { configManager.sendAccountEmailCode(email, purpose) }
                }.onSuccess {
                    notifySuccess("验证码已发送")
                }.onFailure {
                    notifyError(it.message ?: "验证码发送失败")
                }
            }
        }

        @JavascriptInterface
        fun loginByPassword(raw: String) {
            lifecycleScope.launch {
                runCatching {
                    val json = JSONObject(raw)
                    withContext(Dispatchers.IO) {
                        configManager.loginAccountByPassword(
                            identifier = json.optString("identifier"),
                            password = json.optString("password"),
                        )
                    }
                }.onSuccess(::notifyLoggedIn)
                    .onFailure { notifyError(it.message ?: "登录失败") }
            }
        }

        @JavascriptInterface
        fun loginByCode(raw: String) {
            lifecycleScope.launch {
                runCatching {
                    val json = JSONObject(raw)
                    withContext(Dispatchers.IO) {
                        configManager.loginAccountByCode(
                            email = json.optString("email"),
                            code = json.optString("code"),
                        )
                    }
                }.onSuccess(::notifyLoggedIn)
                    .onFailure { notifyError(it.message ?: "登录失败") }
            }
        }

    }

    companion object {
        private const val LOG_TAG = "AccountInsets"
        private const val LOGIN_WEB_URL = "file:///android_asset/account-login/index.html"

        fun start(context: Context) {
            context.startActivity(Intent(context, LoginActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
