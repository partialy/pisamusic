package cn.partialy.pm.ui.discover

import android.annotation.SuppressLint
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.Keep
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.updatePadding
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.FeedbackWebActivity
import cn.partialy.pm.activity.MainActivity
import cn.partialy.pm.activity.SearchActivity
import cn.partialy.pm.databinding.FragmentDiscoverBinding
import cn.partialy.pm.network.repository.SystemRepository
import cn.partialy.pm.ui.web.LocalGenericErrorWebViewController
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@AndroidEntryPoint
class DiscoverFragment : Fragment() {

    @Inject
    lateinit var systemRepository: SystemRepository

    private var _binding: FragmentDiscoverBinding? = null
    private val binding get() = _binding!!
    private var errorController: LocalGenericErrorWebViewController? = null
    private var currentDiscoverUrl: String? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?,
    ): View {
        _binding = FragmentDiscoverBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupInsets(view)
        setupHeaderActions()
        setupWebView()
        loadDiscover()
    }

    override fun onResume() {
        super.onResume()
        applySystemBarIconStyle()
    }

    private fun setupInsets(view: View) {
        val baseHeaderHeightPx = resources.getDimensionPixelSize(R.dimen.home_header_bar_height)
        ViewCompat.setOnApplyWindowInsetsListener(binding.discoverHeaderBar) { v, insets ->
            val top = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top
            v.layoutParams = v.layoutParams.apply { height = baseHeaderHeightPx + top }
            binding.discoverHeaderContent.updatePadding(top = top)
            insets
        }
        ViewCompat.requestApplyInsets(view)
        applySystemBarIconStyle()
    }

    private fun applySystemBarIconStyle() {
        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        val controller = WindowInsetsControllerCompat(requireActivity().window, requireView())
        controller.isAppearanceLightStatusBars = !isNight
        controller.isAppearanceLightNavigationBars = !isNight
    }

    private fun setupHeaderActions() {
        binding.discoverMenuButton.setOnClickListener {
            (activity as? MainActivity)?.openMainDrawer()
        }
        binding.discoverSearchButton.setOnClickListener {
            SearchActivity.start(requireActivity())
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val pageBg = ContextCompat.getColor(requireContext(), R.color.home_page_bg)
        binding.discoverRoot.setBackgroundColor(pageBg)
        binding.discoverWebView.setBackgroundColor(pageBg)
        binding.discoverWebView.apply {
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            overScrollMode = View.OVER_SCROLL_NEVER
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                loadWithOverviewMode = true
                useWideViewPort = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }
            CookieManager.getInstance().setAcceptCookie(true)
            webChromeClient = WebChromeClient()
            addJavascriptInterface(DiscoverBridge(), JS_INTERFACE_NAME)
        }
        errorController = LocalGenericErrorWebViewController(
            webView = binding.discoverWebView,
            onRetry = { loadDiscover(forceRefresh = true) },
            onFeedback = { FeedbackWebActivity.start(requireContext()) },
        )
    }

    private fun loadDiscover(forceRefresh: Boolean = false) {
        val cached = currentDiscoverUrl
        if (!forceRefresh && cached != null) {
            loadUrlOrShowError(cached)
            return
        }
        lifecycleScope.launch {
            val url = withContext(Dispatchers.IO) {
                systemRepository.getDiscover().getOrNull()
                    ?.takeIf { it.success && it.code == 0 }
                    ?.data
                    ?.url
                    ?.trim()
                    .orEmpty()
            }
            if (_binding == null) return@launch
            if (url.isBlank()) {
                showErrorPage()
            } else {
                currentDiscoverUrl = url
                loadUrlOrShowError(url)
            }
        }
    }

    private fun loadUrlOrShowError(url: String) {
        val targetUrl = if (url == USE_LOCAL_FILE) {
            LOCAL_DISCOVER_ASSET_URL
        } else {
            url
        }
        if (!isSupportedUrl(targetUrl)) {
            showErrorPage()
            return
        }
        val webView = binding.discoverWebView
        errorController?.detach()
        webView.setBackgroundColor(ContextCompat.getColor(requireContext(), R.color.home_page_bg))
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val scheme = request.url.scheme?.lowercase()
                return scheme != "http" && scheme != "https" && scheme != "file"
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError,
            ) {
                super.onReceivedError(view, request, error)
                if (request.isForMainFrame) showErrorPage()
            }

            override fun onReceivedHttpError(
                view: WebView,
                request: WebResourceRequest,
                errorResponse: WebResourceResponse,
            ) {
                super.onReceivedHttpError(view, request, errorResponse)
                if (request.isForMainFrame && errorResponse.statusCode >= 400) {
                    showErrorPage()
                }
            }
        }
        webView.loadUrl(targetUrl)
    }

    private fun showErrorPage() {
        val webView = _binding?.discoverWebView ?: return
        webView.stopLoading()
        webView.setBackgroundColor(
            if ((resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES) {
                Color.parseColor("#17191d")
            } else {
                Color.parseColor("#fefefe")
            },
        )
        errorController?.attach()
        errorController?.resetRetryUi()
    }

    private fun isSupportedUrl(raw: String): Boolean {
        val uri = Uri.parse(raw)
        val scheme = uri.scheme?.lowercase()
        return scheme == "http" || scheme == "https" || scheme == "file"
    }

    override fun onDestroyView() {
        errorController?.detach()
        errorController = null
        binding.discoverWebView.removeJavascriptInterface(JS_INTERFACE_NAME)
        binding.discoverWebView.apply {
            stopLoading()
            loadUrl("about:blank")
            removeAllViews()
            destroy()
        }
        _binding = null
        super.onDestroyView()
    }

    companion object {
        private const val JS_INTERFACE_NAME = "AndroidDiscoverHost"
        private const val USE_LOCAL_FILE = "USE_LOCAL_FILE"
        private const val LOCAL_DISCOVER_ASSET_URL = "file:///android_asset/discover/index.html"
    }
}

@Keep
private class DiscoverBridge
