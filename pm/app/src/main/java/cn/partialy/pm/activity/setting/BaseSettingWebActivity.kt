package cn.partialy.pm.activity.setting

import android.annotation.SuppressLint
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityWebContentBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import androidx.core.view.updatePadding

abstract class BaseSettingWebActivity : BaseActivity() {

    protected lateinit var binding: ActivityWebContentBinding

    protected abstract fun headerTitle(): String

    /**
     * 返回要加载的 URL（http/https 或 file:///android_asset/ 等）。
     * 若返回 null，则由子类自行调用 [WebView.loadDataWithBaseURL] / [WebView.loadUrl]。
     */
    protected open fun initialUrl(): String? = null

    /**
     * 允许子类自定义装载内容（例如动态 HTML）。
     */
    protected open fun loadContent(webView: WebView) {
        val url = initialUrl() ?: return
        webView.loadUrl(url)
    }

    protected open fun onWebViewPageFinished(url: String?) = Unit

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
        supportActionBar?.title = headerTitle()
        binding.toolbar.setNavigationOnClickListener { navigateBackOrFinish() }
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    navigateBackOrFinish()
                }
            },
        )

        val wv = binding.webContentWebView
        wv.setBackgroundColor(Color.TRANSPARENT)
        wv.isVerticalScrollBarEnabled = false
        wv.isHorizontalScrollBarEnabled = false
        wv.overScrollMode = WebView.OVER_SCROLL_NEVER
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
                if (u.scheme == "file") return false
                return true
            }

            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                onWebViewPageFinished(url)
            }
        }
        loadContent(wv)
    }

    protected fun navigateBackOrFinish() {
        val wv = binding.webContentWebView
        if (wv.canGoBack()) {
            wv.goBack()
        } else {
            finish()
        }
    }

    override fun onDestroy() {
        if (::binding.isInitialized) {
            binding.webContentWebView.apply {
                stopLoading()
                loadUrl("about:blank")
                removeAllViews()
                destroy()
            }
        }
        super.onDestroy()
    }
}

