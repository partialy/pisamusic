package cn.partialy.pm.activity

import cn.partialy.pm.ui.message.PmMessage

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityWyWebPlaylistLoginBinding
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.web.WebPageErrorOverlayController
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 在 WebView 中打开网易云移动站登录，用户登录后通过工具栏「导入 Cookie」写入 [WyCookieRepository]。
 */
@AndroidEntryPoint
class WyWebPlaylistLoginActivity : BaseActivity() {

    @Inject
    lateinit var wyCookieRepository: WyCookieRepository

    private lateinit var binding: ActivityWyWebPlaylistLoginBinding
    private var errorOverlayController: WebPageErrorOverlayController? = null

    private fun currentIsDarkMode(): Boolean {
        return (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityWyWebPlaylistLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight = currentIsDarkMode()
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.wyWebPlaylistLoginRoot.applySystemBarsInsets { insets ->
            val lp = binding.wyWebLoginStatusBarSpacer.layoutParams
            lp.height = insets.top
            binding.wyWebLoginStatusBarSpacer.layoutParams = lp
            binding.wyWebContainer.updatePadding(bottom = insets.bottom)
        }

        setSupportActionBar(binding.wyWebToolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.wyWebToolbar.setNavigationOnClickListener { navigateBackInWebOrFinish() }
        binding.wyWebToolbar.title = getString(R.string.drawer_wy_web_login_title)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    navigateBackInWebOrFinish()
                }
            },
        )

        val wv = binding.wyWebView
        errorOverlayController = WebPageErrorOverlayController(
            contentContainer = binding.wyWebContainer,
            contentWebView = wv,
            hasNativeHeaderBar = true,
            isDarkModeProvider = { currentIsDarkMode() },
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
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                errorOverlayController?.onMainPageStarted(url)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
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
        errorOverlayController?.trackUrl(WY_LOGIN_URL)
        wv.loadUrl(WY_LOGIN_URL)
    }

    override fun onCreateOptionsMenu(menu: Menu): Boolean {
        menuInflater.inflate(R.menu.menu_wy_web_login, menu)
        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean {
        if (item.itemId == R.id.action_import_cookie) {
            importCookiesFromWebView()
            return true
        }
        return super.onOptionsItemSelected(item)
    }

    /** 系统返回键与 Toolbar 返回：错误页展示时直接关闭，否则优先 WebView 历史。 */
    private fun navigateBackInWebOrFinish() {
        if (!::binding.isInitialized || errorOverlayController?.isErrorVisible == true) {
            finish()
            return
        }
        val wv = binding.wyWebView
        if (wv.canGoBack()) {
            wv.goBack()
        } else {
            finish()
        }
    }

    private var completingImport = false

    private fun importCookiesFromWebView() {
        if (completingImport) return
        val cm = CookieManager.getInstance()
        val chunks = listOf(
            cm.getCookie("https://music.163.com"),
            cm.getCookie("https://interface.music.163.com"),
        ).mapNotNull { it?.trim()?.takeIf { s -> s.isNotEmpty() } }
        if (chunks.isEmpty()) {
            PmMessage.warning(this, R.string.drawer_wy_web_cookie_empty)
            return
        }
        completingImport = true
        lifecycleScope.launch {
            wyCookieRepository.saveLoginSession(chunks.joinToString("; "))
                .onSuccess {
                    cn.partialy.pm.ui.message.PmMessageFlow.showSuccessThenFinish(
                        this@WyWebPlaylistLoginActivity,
                        getString(R.string.playlist_import_cookie_saved),
                    )
                }
                .onFailure { e ->
                    completingImport = false
                    PmMessage.error(
                        this@WyWebPlaylistLoginActivity,
                        e.message ?: getString(R.string.drawer_wy_web_cookie_empty),
                    )
                }
        }
    }

    override fun finish() {
        super.finish()
        PlaylistLoginNavTransitions.applyCloseAfterFinish(this)
    }

    override fun onDestroy() {
        errorOverlayController?.destroy()
        errorOverlayController = null
        if (::binding.isInitialized) {
            binding.wyWebView.apply {
                stopLoading()
                loadUrl("about:blank")
                removeAllViews()
                destroy()
            }
        }
        super.onDestroy()
    }

    companion object {
        private const val WY_LOGIN_URL = "https://music.163.com/m/login"

        fun start(context: Context) {
            context.startActivity(Intent(context, WyWebPlaylistLoginActivity::class.java))
            PlaylistLoginNavTransitions.applyOpenFromCaller(context)
        }
    }
}
