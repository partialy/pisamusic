package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.content.pm.PackageManager
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.Keep
import androidx.core.content.ContextCompat
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityWebContentBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.ServerDevicePrefs
import androidx.core.view.updatePadding
import dagger.hilt.android.AndroidEntryPoint
import java.lang.ref.WeakReference
import javax.inject.Inject
import javax.inject.Named
import org.json.JSONObject

/**
 * 意见反馈：复用 [R.layout.activity_web_content]，本地 [FEEDBACK_ASSET_URL]。
 */
@AndroidEntryPoint
class FeedbackWebActivity : BaseActivity() {

    private lateinit var binding: ActivityWebContentBinding

    @Inject
    @Named("system_api_base_url")
    lateinit var systemApiBaseUrl: String

    private var uploadCallback: ValueCallback<Array<Uri>>? = null

    private val pickImagesLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val cb = uploadCallback
            uploadCallback = null
            if (cb == null) return@registerForActivityResult
            if (result.resultCode != RESULT_OK) {
                cb.onReceiveValue(null)
                return@registerForActivityResult
            }
            val data = result.data
            val list = mutableListOf<Uri>()
            val clip = data?.clipData
            if (clip != null) {
                val n = minOf(clip.itemCount, 3)
                for (i in 0 until n) {
                    list.add(clip.getItemAt(i).uri)
                }
            } else if (data?.data != null) {
                list.add(data.data!!)
            }
            cb.onReceiveValue(if (list.isEmpty()) null else list.toTypedArray())
        }

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
        supportActionBar?.title = getString(R.string.feedback_title)
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
        val pageBg = ContextCompat.getColor(this, R.color.home_page_bg)
        wv.setBackgroundColor(pageBg)
        binding.webContentRoot.setBackgroundColor(pageBg)
        binding.statusBarSpacer.setBackgroundColor(pageBg)
        binding.toolbar.setBackgroundColor(pageBg)

        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            loadWithOverviewMode = true
            useWideViewPort = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        wv.webViewClient = WebViewClient()
        wv.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
            ): Boolean {
                uploadCallback?.onReceiveValue(null)
                uploadCallback = filePathCallback
                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "image/*"
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                pickImagesLauncher.launch(
                    Intent.createChooser(intent, getString(R.string.feedback_pick_image)),
                )
                return true
            }
        }
        wv.addJavascriptInterface(FeedbackJsBridge(this, systemApiBaseUrl), JS_INTERFACE_NAME)

        val theme = if (isNight) "dark" else "light"
        wv.loadUrl("file:///android_asset/web/feedback.html?theme=$theme")
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
        private const val JS_INTERFACE_NAME = "AndroidFeedbackHost"
        const val FEEDBACK_ASSET_URL = "file:///android_asset/web/feedback.html"

        fun start(context: Context) {
            context.startActivity(Intent(context, FeedbackWebActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}

@Keep
private class FeedbackJsBridge(
    activity: FeedbackWebActivity,
    private val systemApiBaseUrl: String,
) {
    private val ref = WeakReference(activity)

    @JavascriptInterface
    fun getDeviceMeta(): String {
        val a = ref.get() ?: return "{}"
        return runCatching {
            val pi = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                a.packageManager.getPackageInfo(
                    a.packageName,
                    PackageManager.PackageInfoFlags.of(0L),
                )
            } else {
                @Suppress("DEPRECATION")
                a.packageManager.getPackageInfo(a.packageName, 0)
            }
            val vc = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                pi.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                pi.versionCode.toLong()
            }
            JSONObject().apply {
                put("manufacturer", Build.MANUFACTURER ?: "")
                put("brand", Build.BRAND ?: "")
                put("model", Build.MODEL ?: "")
                put("device", Build.DEVICE ?: "")
                put("product", Build.PRODUCT ?: "")
                put("display", Build.DISPLAY ?: "")
                put("sdkInt", Build.VERSION.SDK_INT)
                put("release", Build.VERSION.RELEASE ?: "")
                put("versionName", pi.versionName ?: "")
                put("versionCode", vc)
                put("packageName", a.packageName ?: "")
                put("serverDeviceId", ServerDevicePrefs.getDeviceId(a))
            }.toString()
        }.getOrDefault("{}")
    }

    @JavascriptInterface
    fun getFeedbackApiUrl(): String {
        val base = systemApiBaseUrl.trimEnd('/')
        return "$base/api/feedback"
    }

    @JavascriptInterface
    fun onSubmitResult(success: Boolean, message: String?) {
        val a = ref.get() ?: return
        a.runOnUiThread {
            val text = message?.takeIf { it.isNotBlank() }
                ?: a.getString(if (success) R.string.feedback_submitted else R.string.feedback_submit_failed)
            Toast.makeText(a, text, Toast.LENGTH_SHORT).show()
            if (success) {
                a.finish()
            }
        }
    }
}
