package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityAccountProfileBinding
import cn.partialy.pm.model.AccountAuthResult
import cn.partialy.pm.model.AccountUser
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.sync.SyncManager
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import dagger.hilt.android.AndroidEntryPoint
import java.lang.ref.WeakReference
import javax.inject.Inject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

@AndroidEntryPoint
class AccountProfileActivity : BaseActivity() {
    private lateinit var binding: ActivityAccountProfileBinding
    private var statusBarInsets: Insets = Insets.NONE
    private var navigationBarInsets: Insets = Insets.NONE
    private val avatarHttpClient = OkHttpClient()

    private val pickAvatarLauncher =
        registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            if (uri != null) uploadSelectedAvatar(uri) else sendAvatarCanceled()
        }

    @Inject
    lateinit var configManager: ConfigManager

    @Inject
    lateinit var syncManager: SyncManager

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
        applySystemBarInsets(binding.accountProfileWebView)

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

    private fun sendEmailCodeSent() {
        binding.accountProfileWebView.post {
            binding.accountProfileWebView.evaluateJavascript(
                "window.profilePage && window.profilePage.emailCodeSent()",
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

    private fun sendAvatarSaved(user: AccountUser) {
        binding.accountProfileWebView.post {
            binding.accountProfileWebView.evaluateJavascript(
                "window.profilePage && window.profilePage.avatarSaved(${profileJson(user)})",
                null,
            )
        }
    }

    private fun sendAvatarCanceled() {
        binding.accountProfileWebView.post {
            binding.accountProfileWebView.evaluateJavascript(
                "window.profilePage && window.profilePage.avatarCanceled()",
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
            .toString()

    private fun resolveAccountAvatarUrl(user: AccountUser): String {
        val raw = user.avatarUrl.ifBlank { user.avatar }.trim()
        return when {
            raw.startsWith("http://") || raw.startsWith("https://") -> raw
            raw.startsWith("/") -> BuildConfig.SYSTEM_SERVICE_BASE_URL.trimEnd('/') + raw
            else -> absoluteAvatarPath("default.jpg")
        }
    }

    private fun absoluteAvatarPath(fileName: String): String =
        BuildConfig.SYSTEM_SERVICE_BASE_URL.trimEnd('/') + "/static/account-avatars/$fileName"

    private fun requestPickAvatar() {
        pickAvatarLauncher.launch("image/*")
    }

    private fun uploadSelectedAvatar(uri: Uri) {
        lifecycleScope.launch {
            runCatching {
                val session = AccountSessionStore.read(this@AccountProfileActivity)
                require(session.loggedIn) { "请先登录账号" }
                val result = withContext(Dispatchers.IO) {
                    uploadAccountAvatar(session.token, uri)
                }
                AccountSessionStore.save(this@AccountProfileActivity, result)
                result.user
            }.onSuccess { user ->
                sendAvatarSaved(user)
                sendSuccess("头像已更新")
            }.onFailure {
                sendError(it.message ?: "头像上传失败")
            }
        }
    }

    private suspend fun restoreDefaultAvatar() {
        val session = AccountSessionStore.read(this)
        require(session.loggedIn) { "请先登录账号" }
        val result = withContext(Dispatchers.IO) {
            configManager.updateAccountProfile(
                token = session.token,
                username = null,
                email = null,
                code = null,
                avatarKey = "default",
            )
        }
        AccountSessionStore.save(this, result)
        sendAvatarSaved(result.user)
    }

    private suspend fun uploadAccountAvatar(token: String, uri: Uri): AccountAuthResult {
        val picked = readPickedAvatar(uri)
        val uploadToken = configManager.requestAccountAvatarUploadToken(
            token = token,
            fileName = picked.fileName,
            fileSize = picked.bytes.size.toLong(),
            mimeType = picked.mimeType,
        )
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("token", uploadToken.uploadToken)
            .addFormDataPart("key", uploadToken.key)
            .addFormDataPart(
                "file",
                picked.fileName,
                picked.bytes.toRequestBody(picked.mimeType.toMediaTypeOrNull()),
            )
            .build()
        val request = Request.Builder()
            .url(uploadToken.uploadUrl)
            .post(body)
            .build()
        avatarHttpClient.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                throw IllegalStateException("七牛上传失败：HTTP ${response.code}")
            }
        }
        return configManager.updateAccountProfile(
            token = token,
            username = null,
            email = null,
            code = null,
            avatarKey = uploadToken.key,
        )
    }

    private fun readPickedAvatar(uri: Uri): PickedAvatar {
        val mimeType = contentResolver.getType(uri) ?: "image/jpeg"
        val fileName = normalizeAvatarFileName(queryDisplayName(uri), mimeType)
        val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() }
            ?: throw IllegalStateException("头像文件读取失败")
        require(bytes.isNotEmpty()) { "头像文件为空" }
        require(bytes.size <= MAX_AVATAR_BYTES) { "头像文件不能超过 5MB" }
        return PickedAvatar(fileName, mimeType, bytes)
    }

    private fun queryDisplayName(uri: Uri): String {
        return runCatching {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
                if (!cursor.moveToFirst()) return@use ""
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0) cursor.getString(index).orEmpty() else ""
            }.orEmpty()
        }.getOrDefault("")
    }

    private fun extensionForMime(mimeType: String): String =
        MimeTypeMap.getSingleton().getExtensionFromMimeType(mimeType)?.takeIf { it.isNotBlank() } ?: "jpg"

    private fun normalizeAvatarFileName(rawName: String, mimeType: String): String {
        val cleanName = rawName.trim().ifBlank { "avatar" }
        val hasExtension = cleanName.substringAfterLast('.', "").isNotBlank()
        return if (hasExtension) cleanName else "$cleanName.${extensionForMime(mimeType)}"
    }

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

    private data class PickedAvatar(
        val fileName: String,
        val mimeType: String,
        val bytes: ByteArray,
    )

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
                activity.lifecycleScope.launch {
                    withContext(Dispatchers.IO) {
                        activity.syncManager.clearLocalSyncState()
                        AccountSessionStore.clear(activity)
                    }
                    activity.finish()
                }
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
        fun pickAvatar() {
            ref.get()?.runOnUiThread { ref.get()?.requestPickAvatar() }
        }

        @JavascriptInterface
        fun restoreDefaultAvatar() {
            val activity = ref.get() ?: return
            activity.runOnUiThread {
                activity.lifecycleScope.launch {
                    runCatching {
                        activity.restoreDefaultAvatar()
                    }.onSuccess {
                        activity.sendSuccess("已恢复默认头像")
                    }.onFailure {
                        activity.sendError(it.message ?: "恢复默认头像失败")
                    }
                }
            }
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
                    activity.sendEmailCodeSent()
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
                    require(username.isNotBlank()) { "请输入昵称" }
                    require(email.isNotBlank()) { "请输入邮箱" }
                    withContext(Dispatchers.IO) {
                        activity.configManager.updateAccountProfile(
                            token = session.token,
                            username = username,
                            email = email,
                            code = code,
                            avatarKey = null,
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
        private const val MAX_AVATAR_BYTES = 5 * 1024 * 1024

        fun start(context: Context) {
            context.startActivity(Intent(context, AccountProfileActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
