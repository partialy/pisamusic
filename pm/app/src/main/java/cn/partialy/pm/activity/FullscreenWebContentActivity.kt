package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.annotation.Keep
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityFullscreenWebContentBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.ui.web.WebHostBridgeSecurity
import cn.partialy.pm.ui.web.WebPageErrorOverlayController
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.Locale

/**
 * 全屏无顶栏 WebView：
 * - Edge-to-Edge 全屏，无原生 HeaderBar 及返回键；
 * - 注入 CSS 变量 `--status-bar-height`、`--navigation-bar-height`（以及兼容别名 `--android-status-bar-height`、`--android-navigation-bar-height`，物理 px / density 换算为 CSS px）；
 * - 挂载 `window.AndroidWebHost`（`navigateBack` / `close` / `getSafeAreaInsets` / `hasHeaderBar` / `isDarkMode`）；
 * - 系统返回优先调 `window.onAndroidBackPressed()`，仅当其明确返回 `true` 时交由网页接管，否则执行 `navigateBackOrFinish()`。
 */
class FullscreenWebContentActivity : BaseActivity() {

    private lateinit var binding: ActivityFullscreenWebContentBinding
    private var errorOverlayController: WebPageErrorOverlayController? = null
    private var statusBarCssPx: Float = 0f
    private var navigationBarCssPx: Float = 0f

    private fun currentIsDarkMode(): Boolean {
        return (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityFullscreenWebContentBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight = currentIsDarkMode()
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )

        val density = resources.displayMetrics.density.coerceAtLeast(1f)
        binding.fullscreenWebRoot.applySystemBarsInsets { insets ->
            statusBarCssPx = insets.top / density
            navigationBarCssPx = insets.bottom / density
            injectSafeAreaCssVariables()
            errorOverlayController?.syncSafeAreaCssVariables()
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    handleSystemBackPressed()
                }
            },
        )

        val url = intent.getStringExtra(EXTRA_URL)?.trim().orEmpty()
        val uri = urlToHttpUri(url)
        if (uri == null) {
            PmMessage.warning(this, R.string.web_content_invalid_url)
            finish()
            return
        }

        val wv = binding.fullscreenWebView
        errorOverlayController = WebPageErrorOverlayController(
            contentContainer = binding.fullscreenWebRoot,
            contentWebView = wv,
            hasNativeHeaderBar = false,
            isDarkModeProvider = { currentIsDarkMode() },
            statusBarCssPxProvider = { statusBarCssPx },
            navigationBarCssPxProvider = { navigationBarCssPx },
            onRetryRequest = { targetUrl ->
                if (!isFinishing && !isDestroyed) {
                    wv.loadUrl(targetUrl)
                }
            },
            onClosePage = {
                if (!isFinishing && !isDestroyed) {
                    finish()
                }
            },
        )

        CookieManager.getInstance().setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true)
        }
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        wv.webChromeClient = WebChromeClient()
        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                return !(u.scheme == "http" || u.scheme == "https")
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                errorOverlayController?.onMainPageStarted(url)
                injectSafeAreaCssVariables()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectSafeAreaCssVariables()
                injectAppThemeState()
                errorOverlayController?.onMainPageFinished(url)
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                super.onReceivedError(view, request, error)
                errorOverlayController?.onMainReceivedError(request, error)
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse,
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                errorOverlayController?.onMainReceivedHttpError(request, errorResponse)
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?,
            ) {
                handler?.cancel()
                errorOverlayController?.onMainSslError(error?.url)
            }
        }
        wv.addJavascriptInterface(FullscreenWebJsBridge(this), JS_INTERFACE_NAME)
        val initialUrl = uri.toString()
        errorOverlayController?.trackUrl(initialUrl)
        wv.loadUrl(initialUrl)
    }

    internal fun injectSafeAreaCssVariables() {
        if (!::binding.isInitialized) return
        val topPx = String.format(Locale.US, "%.2fpx", statusBarCssPx)
        val bottomPx = String.format(Locale.US, "%.2fpx", navigationBarCssPx)
        val topVal = String.format(Locale.US, "%.2f", statusBarCssPx)
        val bottomVal = String.format(Locale.US, "%.2f", navigationBarCssPx)
        val js = """
            (function() {
              var root = document.documentElement;
              if (root && root.style) {
                root.style.setProperty('--status-bar-height', '$topPx');
                root.style.setProperty('--navigation-bar-height', '$bottomPx');
                root.style.setProperty('--android-status-bar-height', '$topPx');
                root.style.setProperty('--android-navigation-bar-height', '$bottomPx');
              }
              window.dispatchEvent(new CustomEvent('pmSafeAreaChanged', {
                detail: { statusBarHeight: $topVal, navigationBarHeight: $bottomVal }
              }));
            })();
        """.trimIndent()
        binding.fullscreenWebView.post {
            if (!isFinishing && !isDestroyed) {
                binding.fullscreenWebView.evaluateJavascript(js, null)
            }
        }
    }

    private fun handleSystemBackPressed() {
        if (!::binding.isInitialized || errorOverlayController?.isErrorVisible == true) {
            finish()
            return
        }
        val js = """
            (function() {
              if (typeof window.onAndroidBackPressed === 'function') {
                return Boolean(window.onAndroidBackPressed());
              }
              return false;
            })();
        """.trimIndent()
        binding.fullscreenWebView.evaluateJavascript(js) { result ->
            if (isFinishing || isDestroyed) return@evaluateJavascript
            if (result?.trim() != "true") {
                navigateBackOrFinish()
            }
        }
    }

    internal fun navigateBackOrFinish() {
        if (!::binding.isInitialized || errorOverlayController?.isErrorVisible == true) {
            finish()
            return
        }
        val wv = binding.fullscreenWebView
        if (wv.canGoBack()) {
            wv.goBack()
        } else {
            finish()
        }
    }

    internal fun buildSafeAreaJson(): String {
        return JSONObject().apply {
            put("statusBarHeight", statusBarCssPx.toDouble())
            put("navigationBarHeight", navigationBarCssPx.toDouble())
        }.toString()
    }

    internal fun isDarkMode(): Boolean = currentIsDarkMode()

    private fun injectAppThemeState() {
        if (!::binding.isInitialized) return
        val dark = currentIsDarkMode()
        val js = """
            (function() {
              if (typeof window.pmApplyAppTheme === 'function') {
                window.pmApplyAppTheme($dark);
              }
              window.dispatchEvent(new CustomEvent('pmThemeChanged', {
                detail: { isDark: $dark }
              }));
            })();
        """.trimIndent()
        binding.fullscreenWebView.post {
            if (!isFinishing && !isDestroyed) {
                binding.fullscreenWebView.evaluateJavascript(js, null)
            }
        }
    }

    override fun onDestroy() {
        errorOverlayController?.destroy()
        errorOverlayController = null
        if (::binding.isInitialized) {
            binding.fullscreenWebView.removeJavascriptInterface(JS_INTERFACE_NAME)
            binding.fullscreenWebView.apply {
                stopLoading()
                loadUrl("about:blank")
                removeAllViews()
                destroy()
            }
        }
        super.onDestroy()
    }

    companion object {
        const val EXTRA_URL = "cn.partialy.pm.extra.FULLSCREEN_WEB_URL"
        private const val JS_INTERFACE_NAME = "AndroidWebHost"

        fun start(context: Context, url: String) {
            context.startActivity(
                Intent(context, FullscreenWebContentActivity::class.java).putExtra(EXTRA_URL, url),
            )
            AppActivityTransitions.applyForward(context)
        }

        private fun urlToHttpUri(raw: String): Uri? {
            if (raw.isEmpty()) return null
            val uri = Uri.parse(raw)
            val scheme = uri.scheme?.lowercase()
            return if (scheme == "http" || scheme == "https") uri else null
        }
    }
}

@Keep
private class FullscreenWebJsBridge(activity: FullscreenWebContentActivity) {
    private val ref = WeakReference(activity)

    @JavascriptInterface
    fun navigateBack() {
        val a = ref.get() ?: return
        a.runOnUiThread {
            if (!a.isFinishing && !a.isDestroyed) a.navigateBackOrFinish()
        }
    }

    @JavascriptInterface
    fun close() {
        val a = ref.get() ?: return
        a.runOnUiThread {
            if (!a.isFinishing && !a.isDestroyed) a.finish()
        }
    }

    @JavascriptInterface
    fun hasHeaderBar(): Boolean = false

    @JavascriptInterface
    fun isDarkMode(): Boolean = ref.get()?.isDarkMode() ?: false

    @JavascriptInterface
    fun verifyHostAccess(nonce: String?): String = WebHostBridgeSecurity.signChallenge(nonce)

    @JavascriptInterface
    fun getSafeAreaInsets(): String {
        return ref.get()?.buildSafeAreaJson() ?: "{}"
    }
}
