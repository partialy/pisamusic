package cn.partialy.pm.activity

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.annotation.Keep
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityLyricColorPresetsBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.LyricDisplayPrefs
import org.json.JSONArray
import org.json.JSONObject
import androidx.core.graphics.toColorInt

class LyricColorPresetsActivity : BaseActivity() {
    private lateinit var binding: ActivityLyricColorPresetsBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLyricColorPresetsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setupSystemBars()
        setupToolbar()
        setupWebView()
    }

    private fun setupSystemBars() {
        val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = !isNight, lightNavigationBarIcons = !isNight)
        binding.lyricColorPresetsRoot.applySystemBarsInsets { insets ->
            val lp = binding.statusBarSpacer.layoutParams
            lp.height = insets.top
            binding.statusBarSpacer.layoutParams = lp
            binding.lyricColorWebView.setPadding(
                binding.lyricColorWebView.paddingLeft,
                binding.lyricColorWebView.paddingTop,
                binding.lyricColorWebView.paddingRight,
                insets.bottom,
            )
        }
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val wv = binding.lyricColorWebView
        wv.isVerticalScrollBarEnabled = false
        wv.isHorizontalScrollBarEnabled = false
        wv.overScrollMode = WebView.OVER_SCROLL_NEVER
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }
        wv.webChromeClient = WebChromeClient()
        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val u = request.url.toString()
                if (u.startsWith("file:///android_asset/")) return false
                if (u.startsWith("https://") || u.startsWith("http://")) return false
                return true
            }
        }
        wv.addJavascriptInterface(LyricColorPresetsBridge(this), "AndroidLyricColors")
        wv.loadUrl("file:///android_asset/lyric_color_presets/index.html")
    }

    override fun onDestroy() {
        binding.lyricColorWebView.removeJavascriptInterface("AndroidLyricColors")
        binding.lyricColorWebView.loadUrl("about:blank")
        super.onDestroy()
    }

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, LyricColorPresetsActivity::class.java))
            (context as? Activity)?.overridePendingTransition(R.anim.slide_to_left, R.anim.dim_and_scale_out)
        }
    }

    override fun finish() {
        super.finish()
        overridePendingTransition(R.anim.dim_and_scale_in, R.anim.slide_to_right)
    }
}

/**
 * 必须 public，供 WebView JavascriptInterface 绑定。
 */
@Keep
class LyricColorPresetsBridge(
    context: Context,
) {
    private val appContext = context.applicationContext

    @JavascriptInterface
    fun getState(): String {
        val normal = LyricDisplayPrefs.getNormalColorRgbPresets(appContext)
        val current = LyricDisplayPrefs.getCurrentColorArgbPresets(appContext)
        return JSONObject().apply {
            put("maxCount", LyricDisplayPrefs.PRESET_MAX_COUNT)
            put("rowSize", LyricDisplayPrefs.PRESET_ROW_SIZE)
            put("normal", JSONArray(normal.map { colorToHexRgb(it) }))
            put("current", JSONArray(current.map { colorToHexArgb(it) }))
        }.toString()
    }

    @JavascriptInterface
    fun addNormal(hex: String): String {
        val c = parseHexColor(hex, forceOpaqueRgb = true) ?: return jsonErr("颜色格式无效")
        val list = LyricDisplayPrefs.getNormalColorRgbPresets(appContext)
        if (list.size >= LyricDisplayPrefs.PRESET_MAX_COUNT) {
            return jsonErr("已达上限（最多 ${LyricDisplayPrefs.PRESET_MAX_COUNT} 个）")
        }
        if (list.any { it == c }) return jsonErr("颜色已存在")
        val ok = LyricDisplayPrefs.addNormalColorRgbPreset(appContext, c)
        if (ok) LyricDisplayPrefs.ensureStyleColorsMatchPresets(appContext)
        return if (ok) jsonOk() else jsonErr("无法添加")
    }

    @JavascriptInterface
    fun addCurrent(hex: String): String {
        val c = parseHexColor(hex, forceOpaqueRgb = false) ?: return jsonErr("颜色格式无效")
        val list = LyricDisplayPrefs.getCurrentColorArgbPresets(appContext)
        if (list.size >= LyricDisplayPrefs.PRESET_MAX_COUNT) {
            return jsonErr("已达上限（最多 ${LyricDisplayPrefs.PRESET_MAX_COUNT} 个）")
        }
        if (list.any { it == c }) return jsonErr("颜色已存在")
        val ok = LyricDisplayPrefs.addCurrentColorArgbPreset(appContext, c)
        if (ok) LyricDisplayPrefs.ensureStyleColorsMatchPresets(appContext)
        return if (ok) jsonOk() else jsonErr("无法添加")
    }

    @JavascriptInterface
    fun removeNormal(hex: String): String {
        val c = parseHexColor(hex, forceOpaqueRgb = true) ?: return jsonErr("颜色格式无效")
        val ok = LyricDisplayPrefs.removeNormalColorRgbPreset(appContext, c)
        if (ok) LyricDisplayPrefs.ensureStyleColorsMatchPresets(appContext)
        return if (ok) jsonOk() else jsonErr("至少保留一个颜色")
    }

    @JavascriptInterface
    fun removeCurrent(hex: String): String {
        val c = parseHexColor(hex, forceOpaqueRgb = false) ?: return jsonErr("颜色格式无效")
        val ok = LyricDisplayPrefs.removeCurrentColorArgbPreset(appContext, c)
        if (ok) LyricDisplayPrefs.ensureStyleColorsMatchPresets(appContext)
        return if (ok) jsonOk() else jsonErr("至少保留一个颜色")
    }

    @JavascriptInterface
    fun updateNormal(indexStr: String, hex: String): String {
        val idx = indexStr.toIntOrNull() ?: return jsonErr("索引无效")
        val c = parseHexColor(hex, forceOpaqueRgb = true) ?: return jsonErr("颜色格式无效")
        val ok = LyricDisplayPrefs.updateNormalColorRgbPreset(appContext, idx, c)
        if (ok) LyricDisplayPrefs.ensureStyleColorsMatchPresets(appContext)
        return if (ok) jsonOk() else jsonErr("更新失败")
    }

    @JavascriptInterface
    fun updateCurrent(indexStr: String, hex: String): String {
        val idx = indexStr.toIntOrNull() ?: return jsonErr("索引无效")
        val c = parseHexColor(hex, forceOpaqueRgb = false) ?: return jsonErr("颜色格式无效")
        val ok = LyricDisplayPrefs.updateCurrentColorArgbPreset(appContext, idx, c)
        if (ok) LyricDisplayPrefs.ensureStyleColorsMatchPresets(appContext)
        return if (ok) jsonOk() else jsonErr("更新失败")
    }

    private fun jsonOk(): String = JSONObject().put("ok", true).put("message", "").toString()

    private fun jsonErr(msg: String): String = JSONObject().put("ok", false).put("message", msg).toString()

    private fun colorToHexRgb(color: Int): String {
        val rgb = 0xFFFFFF and color
        return String.format("#%06X", rgb)
    }

    private fun colorToHexArgb(color: Int): String {
        return String.format("#%08X", (color.toLong() and 0xFFFFFFFFL))
    }

    private fun parseHexColor(hex: String, forceOpaqueRgb: Boolean): Int? {
        var s = hex.trim()
        if (!s.startsWith("#")) s = "#$s"
        return try {
            val parsed = s.toColorInt()
            if (forceOpaqueRgb) {
                Color.rgb(Color.red(parsed), Color.green(parsed), Color.blue(parsed))
            } else {
                parsed
            }
        } catch (_: IllegalArgumentException) {
            null
        }
    }
}
