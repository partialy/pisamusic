package cn.partialy.pm.activity

import android.annotation.SuppressLint
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
import androidx.core.graphics.toColorInt
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityLyricColorPresetsBinding
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.player.lyricstyle.ColorPresetOpResult
import cn.partialy.pm.ui.player.lyricstyle.LyricColorPresetRegistry
import cn.partialy.pm.ui.player.lyricstyle.LyricEffectStyleId
import cn.partialy.pm.ui.player.lyricstyle.LyricStyleColorPresetsRepository
import cn.partialy.pm.ui.player.lyricstyle.LyricStyleParamsMeta
import cn.partialy.pm.utils.LyricDisplayPrefs
import org.json.JSONArray
import org.json.JSONObject

class LyricColorPresetsActivity : BaseActivity() {
    private lateinit var binding: ActivityLyricColorPresetsBinding
    private var styleId: LyricEffectStyleId = LyricEffectStyleId.DEFAULT
    private var focusSlotKey: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLyricColorPresetsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        styleId = LyricEffectStyleId.fromId(intent.getStringExtra(EXTRA_STYLE_ID))
        focusSlotKey = intent.getStringExtra(EXTRA_FOCUS_SLOT_KEY)?.takeIf { it.isNotBlank() }

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
        supportActionBar?.title = if (styleId == LyricEffectStyleId.DEFAULT) {
            getString(R.string.settings_lyric_color_presets_title)
        } else {
            val label = LyricStyleParamsMeta.styleLabel(this, styleId)
            getString(R.string.lyric_color_presets_style_title, label)
        }
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
        wv.addJavascriptInterface(
            LyricColorPresetsBridge(this, styleId, focusSlotKey),
            "AndroidLyricColors",
        )
        wv.loadUrl("file:///android_asset/lyric_color_presets/index.html")
    }

    override fun onDestroy() {
        binding.lyricColorWebView.removeJavascriptInterface("AndroidLyricColors")
        binding.lyricColorWebView.loadUrl("about:blank")
        super.onDestroy()
    }

    companion object {
        private const val EXTRA_STYLE_ID = "extra_style_id"
        private const val EXTRA_FOCUS_SLOT_KEY = "extra_focus_slot_key"

        fun start(
            context: Context,
            styleId: LyricEffectStyleId = LyricEffectStyleId.DEFAULT,
            focusSlotKey: String? = null,
        ) {
            val intent = Intent(context, LyricColorPresetsActivity::class.java).apply {
                putExtra(EXTRA_STYLE_ID, styleId.id)
                if (!focusSlotKey.isNullOrBlank()) {
                    putExtra(EXTRA_FOCUS_SLOT_KEY, focusSlotKey)
                }
            }
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }
}

/**
 * 必须 public，供 WebView JavascriptInterface 绑定。
 */
@Keep
class LyricColorPresetsBridge(
    context: Context,
    private val styleId: LyricEffectStyleId = LyricEffectStyleId.DEFAULT,
    private val focusSlotKey: String? = null,
) {
    private val appContext = context.applicationContext

    @JavascriptInterface
    fun getState(): String {
        val slots = LyricColorPresetRegistry.slotsFor(styleId)
        val slotsJson = JSONArray()
        slots.forEach { spec ->
            val colors = LyricStyleColorPresetsRepository.getPresets(appContext, styleId, spec.slotKey)
            val colorHexArray = JSONArray(
                colors.map { c ->
                    if (spec.allowAlpha) colorToHexArgb(c) else colorToHexRgb(c)
                },
            )
            slotsJson.put(
                JSONObject().apply {
                    put("slotKey", spec.slotKey)
                    put("title", LyricColorPresetRegistry.slotTitle(appContext, spec))
                    put("allowAlpha", spec.allowAlpha)
                    put(
                        "defaultColor",
                        if (spec.allowAlpha) colorToHexArgb(spec.defaultColor) else colorToHexRgb(spec.defaultColor),
                    )
                    put("colors", colorHexArray)
                },
            )
        }
        return JSONObject().apply {
            put("styleId", styleId.id)
            put("styleLabel", LyricStyleParamsMeta.styleLabel(appContext, styleId))
            put("focusSlotKey", focusSlotKey.orEmpty())
            put("maxCount", LyricDisplayPrefs.PRESET_MAX_COUNT)
            put("rowSize", LyricDisplayPrefs.PRESET_ROW_SIZE)
            put("slots", slotsJson)
        }.toString()
    }

    @JavascriptInterface
    fun addColor(slotKey: String, hex: String): String {
        val spec = LyricColorPresetRegistry.findSlot(styleId, slotKey)
            ?: return jsonErr(appContext.getString(R.string.lyric_color_slot_invalid))
        val parsed = parseHexColor(hex, forceOpaqueRgb = !spec.allowAlpha)
            ?: return jsonErr(appContext.getString(R.string.lyric_color_invalid))
        return toJsonResult(LyricStyleColorPresetsRepository.addPreset(appContext, styleId, slotKey, parsed))
    }

    @JavascriptInterface
    fun removeColor(slotKey: String, hex: String): String {
        val spec = LyricColorPresetRegistry.findSlot(styleId, slotKey)
            ?: return jsonErr(appContext.getString(R.string.lyric_color_slot_invalid))
        val parsed = parseHexColor(hex, forceOpaqueRgb = !spec.allowAlpha)
            ?: return jsonErr(appContext.getString(R.string.lyric_color_invalid))
        return toJsonResult(LyricStyleColorPresetsRepository.removePreset(appContext, styleId, slotKey, parsed))
    }

    @JavascriptInterface
    fun updateColor(slotKey: String, indexStr: String, hex: String): String {
        val spec = LyricColorPresetRegistry.findSlot(styleId, slotKey)
            ?: return jsonErr(appContext.getString(R.string.lyric_color_slot_invalid))
        val idx = indexStr.toIntOrNull()
            ?: return jsonErr(appContext.getString(R.string.lyric_color_index_invalid))
        val parsed = parseHexColor(hex, forceOpaqueRgb = !spec.allowAlpha)
            ?: return jsonErr(appContext.getString(R.string.lyric_color_invalid))
        return toJsonResult(LyricStyleColorPresetsRepository.updatePreset(appContext, styleId, slotKey, idx, parsed))
    }

    private fun toJsonResult(res: ColorPresetOpResult): String =
        if (res.ok) jsonOk() else jsonErr(res.errorMessage)

    private fun jsonOk(): String = JSONObject().put("ok", true).put("message", "").toString()

    private fun jsonErr(msg: String): String = JSONObject().put("ok", false).put("message", msg).toString()

    private fun colorToHexRgb(color: Int): String {
        val rgb = 0xFFFFFF and color
        return String.format("#%06X", rgb)
    }

    private fun colorToHexArgb(color: Int): String {
        return String.format("#%08X", (color.toLong() and 0xFFFFFFFFL))
    }

    private fun parseHexColor(raw: String, forceOpaqueRgb: Boolean): Int? {
        val t = raw.trim()
        val withHash = if (t.startsWith("#")) t else "#$t"
        val parsed = runCatching { withHash.toColorInt() }.getOrNull() ?: return null
        return if (forceOpaqueRgb) {
            Color.rgb(Color.red(parsed), Color.green(parsed), Color.blue(parsed))
        } else {
            parsed
        }
    }
}
