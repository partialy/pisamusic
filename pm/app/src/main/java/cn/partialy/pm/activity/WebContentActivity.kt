package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.annotation.Keep
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityWebContentBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import androidx.core.view.updatePadding
import java.lang.ref.WeakReference

/**
 * 全屏 WebView：页面内自绘顶栏与导航。H5 可调用 `AndroidWebHost.navigateBack()`：
 * 若 WebView 有历史则 [WebView.goBack]，否则关闭 Activity。
 * 启动：[start] 传入 http(s) 链接，用于公告、活动等。
 */
class WebContentActivity : BaseActivity() {

    private lateinit var binding: ActivityWebContentBinding

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityWebContentBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.webContentRoot.applySystemBarsInsets { insets ->
            val lp = binding.statusBarSpacer.layoutParams
            lp.height = insets.top
            binding.statusBarSpacer.layoutParams = lp
            binding.webContentWebView.updatePadding(bottom = insets.bottom)
        }
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = intent.getStringExtra(EXTRA_TITLE)?.takeIf { it.isNotBlank() }
            ?: getString(R.string.app_name)
        binding.toolbar.setNavigationOnClickListener { navigateBackOrFinish() }

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    navigateBackOrFinish()
                }
            },
        )

        val url = intent.getStringExtra(EXTRA_URL)?.trim().orEmpty()
        val uri = urlToHttpUri(url)
        if (uri == null) {
            Toast.makeText(this, R.string.web_content_invalid_url, Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val wv = binding.webContentWebView
        CookieManager.getInstance().setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true)
        }
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        wv.webChromeClient = WebChromeClient()
        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url
                if (u.scheme == "http" || u.scheme == "https") return false
                return true
            }
        }
        wv.addJavascriptInterface(WebContentJsBridge(this), JS_INTERFACE_NAME)
        wv.loadUrl(uri.toString())
    }

    internal fun navigateBackOrFinish() {
        if (!::binding.isInitialized) {
            finish()
            return
        }
        val wv = binding.webContentWebView
        if (wv.canGoBack()) {
            wv.goBack()
        } else {
            finish()
        }
    }

    override fun onDestroy() {
        if (::binding.isInitialized) {
            binding.webContentWebView.removeJavascriptInterface(JS_INTERFACE_NAME)
            binding.webContentWebView.apply {
                stopLoading()
                loadUrl("about:blank")
                removeAllViews()
                destroy()
            }
        }
        super.onDestroy()
    }

    companion object {
        const val EXTRA_URL = "cn.partialy.pm.extra.WEB_CONTENT_URL"
        const val EXTRA_TITLE = "cn.partialy.pm.extra.WEB_CONTENT_TITLE"

        private const val JS_INTERFACE_NAME = "AndroidWebHost"

        /**
         * @param url 仅支持 `http` / `https`
         */
        fun start(context: Context, url: String) {
            context.startActivity(
                Intent(context, WebContentActivity::class.java).putExtra(EXTRA_URL, url),
            )
            AppActivityTransitions.applyForward(context)
        }

        fun start(context: Context, url: String, title: String) {
            context.startActivity(
                Intent(context, WebContentActivity::class.java)
                    .putExtra(EXTRA_URL, url)
                    .putExtra(EXTRA_TITLE, title),
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
private class WebContentJsBridge(activity: WebContentActivity) {
    private val ref = WeakReference(activity)

    @JavascriptInterface
    fun navigateBack() {
        val a = ref.get() ?: return
        a.runOnUiThread { a.navigateBackOrFinish() }
    }
}
