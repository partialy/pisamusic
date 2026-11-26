package cn.partialy.pm.ui.web

import android.annotation.SuppressLint
import android.content.res.Configuration
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.annotation.Keep
import java.lang.ref.WeakReference
import java.util.Locale

/**
 * 网页容器通用加载失败覆盖控制器：
 * - 平时仅展示原 [contentWebView]；
 * - 主框架加载出错时将原 [contentWebView] 设为 [View.INVISIBLE]（保留布局宽高，便于后台重载），
 *   并在 [contentContainer] 顶层动态创建加载 [ASSET_URL] 的报错 WebView；
 * - 点击报错页「重试」时保持报错页与重试 loading 动画不销毁（期间仍可点击关闭），
 *   同时触发 [onRetryRequest] 让原 WebView 重新加载原 URL；仅当新导航加载完成且无主框架错误时
 *   再显示原 WebView 并彻底销毁报错 WebView；若再次出错则留存报错页并恢复重试按钮状态。
 */
class WebPageErrorOverlayController(
    private val contentContainer: FrameLayout,
    private val contentWebView: WebView,
    private val hasNativeHeaderBar: Boolean,
    private val isDarkModeProvider: () -> Boolean = {
        (contentWebView.context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
    },
    private val statusBarCssPxProvider: () -> Float = { 0f },
    private val navigationBarCssPxProvider: () -> Float = { 0f },
    private val onRetryRequest: (targetUrl: String) -> Unit,
    private val onClosePage: () -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())

    private var errorWebView: WebView? = null
    private var lastRequestedUrl: String? = null
    private var lastFailedUrl: String? = null
    private var pendingAttemptFailed = false
    private var isRetrying = false
    private var released = false

    val isErrorVisible: Boolean
        get() = errorWebView != null

    /** 记录初始或外部发起加载的目标 URL。 */
    fun trackUrl(url: String?) {
        val clean = url?.trim().orEmpty()
        if (clean.startsWith("http://", ignoreCase = true) ||
            clean.startsWith("https://", ignoreCase = true)
        ) {
            lastRequestedUrl = clean
        }
    }

    fun onMainPageStarted(url: String?) {
        if (released) return
        val clean = url?.trim().orEmpty()
        if (clean.equals("about:blank", ignoreCase = true)) return
        trackUrl(clean)
        pendingAttemptFailed = false
    }

    fun onMainPageFinished(url: String?) {
        if (released) return
        val clean = url?.trim().orEmpty()
        if (clean.equals("about:blank", ignoreCase = true)) return
        if (!pendingAttemptFailed && errorWebView != null) {
            hideErrorAndDestroyOverlay()
        }
    }

    fun onMainReceivedError(request: WebResourceRequest, error: WebResourceError) {
        if (released || !request.isForMainFrame) return
        val desc = error.description?.toString().orEmpty()
        if (desc.contains("ERR_ABORTED", ignoreCase = true)) return
        val url = request.url?.toString()?.takeIf { it.isNotBlank() } ?: lastRequestedUrl
        handleMainFrameFailure(url)
    }

    fun onMainReceivedHttpError(request: WebResourceRequest, errorResponse: WebResourceResponse) {
        if (released || !request.isForMainFrame) return
        if (errorResponse.statusCode < 400) return
        val url = request.url?.toString()?.takeIf { it.isNotBlank() } ?: lastRequestedUrl
        handleMainFrameFailure(url)
    }

    fun onMainSslError(failedUrl: String?) {
        if (released) return
        handleMainFrameFailure(failedUrl?.takeIf { it.isNotBlank() } ?: lastRequestedUrl)
    }

    /** 将安全区 CSS 变量同步到正在显示的报错页（全屏模式 Insets 更新时调用）。 */
    fun syncSafeAreaCssVariables() {
        val wv = errorWebView ?: return
        injectOverlayState(wv)
    }

    fun destroy() {
        released = true
        mainHandler.removeCallbacksAndMessages(null)
        destroyErrorWebViewOnly()
    }

    private fun handleMainFrameFailure(failedUrl: String?) {
        pendingAttemptFailed = true
        if (!failedUrl.isNullOrBlank() && !failedUrl.equals("about:blank", ignoreCase = true)) {
            lastFailedUrl = failedUrl
            trackUrl(failedUrl)
        } else if (lastFailedUrl.isNullOrBlank()) {
            lastFailedUrl = lastRequestedUrl
        }

        mainHandler.post {
            if (released) return@post
            if (errorWebView != null) {
                if (isRetrying) {
                    isRetrying = false
                    setOverlayRetryLoading(false, "加载失败，请检查网络后重试")
                }
                return@post
            }
            isRetrying = false
            showErrorOverlay()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun showErrorOverlay() {
        if (released || errorWebView != null) return

        val dark = isDarkModeProvider()
        contentWebView.visibility = View.INVISIBLE

        val overlay = WebView(contentContainer.context).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            setBackgroundColor(
                Color.parseColor(if (dark) BG_DARK_HEX else BG_LIGHT_HEX),
            )
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                loadWithOverviewMode = true
                useWideViewPort = true
            }
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    view?.let { injectOverlayState(it) }
                }
            }
            addJavascriptInterface(
                ErrorOverlayBridge(this@WebPageErrorOverlayController),
                JS_INTERFACE_NAME,
            )
        }

        errorWebView = overlay
        contentContainer.addView(overlay)
        overlay.loadUrl(buildErrorPageUrl(hasNativeHeaderBar, dark))
    }

    private fun hideErrorAndDestroyOverlay() {
        mainHandler.post {
            if (released) return@post
            isRetrying = false
            contentWebView.visibility = View.VISIBLE
            destroyErrorWebViewOnly()
        }
    }

    private fun destroyErrorWebViewOnly() {
        val overlay = errorWebView ?: return
        errorWebView = null
        (overlay.parent as? ViewGroup)?.removeView(overlay)
        overlay.removeJavascriptInterface(JS_INTERFACE_NAME)
        overlay.apply {
            stopLoading()
            loadUrl("about:blank")
            removeAllViews()
            destroy()
        }
    }

    private fun handleRetryFromJs() {
        if (released || isRetrying) return
        val targetUrl = lastFailedUrl?.takeIf { it.isNotBlank() }
            ?: lastRequestedUrl?.takeIf { it.isNotBlank() }
            ?: contentWebView.url?.takeIf {
                it.startsWith("http://", ignoreCase = true) ||
                    it.startsWith("https://", ignoreCase = true)
            }
        if (targetUrl.isNullOrBlank()) {
            setOverlayRetryLoading(false, "无法获取原网页地址")
            return
        }
        isRetrying = true
        pendingAttemptFailed = false
        onRetryRequest(targetUrl)
    }

    private fun handleCloseFromJs() {
        if (released) return
        onClosePage()
    }

    private fun setOverlayRetryLoading(loading: Boolean, tipMessage: String? = null) {
        val overlay = errorWebView ?: return
        val escapedTip = tipMessage
            ?.replace("\\", "\\\\")
            ?.replace("'", "\\'")
            ?.let { "'$it'" }
            ?: "null"
        overlay.post {
            if (!released && errorWebView === overlay) {
                overlay.evaluateJavascript(
                    "(function(){if(window.pmErrorPageSetRetryLoading)window.pmErrorPageSetRetryLoading($loading,$escapedTip);})();",
                    null,
                )
            }
        }
    }

    private fun injectOverlayState(overlay: WebView) {
        val topPx = String.format(Locale.US, "%.2fpx", statusBarCssPxProvider())
        val bottomPx = String.format(Locale.US, "%.2fpx", navigationBarCssPxProvider())
        val dark = isDarkModeProvider()
        val js = """
            (function() {
              var root = document.documentElement;
              if (root && root.style) {
                root.style.setProperty('--status-bar-height', '$topPx');
                root.style.setProperty('--navigation-bar-height', '$bottomPx');
                root.style.setProperty('--android-status-bar-height', '$topPx');
                root.style.setProperty('--android-navigation-bar-height', '$bottomPx');
              }
              if (typeof window.pmErrorPageSetTheme === 'function') {
                window.pmErrorPageSetTheme($dark);
              }
              if (typeof window.pmErrorPageSetHeaderBar === 'function') {
                window.pmErrorPageSetHeaderBar($hasNativeHeaderBar);
              }
            })();
        """.trimIndent()
        overlay.post {
            if (!released && errorWebView === overlay) {
                overlay.evaluateJavascript(js, null)
            }
        }
    }

    private fun buildSafeAreaJson(): String {
        return String.format(
            Locale.US,
            "{\"statusBarHeight\":%.2f,\"navigationBarHeight\":%.2f}",
            statusBarCssPxProvider(),
            navigationBarCssPxProvider(),
        )
    }

    @Keep
    private class ErrorOverlayBridge(controller: WebPageErrorOverlayController) {
        private val ref = WeakReference(controller)

        @JavascriptInterface
        fun hasHeaderBar(): Boolean {
            return ref.get()?.hasNativeHeaderBar ?: false
        }

        @JavascriptInterface
        fun isDarkMode(): Boolean {
            return ref.get()?.isDarkModeProvider?.invoke() ?: false
        }

        @JavascriptInterface
        fun verifyHostAccess(nonce: String?): String {
            return WebHostBridgeSecurity.signChallenge(nonce)
        }

        @JavascriptInterface
        fun reload() {
            val ctrl = ref.get() ?: return
            ctrl.mainHandler.post { ctrl.handleRetryFromJs() }
        }

        @JavascriptInterface
        fun retry() {
            reload()
        }

        @JavascriptInterface
        fun close() {
            val ctrl = ref.get() ?: return
            ctrl.mainHandler.post { ctrl.handleCloseFromJs() }
        }

        @JavascriptInterface
        fun closePage() {
            close()
        }

        @JavascriptInterface
        fun navigateBack() {
            close()
        }

        @JavascriptInterface
        fun getSafeAreaInsets(): String {
            return ref.get()?.buildSafeAreaJson() ?: "{}"
        }
    }

    companion object {
        const val ASSET_URL = "file:///android_asset/error/error.html"
        private const val JS_INTERFACE_NAME = "AndroidWebHost"
        private const val BG_LIGHT_HEX = "#f7f9fc"
        private const val BG_DARK_HEX = "#0b1120"

        fun buildErrorPageUrl(hasNativeHeaderBar: Boolean, isDark: Boolean): String {
            val headerFlag = if (hasNativeHeaderBar) "1" else "0"
            val themeFlag = if (isDark) "dark" else "light"
            return "$ASSET_URL?nativeHeader=$headerFlag&theme=$themeFlag"
        }
    }
}
