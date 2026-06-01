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
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityAccountProfileBinding
import cn.partialy.pm.model.AccountUser
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference
import javax.inject.Inject

@AndroidEntryPoint
class AccountProfileActivity : BaseActivity() {
    private lateinit var binding: ActivityAccountProfileBinding

    @Inject
    lateinit var configManager: ConfigManager

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityAccountProfileBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.accountProfileRoot.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply {
                height = insets.top
            }
            binding.accountProfileWebView.updatePadding(bottom = insets.bottom)
        }

        setSupportActionBar(binding.accountProfileToolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "我的资料"
        binding.accountProfileToolbar.setNavigationOnClickListener { navigateBackOrFinish() }
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() = navigateBackOrFinish()
            },
        )

        setupWebView(binding.accountProfileWebView)
        binding.accountProfileWebView.addJavascriptInterface(ProfileBridge(this), JS_INTERFACE_NAME)
        binding.accountProfileWebView.loadUrl(PROFILE_WEB_URL)
    }

    private fun navigateBackOrFinish() {
        val webView = binding.accountProfileWebView
        if (webView.canGoBack()) webView.goBack() else finish()
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

    private fun sendSuccess(message: String) {
        binding.accountProfileWebView.post {
            binding.accountProfileWebView.evaluateJavascript(
                "window.profilePage && window.profilePage.success(${JSONObject.quote(message)})",
                null,
            )
        }
    }

    private fun sendError(message: String) {
        binding.accountProfileWebView.post {
            binding.accountProfileWebView.evaluateJavascript(
                "window.profilePage && window.profilePage.error(${JSONObject.quote(message)})",
                null,
            )
        }
    }

    private fun sendSaved(user: AccountUser) {
        binding.accountProfileWebView.post {
            binding.accountProfileWebView.evaluateJavascript(
                "window.profilePage && window.profilePage.saved(${profileJson(user)})",
                null,
            )
        }
    }

    private fun profileJson(user: AccountUser): String =
        JSONObject()
            .put(
                "user",
                JSONObject()
                    .put("id", user.id)
                    .put("username", user.username)
                    .put("email", user.email)
                    .put("avatarKey", user.avatarKey.ifBlank { "default" })
                    .put("avatarUrl", resolveAccountAvatarUrl(user)),
            )
            .put("avatars", avatarOptionsJson())
            .toString()

    private fun avatarOptionsJson(): JSONArray =
        JSONArray().apply {
            AVATARS.forEach { option ->
                put(
                    JSONObject()
                        .put("key", option.key)
                        .put("label", option.label)
                        .put("url", absoluteAvatarPath(option.fileName)),
                )
            }
        }

    private fun resolveAccountAvatarUrl(user: AccountUser): String {
        val raw = user.avatarUrl.ifBlank { user.avatar }.trim()
        return when {
            raw.startsWith("http://") || raw.startsWith("https://") -> raw
            raw.startsWith("/") -> BuildConfig.SYSTEM_SERVICE_BASE_URL.trimEnd('/') + raw
            else -> absoluteAvatarPath(if (user.avatarKey == "default") "default.jpg" else "${user.avatarKey}.png")
        }
    }

    private fun absoluteAvatarPath(fileName: String): String =
        BuildConfig.SYSTEM_SERVICE_BASE_URL.trimEnd('/') + "/static/account-avatars/$fileName"

    override fun onDestroy() {
        if (::binding.isInitialized) {
            binding.accountProfileWebView.removeJavascriptInterface(JS_INTERFACE_NAME)
            binding.accountProfileWebView.apply {
                stopLoading()
                loadUrl("about:blank")
                removeAllViews()
                destroy()
            }
        }
        super.onDestroy()
    }

    private class ProfileBridge(activity: AccountProfileActivity) {
        private val ref = WeakReference(activity)

        @JavascriptInterface
        fun close() {
            ref.get()?.runOnUiThread { ref.get()?.finish() }
        }

        @JavascriptInterface
        fun logout() {
            val activity = ref.get() ?: return
            activity.runOnUiThread {
                AccountSessionStore.clear(activity)
                activity.finish()
            }
        }

        @JavascriptInterface
        fun getInitialProfile(): String {
            val activity = ref.get() ?: return "{}"
            val session = AccountSessionStore.read(activity)
            if (!session.loggedIn) return "{}"
            return activity.profileJson(session.user)
        }

        @JavascriptInterface
        fun sendEmailCode(raw: String) {
            val activity = ref.get() ?: return
            activity.lifecycleScope.launch {
                runCatching {
                    val session = AccountSessionStore.read(activity)
                    require(session.loggedIn) { "请先登录账号" }
                    val email = JSONObject(raw).optString("email").trim()
                    require(email.isNotBlank()) { "请输入新邮箱" }
                    withContext(Dispatchers.IO) {
                        activity.configManager.sendAccountProfileEmailCode(session.token, email)
                    }
                }.onSuccess {
                    activity.sendSuccess("验证码已发送")
                }.onFailure {
                    activity.sendError(it.message ?: "验证码发送失败")
                }
            }
        }

        @JavascriptInterface
        fun saveProfile(raw: String) {
            val activity = ref.get() ?: return
            activity.lifecycleScope.launch {
                runCatching {
                    val session = AccountSessionStore.read(activity)
                    require(session.loggedIn) { "请先登录账号" }
                    val json = JSONObject(raw)
                    val username = json.optString("username").trim()
                    val email = json.optString("email").trim()
                    val code = json.optString("code").trim().ifBlank { null }
                    val avatarKey = json.optString("avatarKey").trim().ifBlank { "default" }
                    require(username.isNotBlank()) { "请输入昵称" }
                    require(email.isNotBlank()) { "请输入邮箱" }
                    withContext(Dispatchers.IO) {
                        activity.configManager.updateAccountProfile(
                            token = session.token,
                            username = username,
                            email = email,
                            code = code,
                            avatarKey = avatarKey,
                        )
                    }
                }.onSuccess { result ->
                    AccountSessionStore.save(activity, result)
                    activity.sendSaved(result.user)
                }.onFailure {
                    activity.sendError(it.message ?: "资料保存失败")
                }
            }
        }
    }

    companion object {
        private const val PROFILE_WEB_URL = "file:///android_asset/account-profile/index.html"
        private const val JS_INTERFACE_NAME = "AndroidAccountProfile"

        private data class AvatarOption(
            val key: String,
            val label: String,
            val fileName: String,
        )

        private val AVATARS = listOf(
            AvatarOption("default", "默认", "default.jpg"),
            AvatarOption("anime_sky", "天青", "anime_sky.png"),
            AvatarOption("anime_mint", "薄荷", "anime_mint.png"),
            AvatarOption("anime_peach", "蜜桃", "anime_peach.png"),
            AvatarOption("anime_lilac", "浅紫", "anime_lilac.png"),
            AvatarOption("anime_sun", "暖阳", "anime_sun.png"),
        )

        fun start(context: Context) {
            context.startActivity(Intent(context, AccountProfileActivity::class.java))
        }
    }
}
