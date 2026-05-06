package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.content.res.Configuration
import android.view.Menu
import android.view.MenuItem
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityWyWebPlaylistLoginBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import androidx.core.view.updatePadding
import cn.partialy.pm.network.cookie.WyCookieRepository
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * 在 WebView 中打开网易云移动站登录，用户登录后通过工具栏「导入 Cookie」写入 [WyCookieRepository]。
 */
@AndroidEntryPoint
class WyWebPlaylistLoginActivity : BaseActivity() {

    @Inject
    lateinit var wyCookieRepository: WyCookieRepository

    private lateinit var binding: ActivityWyWebPlaylistLoginBinding

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityWyWebPlaylistLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.wyWebPlaylistLoginRoot.applySystemBarsInsets { insets ->
            val lp = binding.wyWebLoginStatusBarSpacer.layoutParams
            lp.height = insets.top
            binding.wyWebLoginStatusBarSpacer.layoutParams = lp
            binding.wyWebView.updatePadding(bottom = insets.bottom)
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
        CookieManager.getInstance().setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true)
        }
        wv.settings.javaScriptEnabled = true
        wv.settings.domStorageEnabled = true
        wv.webViewClient = WebViewClient()
        wv.loadUrl("https://music.163.com/m/login")
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

    /** 系统返回键与 Toolbar 返回：优先 WebView 历史，否则关闭页面。 */
    private fun navigateBackInWebOrFinish() {
        if (!::binding.isInitialized) {
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

    private fun importCookiesFromWebView() {
        val cm = CookieManager.getInstance()
        val chunks = listOf(
            cm.getCookie("https://music.163.com"),
            cm.getCookie("https://interface.music.163.com"),
        ).mapNotNull { it?.trim()?.takeIf { s -> s.isNotEmpty() } }
        if (chunks.isEmpty()) {
            Toast.makeText(this, R.string.drawer_wy_web_cookie_empty, Toast.LENGTH_SHORT).show()
            return
        }
        wyCookieRepository.setCookie(chunks.joinToString("; "))
        Toast.makeText(this, R.string.playlist_import_cookie_saved, Toast.LENGTH_SHORT).show()
        finish()
    }

    override fun finish() {
        super.finish()
        PlaylistLoginNavTransitions.applyCloseAfterFinish(this)
    }

    override fun onDestroy() {
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
        fun start(context: Context) {
            context.startActivity(Intent(context, WyWebPlaylistLoginActivity::class.java))
            PlaylistLoginNavTransitions.applyOpenFromCaller(context)
        }
    }
}
