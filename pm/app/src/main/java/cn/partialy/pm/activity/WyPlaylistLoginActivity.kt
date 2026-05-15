package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.BitmapFactory
import android.graphics.Typeface
import android.os.Bundle
import android.util.Base64
import android.view.View
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityWyPlaylistLoginBinding
import cn.partialy.pm.databinding.IncludePlaylistImportKgLoginBinding
import cn.partialy.pm.network.CookieRequest
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.network.cookie.WyQrCheckEnvelope
import cn.partialy.pm.network.cookie.WyQrCreateEnvelope
import cn.partialy.pm.network.cookie.WyQrKeyEnvelope
import cn.partialy.pm.network.wy.WyApiService
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import com.google.android.material.color.MaterialColors
import com.google.gson.Gson
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.Response
import javax.inject.Inject

/**
 * 网易云歌单导入登录：手机验证码 + 扫码，布局复用 [R.layout.include_playlist_import_kg_login]，
 * 接口与 music-login-hub [musicApi.ts] / [App.tsx] 一致（网关 [WyCookieRepository.API_BASE]，query 带 realIP）。
 */
@AndroidEntryPoint
class WyPlaylistLoginActivity : BaseActivity() {

    @Inject
    lateinit var wyCookieRepository: WyCookieRepository

    @Inject
    lateinit var wyApiService: WyApiService

    private lateinit var binding: ActivityWyPlaylistLoginBinding
    private val wyGson = Gson()
    private var wyQrPollJob: Job? = null
    private var wyCaptchaCountdownJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityWyPlaylistLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.wyPlaylistLoginRoot.applySystemBarsInsets { insets ->
            val lp = binding.wyPlaylistLoginStatusBarSpacer.layoutParams
            lp.height = insets.top
            binding.wyPlaylistLoginStatusBarSpacer.layoutParams = lp
            binding.bottomPanel.setPadding(
                binding.bottomPanel.paddingLeft,
                binding.bottomPanel.paddingTop,
                binding.bottomPanel.paddingRight,
                insets.bottom + (12 * resources.displayMetrics.density).toInt(),
            )
        }

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }
        binding.toolbar.title = getString(
            R.string.playlist_import_title,
            getString(R.string.search_source_wy),
        )

        applyWyLoginTheme(binding.wyLogin)

        binding.btnStartImport.setOnClickListener {
            if (wyCookieRepository.getCookie().isBlank()) {
                Toast.makeText(this, R.string.playlist_import_wy_need_login_first, Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, R.string.playlist_import_cookie_saved, Toast.LENGTH_SHORT).show()
            }
        }

        bindWyLoginPanel()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    finish()
                }
            },
        )
    }

    private fun applyWyLoginTheme(b: IncludePlaylistImportKgLoginBinding) {
        val wy = ContextCompat.getColor(this, R.color.playlist_import_wy_brand)
        val tint = ColorStateList.valueOf(wy)
        b.kgLoginTitle.setText(R.string.playlist_import_wy_login_title)
        b.kgQrStatusHint.setText(R.string.playlist_import_wy_qr_hint_scan)
        b.kgQrConfirmHintText.setText(R.string.playlist_import_wy_qr_confirm_on_phone)
        b.kgSendCodeBtn.setTextColor(wy)
        b.kgLoginSubmitBtn.backgroundTintList = tint
        b.kgQrRefreshBtn.backgroundTintList = tint
        b.kgQrSuccessReturnBtn.backgroundTintList = tint
    }

    private fun bindWyLoginPanel() {
        val b = binding.wyLogin
        applyWyMethodTabStyle(phoneSelected = true)
        b.kgPhonePanel.visibility = View.VISIBLE
        b.kgQrPanel.visibility = View.GONE

        b.kgTabPhone.setOnClickListener {
            wyQrPollJob?.cancel()
            applyWyMethodTabStyle(phoneSelected = true)
            b.kgPhonePanel.visibility = View.VISIBLE
            b.kgQrPanel.visibility = View.GONE
        }

        b.kgTabQr.setOnClickListener {
            applyWyMethodTabStyle(phoneSelected = false)
            b.kgPhonePanel.visibility = View.GONE
            b.kgQrPanel.visibility = View.VISIBLE
            startWyQrLoginFlow()
        }

        b.kgSendCodeBtn.setOnClickListener { requestWyCaptcha() }
        b.kgLoginSubmitBtn.setOnClickListener { submitWyPhoneLogin() }
        b.kgQrRefreshBtn.setOnClickListener { startWyQrLoginFlow() }
        b.kgQrSuccessReturnBtn.setOnClickListener { finish() }
    }

    private fun requestWyCaptcha() {
        val phone = binding.wyLogin.kgPhoneInput.text?.toString()?.trim().orEmpty()
        if (phone.length != 11) {
            Toast.makeText(this, R.string.playlist_import_kg_phone_invalid, Toast.LENGTH_SHORT).show()
            return
        }
        wyCaptchaCountdownJob?.cancel()
        lifecycleScope.launch {
            try {
                val resp = withContext(Dispatchers.IO) {
                    wyApiService.sendLoginCaptcha(
                        phone = phone,
                        realIp = WyCookieRepository.WY_LOGIN_REAL_IP,
                    )
                }
                val root = resp.body() ?: JsonObject()
                val code = root.get("code")?.asInt ?: -1
                if (code != 200) {
                    val msg = jsonMessage(root) ?: getString(R.string.playlist_import_kg_captcha_fail)
                    Toast.makeText(this@WyPlaylistLoginActivity, msg, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                startWyCaptchaCountdown()
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                Toast.makeText(this@WyPlaylistLoginActivity, R.string.playlist_import_kg_network_error, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun startWyCaptchaCountdown() {
        val sendBtn = binding.wyLogin.kgSendCodeBtn
        wyCaptchaCountdownJob?.cancel()
        wyCaptchaCountdownJob = lifecycleScope.launch {
            sendBtn.isEnabled = false
            for (sec in 60 downTo 1) {
                sendBtn.text = getString(R.string.playlist_import_kg_send_code_cd, sec)
                delay(1000)
            }
            sendBtn.text = getString(R.string.playlist_import_kg_send_code)
            sendBtn.isEnabled = true
        }
    }

    private fun submitWyPhoneLogin() {
        val phone = binding.wyLogin.kgPhoneInput.text?.toString()?.trim().orEmpty()
        val captcha = binding.wyLogin.kgCodeInput.text?.toString()?.trim().orEmpty()
        if (phone.length != 11) {
            Toast.makeText(this, R.string.playlist_import_kg_phone_invalid, Toast.LENGTH_SHORT).show()
            return
        }
        if (captcha.isBlank()) {
            Toast.makeText(this, R.string.playlist_import_kg_code_empty, Toast.LENGTH_SHORT).show()
            return
        }
        lifecycleScope.launch {
            try {
                val resp = withContext(Dispatchers.IO) {
                    wyApiService.loginCellphone(
                        phone = phone,
                        captcha = captcha,
                        realIp = WyCookieRepository.WY_LOGIN_REAL_IP,
                    )
                }
                val root = resp.body() ?: JsonObject()
                val code = root.get("code")?.asInt ?: -1
                if (code != 200) {
                    val msg = jsonMessage(root) ?: getString(R.string.playlist_import_wy_login_fail)
                    Toast.makeText(this@WyPlaylistLoginActivity, msg, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                val cookieFromBody = wyJsonStringField(root, "cookie")
                val merged = mergeWyCookieChain(resp.cookieHeaderForNextRequest(), cookieFromBody)
                if (merged.isBlank()) {
                    Toast.makeText(this@WyPlaylistLoginActivity, R.string.playlist_import_wy_cookie_missing, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                wyCookieRepository.setCookie(merged)
                Toast.makeText(this@WyPlaylistLoginActivity, R.string.playlist_import_cookie_saved, Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                Toast.makeText(this@WyPlaylistLoginActivity, R.string.playlist_import_kg_network_error, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun startWyQrLoginFlow() {
        wyQrPollJob?.cancel()
        val b = binding.wyLogin
        b.kgQrLoading.visibility = View.VISIBLE
        b.kgQrPlaceholder.visibility = View.GONE
        b.kgQrImage.visibility = View.GONE
        b.kgQrOverlayExpired.visibility = View.GONE
        resetWyQrAuxiliaryUi(b)
        b.kgQrStatusHint.visibility = View.VISIBLE
        b.kgQrStatusHint.setText(R.string.playlist_import_wy_qr_hint_scan)

        wyQrPollJob = lifecycleScope.launch {
            try {
                val keyResp = withContext(Dispatchers.IO) {
                    wyApiService.loginQrKey(
                        timestamp = System.currentTimeMillis().toString(),
                        realIp = WyCookieRepository.WY_LOGIN_REAL_IP,
                    )
                }
                val keyEnv = keyResp.body()
                if (keyEnv?.code != 200 || keyEnv.data == null) {
                    b.kgQrLoading.visibility = View.GONE
                    b.kgQrPlaceholder.visibility = View.VISIBLE
                    Toast.makeText(this@WyPlaylistLoginActivity, R.string.playlist_import_kg_qr_fetch_fail, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                val unikey = keyEnv.data.unikey
                val keyCookie = keyResp.cookieHeaderForNextRequest().takeIf { it.isNotBlank() }
                val createResp = withContext(Dispatchers.IO) {
                    wyApiService.loginQrCreate(
                        key = unikey,
                        qrimg = "1",
                        timestamp = System.currentTimeMillis().toString(),
                        realIp = WyCookieRepository.WY_LOGIN_REAL_IP,
                        cookie = keyCookie,
                    )
                }
                val createEnv = createResp.body()
                if (createEnv?.code != 200 || createEnv.data == null) {
                    b.kgQrLoading.visibility = View.GONE
                    b.kgQrPlaceholder.visibility = View.VISIBLE
                    Toast.makeText(this@WyPlaylistLoginActivity, R.string.playlist_import_kg_qr_fetch_fail, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                val qrImg = createEnv.data.qrimg
                val bmp = withContext(Dispatchers.Default) { decodeWyQrBitmap(qrImg) }
                b.kgQrLoading.visibility = View.GONE
                if (bmp != null) {
                    b.kgQrImage.setImageBitmap(bmp)
                    b.kgQrImage.visibility = View.VISIBLE
                    b.kgQrPlaceholder.visibility = View.GONE
                } else {
                    b.kgQrPlaceholder.visibility = View.VISIBLE
                }
                applyWyQrWaitingScanUi(b)
                val cookieForPoll = createResp.cookieHeaderForNextRequest(
                    keyCookie,
                ).takeIf { it.isNotBlank() }
                pollWyQrUntilDone(unikey, cookieForPoll)
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                b.kgQrLoading.visibility = View.GONE
                b.kgQrPlaceholder.visibility = View.VISIBLE
                Toast.makeText(this@WyPlaylistLoginActivity, R.string.playlist_import_kg_network_error, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private suspend fun pollWyQrUntilDone(unikey: String, initialCookie: String?) {
        val b = binding.wyLogin
        var cookieForNext: String? = initialCookie
        while (true) {
            delay(3000)
            val resp = withContext(Dispatchers.IO) {
                wyApiService.loginQrCheck(
                    key = unikey,
                    timestamp = System.currentTimeMillis().toString(),
                    realIp = WyCookieRepository.WY_LOGIN_REAL_IP,
                    cookie = cookieForNext,
                )
            }
            cookieForNext = resp.cookieHeaderForNextRequest(cookieForNext).takeIf { it.isNotBlank() }
            val env = resp.body() ?: WyQrCheckEnvelope()
            when (env.code) {
                800 -> {
                    resetWyQrAuxiliaryUi(b)
                    b.kgQrOverlayExpired.visibility = View.VISIBLE
                    b.kgQrImage.alpha = 1f
                    if (b.kgQrImage.drawable != null) {
                        b.kgQrImage.visibility = View.VISIBLE
                        b.kgQrPlaceholder.visibility = View.GONE
                    } else {
                        b.kgQrImage.visibility = View.GONE
                        b.kgQrPlaceholder.visibility = View.VISIBLE
                    }
                    b.kgQrStatusHint.visibility = View.VISIBLE
                    b.kgQrStatusHint.setText(R.string.playlist_import_wy_qr_hint_scan)
                    return
                }
                802 -> {
                    b.kgQrOverlayExpired.visibility = View.GONE
                    applyWyQrConfirmingUi(b)
                }
                803 -> {
                    b.kgQrOverlayExpired.visibility = View.GONE
                    b.kgQrImage.alpha = 1f
                    val merged = mergeWyCookieChain(cookieForNext.orEmpty(), env.cookie)
                    if (merged.isBlank()) {
                        Toast.makeText(this@WyPlaylistLoginActivity, R.string.playlist_import_wy_cookie_missing, Toast.LENGTH_SHORT).show()
                        return
                    }
                    wyCookieRepository.setCookie(merged)
                    Toast.makeText(this@WyPlaylistLoginActivity, R.string.playlist_import_cookie_saved, Toast.LENGTH_SHORT).show()
                    applyWyQrLoggedInUi(b)
                    return
                }
                else -> {
                    b.kgQrOverlayExpired.visibility = View.GONE
                    applyWyQrWaitingScanUi(b)
                }
            }
        }
    }

    private fun resetWyQrAuxiliaryUi(b: IncludePlaylistImportKgLoginBinding) {
        b.kgQrUserAvatar.setImageDrawable(null)
        b.kgQrUserAvatar.visibility = View.GONE
        b.kgQrNickname.text = ""
        b.kgQrNickname.visibility = View.GONE
        b.kgQrConfirmHintRow.visibility = View.GONE
        b.kgQrSuccessRow.visibility = View.GONE
        b.kgQrSuccessReturnBtn.visibility = View.GONE
    }

    private fun applyWyQrWaitingScanUi(b: IncludePlaylistImportKgLoginBinding) {
        b.kgQrOverlayExpired.visibility = View.GONE
        b.kgQrUserAvatar.setImageDrawable(null)
        b.kgQrUserAvatar.visibility = View.GONE
        b.kgQrImage.alpha = 1f
        if (b.kgQrImage.drawable != null) {
            b.kgQrImage.visibility = View.VISIBLE
            b.kgQrPlaceholder.visibility = View.GONE
        } else {
            b.kgQrImage.visibility = View.GONE
            b.kgQrPlaceholder.visibility = View.VISIBLE
        }
        b.kgQrNickname.visibility = View.GONE
        b.kgQrNickname.text = ""
        b.kgQrConfirmHintRow.visibility = View.GONE
        b.kgQrSuccessRow.visibility = View.GONE
        b.kgQrSuccessReturnBtn.visibility = View.GONE
        b.kgQrStatusHint.visibility = View.VISIBLE
        b.kgQrStatusHint.setText(R.string.playlist_import_wy_qr_hint_scan)
    }

    /** 802：若接口带 nickname/pic 则与酷狗一致展示，否则仅弱化二维码 + 提示行（对齐 App.tsx 遮罩文案）。 */
    private fun applyWyQrConfirmingUi(b: IncludePlaylistImportKgLoginBinding) {
        b.kgQrUserAvatar.visibility = View.GONE
        b.kgQrNickname.visibility = View.GONE
        b.kgQrImage.alpha = 0.35f
        b.kgQrConfirmHintRow.visibility = View.VISIBLE
        b.kgQrSuccessRow.visibility = View.GONE
        b.kgQrSuccessReturnBtn.visibility = View.GONE
        b.kgQrStatusHint.visibility = View.VISIBLE
        b.kgQrStatusHint.setText(R.string.playlist_import_kg_qr_hint_waiting)
    }

    private fun applyWyQrLoggedInUi(b: IncludePlaylistImportKgLoginBinding) {
        b.kgQrConfirmHintRow.visibility = View.GONE
        b.kgQrSuccessRow.visibility = View.VISIBLE
        b.kgQrSuccessReturnBtn.visibility = View.VISIBLE
        b.kgQrStatusHint.visibility = View.GONE
    }

    private fun applyWyMethodTabStyle(phoneSelected: Boolean) {
        val ctx = this
        val onSurface = MaterialColors.getColor(
            ctx,
            com.google.android.material.R.attr.colorOnSurface,
            android.graphics.Color.BLACK,
        )
        val onSurfaceVariant = MaterialColors.getColor(
            ctx,
            com.google.android.material.R.attr.colorOnSurfaceVariant,
            ContextCompat.getColor(ctx, R.color.text_secondary),
        )
        fun styleTab(tv: android.widget.TextView, selected: Boolean) {
            tv.setBackgroundResource(
                if (selected) R.drawable.kg_login_tab_selected_bg else android.R.color.transparent,
            )
            tv.setTextColor(if (selected) onSurface else onSurfaceVariant)
            tv.setTypeface(null, if (selected) Typeface.BOLD else Typeface.NORMAL)
        }
        styleTab(binding.wyLogin.kgTabPhone, phoneSelected)
        styleTab(binding.wyLogin.kgTabQr, !phoneSelected)
    }

    private fun mergeWyCookieChain(headerMerged: String, bodyCookie: String?): String {
        val map = CookieRequest.parseCookieHeader(headerMerged)
        if (!bodyCookie.isNullOrBlank()) {
            for ((k, v) in CookieRequest.parseCookieHeader(bodyCookie)) {
                map[k] = v
            }
        }
        return map.entries.joinToString("; ") { e -> "${e.key}=${e.value}" }
    }

    private fun wyJsonStringField(obj: JsonObject, key: String): String? {
        val el = obj.get(key) ?: return null
        if (el.isJsonNull) return null
        return if (el.isJsonPrimitive) el.asJsonPrimitive.asString else null
    }

    private fun jsonMessage(obj: JsonObject): String? =
        wyJsonStringField(obj, "message") ?: wyJsonStringField(obj, "msg")

    private fun Response<*>.cookieHeaderForNextRequest(previousCookie: String? = null): String =
        CookieRequest.mergeSetCookiesIntoCookieHeader(
            httpUrl = raw().request.url,
            previousCookieHeader = previousCookie,
            setCookieLines = headers().values("Set-Cookie"),
        )

    private fun decodeWyQrBitmap(src: String): android.graphics.Bitmap? {
        val trimmed = src.trim()
        val b64 = if (trimmed.startsWith("data:image")) trimmed.substringAfter(',', "") else trimmed
        return try {
            val bytes = Base64.decode(b64, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Exception) {
            null
        }
    }

    override fun finish() {
        super.finish()
        PlaylistLoginNavTransitions.applyCloseAfterFinish(this)
    }

    override fun onDestroy() {
        wyQrPollJob?.cancel()
        wyCaptchaCountdownJob?.cancel()
        super.onDestroy()
    }

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, WyPlaylistLoginActivity::class.java))
            PlaylistLoginNavTransitions.applyOpenFromCaller(context)
        }
    }
}
