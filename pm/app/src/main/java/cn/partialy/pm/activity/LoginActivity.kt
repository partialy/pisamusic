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
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
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
        applySystemBarPadding(binding.accountLoginWebView)
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
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
        }
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()
    }

    private fun applySystemBarPadding(webView: WebView) {
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.updatePadding(top = bars.top, bottom = bars.bottom)
            insets
        }
        webView.post { ViewCompat.requestApplyInsets(webView) }
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
                }.onSuccess(::notifyLoggedIn)
                    .onFailure { notifyError(it.message ?: "注册失败") }
            }
        }
    }

    companion object {
        private const val LOGIN_WEB_URL = "file:///android_asset/account-login/index.html"

        fun start(context: Context) {
            context.startActivity(Intent(context, LoginActivity::class.java))
        }
    }
}
