package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.Keep
import androidx.core.graphics.toColorInt
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityStatusBarLyricSettingsBinding
import cn.partialy.pm.statusbarlyric.StatusBarLyricConfig
import cn.partialy.pm.statusbarlyric.StatusBarLyricOverlayController
import cn.partialy.pm.statusbarlyric.StatusBarLyricPrefs
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import dagger.hilt.android.AndroidEntryPoint
import org.json.JSONObject
import javax.inject.Inject

@AndroidEntryPoint
class StatusBarLyricSettingsActivity : BaseActivity() {
    @Inject lateinit var statusBarLyricOverlayController: StatusBarLyricOverlayController

    private lateinit var binding: ActivityStatusBarLyricSettingsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityStatusBarLyricSettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setupSystemBars()
        setupToolbar()
        setupWebView()
    }

    override fun onResume() {
        super.onResume()
        statusBarLyricOverlayController.showSettingsPreview()
        if (::binding.isInitialized) {
            binding.statusBarLyricWebView.evaluateJavascript(
                "window.PmStatusBarLyric && window.PmStatusBarLyric.refreshFromAndroid()",
                null,
            )
        }
    }

    override fun onPause() {
        statusBarLyricOverlayController.hideSettingsPreview()
        super.onPause()
    }

    private fun setupSystemBars() {
        val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = !isNight, lightNavigationBarIcons = !isNight)
        binding.statusBarLyricSettingsRoot.applySystemBarsInsets { insets ->
            val lp = binding.statusBarSpacer.layoutParams
            lp.height = insets.top
            binding.statusBarSpacer.layoutParams = lp
            binding.statusBarLyricWebView.setPadding(
                binding.statusBarLyricWebView.paddingLeft,
                binding.statusBarLyricWebView.paddingTop,
                binding.statusBarLyricWebView.paddingRight,
                insets.bottom,
            )
        }
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webView = binding.statusBarLyricWebView
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false
        webView.overScrollMode = WebView.OVER_SCROLL_NEVER
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (url.startsWith("file:///android_asset/")) return false
                if (url.startsWith("https://") || url.startsWith("http://")) return false
                return true
            }
        }
        webView.addJavascriptInterface(
            StatusBarLyricSettingsBridge(this, statusBarLyricOverlayController),
            "AndroidStatusBarLyric",
        )
        webView.loadUrl("file:///android_asset/status_bar_lyric/index.html")
    }

    override fun onDestroy() {
        binding.statusBarLyricWebView.removeJavascriptInterface("AndroidStatusBarLyric")
        binding.statusBarLyricWebView.loadUrl("about:blank")
        super.onDestroy()
    }

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, StatusBarLyricSettingsActivity::class.java))
            (context as? Activity)?.overridePendingTransition(R.anim.slide_to_left, R.anim.dim_and_scale_out)
        }
    }

    override fun finish() {
        super.finish()
        overridePendingTransition(R.anim.dim_and_scale_in, R.anim.slide_to_right)
    }
}

@Keep
class StatusBarLyricSettingsBridge(
    context: Context,
    private val overlayController: StatusBarLyricOverlayController,
) {
    private val activity = context as? Activity
    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun getState(): String {
        val config = StatusBarLyricPrefs.read(appContext)
        val defaults = StatusBarLyricPrefs.DEFAULT
        return JSONObject().apply {
            put("hasPermission", Settings.canDrawOverlays(appContext))
            put("config", config.toJson())
            put("defaults", defaults.toJson())
        }.toString()
    }

    @JavascriptInterface
    fun onPageVisible(): String {
        mainHandler.post { overlayController.showSettingsPreview() }
        return jsonOk()
    }

    @JavascriptInterface
    fun onPageHidden(): String {
        mainHandler.post { overlayController.hideSettingsPreview() }
        return jsonOk()
    }

    @JavascriptInterface
    fun setEnabled(enabled: Boolean): String {
        if (enabled && !Settings.canDrawOverlays(appContext)) {
            openOverlayPermission()
            return jsonErr("请先开启悬浮窗权限")
        }
        val current = StatusBarLyricPrefs.read(appContext)
        StatusBarLyricPrefs.write(appContext, current.copy(enabled = enabled))
        return jsonOk()
    }

    @JavascriptInterface
    fun setPosition(xPercent: Int, yDp: Int): String {
        val current = StatusBarLyricPrefs.read(appContext)
        StatusBarLyricPrefs.write(
            appContext,
            current.copy(
                xPercent = xPercent.coerceIn(0, 100),
                yDp = yDp.coerceIn(0, 160),
            ),
        )
        return jsonOk()
    }

    @JavascriptInterface
    fun setWidth(widthPercent: Int): String {
        val current = StatusBarLyricPrefs.read(appContext)
        StatusBarLyricPrefs.write(appContext, current.copy(widthPercent = widthPercent.coerceIn(30, 100)))
        mainHandler.post { overlayController.showWidthBounds() }
        return jsonOk()
    }

    @JavascriptInterface
    fun setFontSizeLevel(level: Int): String {
        val current = StatusBarLyricPrefs.read(appContext)
        StatusBarLyricPrefs.write(appContext, current.copy(fontSizeLevel = level.coerceIn(0, 4)))
        return jsonOk()
    }

    @JavascriptInterface
    fun setColors(sungHex: String, unsungHex: String): String {
        val sung = parseColor(sungHex) ?: return jsonErr("已唱颜色格式无效")
        val unsung = parseColor(unsungHex) ?: return jsonErr("未唱颜色格式无效")
        val current = StatusBarLyricPrefs.read(appContext)
        StatusBarLyricPrefs.write(appContext, current.copy(sungColorArgb = sung, unsungColorArgb = unsung))
        return jsonOk()
    }

    @JavascriptInterface
    fun reset(): String {
        StatusBarLyricPrefs.reset(appContext)
        return jsonOk()
    }

    @JavascriptInterface
    fun openOverlayPermission(): String {
        val targetActivity = activity ?: return jsonErr("无法打开系统设置")
        mainHandler.post {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${targetActivity.packageName}"),
            )
            targetActivity.startActivity(intent)
        }
        return jsonOk()
    }

    private fun StatusBarLyricConfig.toJson(): JSONObject = JSONObject().apply {
        put("enabled", enabled)
        put("xPercent", xPercent)
        put("yDp", yDp)
        put("widthPercent", widthPercent)
        put("fontSizeLevel", fontSizeLevel)
        put("sungColor", colorToHex(sungColorArgb))
        put("unsungColor", colorToHex(unsungColorArgb))
    }

    private fun parseColor(hex: String): Int? {
        var value = hex.trim()
        if (!value.startsWith("#")) value = "#$value"
        return try {
            value.toColorInt()
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun colorToHex(color: Int): String =
        String.format("#%08X", color.toLong() and 0xFFFFFFFFL)

    private fun jsonOk(): String = JSONObject().put("ok", true).put("message", "").toString()

    private fun jsonErr(message: String): String =
        JSONObject().put("ok", false).put("message", message).toString()
}
