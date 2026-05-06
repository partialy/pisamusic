package cn.partialy.pm.ui.web

import android.annotation.SuppressLint
import android.content.res.Configuration
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.Keep

/**
 * 本地 assets 通用加载失败页：[ASSET_URL]，通过 [AndroidErrorPageHost] 与页面交互。
 * 在宿主 [onDestroyView]/销毁前须调用 [detach]。
 */
class LocalGenericErrorWebViewController(
    private val webView: WebView,
    private val onRetry: () -> Unit,
    private val onFeedback: () -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var bridge: ErrorPageBridge? = null

    @SuppressLint("SetJavaScriptEnabled")
    fun attach() {
        if (bridge != null) return
        val b = ErrorPageBridge(mainHandler, onRetry, onFeedback)
        bridge = b
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
        }
        webView.isVerticalScrollBarEnabled = false
        webView.isHorizontalScrollBarEnabled = false
        webView.overScrollMode = View.OVER_SCROLL_NEVER
        val isNight =
            (webView.context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        webView.setBackgroundColor(
            if (isNight) Color.parseColor(BG_DARK_HEX) else Color.parseColor(BG_LIGHT_HEX),
        )
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = WebViewClient()
        webView.addJavascriptInterface(b, JS_INTERFACE_NAME)
        webView.loadUrl(ASSET_URL)
    }

    fun detach() {
        if (bridge == null) return
        webView.removeJavascriptInterface(JS_INTERFACE_NAME)
        bridge = null
    }

    /** 隐藏网页内「重试」加载态（例如原生侧已开始重新加载并盖住页面时）。 */
    fun resetRetryUi() {
        webView.post {
            webView.evaluateJavascript(
                "(function(){ if(window.pmErrorPageSetRetryLoading) window.pmErrorPageSetRetryLoading(false); })();",
                null,
            )
        }
    }

    companion object {
        const val ASSET_URL = "file:///android_asset/web/load_error.html"
        const val JS_INTERFACE_NAME = "AndroidErrorPageHost"
        private const val BG_LIGHT_HEX = "#fefefe"
        private const val BG_DARK_HEX = "#17191d"
    }

    @Keep
    class ErrorPageBridge(
        private val mainHandler: Handler,
        private val onRetry: () -> Unit,
        private val onFeedback: () -> Unit,
    ) {
        @JavascriptInterface
        fun retry() {
            mainHandler.post { onRetry() }
        }

        @JavascriptInterface
        fun openFeedback() {
            mainHandler.post { onFeedback() }
        }
    }
}
