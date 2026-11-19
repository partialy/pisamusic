package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.annotation.Keep
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityServiceInterceptBinding
import cn.partialy.pm.model.DeviceReportResult
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import org.json.JSONObject
import java.lang.ref.WeakReference
import java.util.Locale

/**
 * 设备封禁 / 服务停用（-233）全屏拦截页：
 * - 无原生返回按钮，开启 Edge-to-Edge 全屏；
 * - 注入 CSS 变量 `--android-status-bar-height` 与 `--android-navigation-bar-height`（物理 px / density 换算为 CSS px）；
 * - 拦截系统返回键并通知 HTML（`window.onAndroidBackPressed` / `androidBackPressed` 事件），不默认关闭；
 * - 暴露 `window.AndroidIntercept` JSBridge。
 */
class ServiceInterceptActivity : BaseActivity() {

    private lateinit var binding: ActivityServiceInterceptBinding
    private var statusBarCssPx: Float = 0f
    private var navigationBarCssPx: Float = 0f

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityServiceInterceptBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )

        val density = resources.displayMetrics.density.coerceAtLeast(1f)
        binding.interceptRoot.applySystemBarsInsets { insets ->
            statusBarCssPx = insets.top / density
            navigationBarCssPx = insets.bottom / density
            injectSafeAreaCssVariables()
        }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    notifyHtmlBackPressed()
                }
            },
        )

        val targetUrl = intent.getStringExtra(EXTRA_URL)?.trim()
            ?.takeIf { it.startsWith("http://") || it.startsWith("https://") }
            ?: DEFAULT_INTERCEPT_URL

        val wv = binding.interceptWebView
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
                injectSafeAreaCssVariables()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectSafeAreaCssVariables()
            }
        }
        wv.addJavascriptInterface(InterceptJsBridge(this), JS_INTERFACE_NAME)
        wv.loadUrl(targetUrl)
    }

    internal fun injectSafeAreaCssVariables() {
        if (!::binding.isInitialized) return
        val topPx = String.format(Locale.US, "%.2fpx", statusBarCssPx)
        val bottomPx = String.format(Locale.US, "%.2fpx", navigationBarCssPx)
        val js = """
            (function() {
              var root = document.documentElement;
              if (root && root.style) {
                root.style.setProperty('--android-status-bar-height', '$topPx');
                root.style.setProperty('--android-navigation-bar-height', '$bottomPx');
              }
            })();
        """.trimIndent()
        binding.interceptWebView.post {
            if (!isFinishing && !isDestroyed) {
                binding.interceptWebView.evaluateJavascript(js, null)
            }
        }
    }

    private fun notifyHtmlBackPressed() {
        if (!::binding.isInitialized) return
        val js = """
            (function() {
              if (typeof window.onAndroidBackPressed === 'function') {
                window.onAndroidBackPressed();
              }
              window.dispatchEvent(new CustomEvent('androidBackPressed'));
            })();
        """.trimIndent()
        binding.interceptWebView.post {
            if (!isFinishing && !isDestroyed) {
                binding.interceptWebView.evaluateJavascript(js, null)
            }
        }
    }

    internal fun buildInterceptInfoJson(): String {
        return JSONObject().apply {
            put("type", intent.getStringExtra(EXTRA_INTERCEPT_TYPE).orEmpty())
            put("code", intent.getIntExtra(EXTRA_CODE, 0))
            put("message", intent.getStringExtra(EXTRA_MESSAGE).orEmpty())
            if (intent.hasExtra(EXTRA_LOCK_END_TIME)) {
                put("lockEndTime", intent.getLongExtra(EXTRA_LOCK_END_TIME, 0L))
            } else {
                put("lockEndTime", JSONObject.NULL)
            }
            put("statusBarHeight", statusBarCssPx.toDouble())
            put("navigationBarHeight", navigationBarCssPx.toDouble())
        }.toString()
    }

    override fun onDestroy() {
        if (::binding.isInitialized) {
            binding.interceptWebView.removeJavascriptInterface(JS_INTERFACE_NAME)
            binding.interceptWebView.apply {
                stopLoading()
                loadUrl("about:blank")
                removeAllViews()
                destroy()
            }
        }
        super.onDestroy()
    }

    @Keep
    private class InterceptJsBridge(activity: ServiceInterceptActivity) {
        private val ref = WeakReference(activity)

        @JavascriptInterface
        fun exitApp() {
            val act = ref.get() ?: return
            act.runOnUiThread {
                if (!act.isFinishing && !act.isDestroyed) {
                    act.finishAffinity()
                }
            }
        }

        @JavascriptInterface
        fun goBackInWebView() {
            val act = ref.get() ?: return
            act.runOnUiThread {
                if (!act.isFinishing && !act.isDestroyed && act.binding.interceptWebView.canGoBack()) {
                    act.binding.interceptWebView.goBack()
                }
            }
        }

        @JavascriptInterface
        fun getInterceptInfo(): String {
            val act = ref.get() ?: return "{}"
            return act.buildInterceptInfoJson()
        }
    }

    companion object {
        const val JS_INTERFACE_NAME = "AndroidIntercept"
        const val DEFAULT_INTERCEPT_URL = "https://example.com"

        const val TYPE_SERVICE_UNAVAILABLE = "service_unavailable"
        const val TYPE_DEVICE_LOCKED = "device_locked"

        private const val EXTRA_URL = "extra_url"
        private const val EXTRA_INTERCEPT_TYPE = "extra_intercept_type"
        private const val EXTRA_MESSAGE = "extra_message"
        private const val EXTRA_CODE = "extra_code"
        private const val EXTRA_LOCK_END_TIME = "extra_lock_end_time"

        fun startForServiceUnavailable(
            activity: Activity,
            message: String,
            code: Int = -233,
            url: String = DEFAULT_INTERCEPT_URL,
        ) {
            start(
                context = activity,
                url = url,
                interceptType = TYPE_SERVICE_UNAVAILABLE,
                message = message,
                code = code,
                lockEndTime = null,
            )
            activity.finish()
        }

        fun startForDeviceLocked(
            activity: Activity,
            report: DeviceReportResult,
            message: String,
            url: String = DEFAULT_INTERCEPT_URL,
        ) {
            start(
                context = activity,
                url = url,
                interceptType = TYPE_DEVICE_LOCKED,
                message = message,
                code = 0,
                lockEndTime = report.lockEndTime,
            )
            activity.finish()
        }

        fun start(
            context: Context,
            url: String = DEFAULT_INTERCEPT_URL,
            interceptType: String = TYPE_SERVICE_UNAVAILABLE,
            message: String = "",
            code: Int = 0,
            lockEndTime: Long? = null,
        ) {
            val intent = Intent(context, ServiceInterceptActivity::class.java).apply {
                putExtra(EXTRA_URL, url)
                putExtra(EXTRA_INTERCEPT_TYPE, interceptType)
                putExtra(EXTRA_MESSAGE, message)
                putExtra(EXTRA_CODE, code)
                if (lockEndTime != null) {
                    putExtra(EXTRA_LOCK_END_TIME, lockEndTime)
                }
                if (context !is Activity) {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }
}
