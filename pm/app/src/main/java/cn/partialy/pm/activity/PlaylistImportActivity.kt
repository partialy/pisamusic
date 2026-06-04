package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
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
import cn.partialy.pm.databinding.ActivityPlaylistImportBinding
import cn.partialy.pm.databinding.IncludePlaylistImportKgLoginBinding
import cn.partialy.pm.model.SongType
import cn.partialy.pm.network.CookieRequest
import cn.partialy.pm.network.api.KgApiService
import cn.partialy.pm.network.cookie.KgQrKeyEnvelope
import cn.partialy.pm.network.cookie.KgStdEnvelope
import cn.partialy.pm.network.cookie.KugouCookieRepository
import coil.load
import coil.transform.CircleCropTransformation
import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import com.google.android.material.color.MaterialColors
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
 * 酷狗歌单导入登录：自写 UI（对齐 music-login-hub），验证码 / 手机 / 扫码走网关，
 * 成功后 [KugouCookieRepository.finalizeKgLoginSession] 落盘。
 *
 * 网易云请使用 [WyPlaylistLoginActivity]；[start] 在 [SongType.WY] 时会跳转该页。
 */
@AndroidEntryPoint
class PlaylistImportActivity : BaseActivity() {

    @Inject
    lateinit var kugouCookieRepository: KugouCookieRepository

    @Inject
    lateinit var kgApiService: KgApiService

    private lateinit var binding: ActivityPlaylistImportBinding

    private val kgLoginGson = Gson()
    private var kgQrPollJob: Job? = null
    private var kgCaptchaCountdownJob: Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        val typeStr = intent.getStringExtra(EXTRA_SOURCE)
        if (typeStr != SongType.KG.name) {
            super.onCreate(savedInstanceState)
            finish()
            return
        }
        binding = ActivityPlaylistImportBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.playlistImportRoot.applySystemBarsInsets { insets ->
            val lp = binding.playlistImportStatusBarSpacer.layoutParams
            lp.height = insets.top
            binding.playlistImportStatusBarSpacer.layoutParams = lp
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
            getString(R.string.search_source_kg),
        )

        configureKugouImportUi()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    finish()
                }
            },
        )
    }

    /**
     * 酷狗：展示自写登录区，隐藏 WebView 与缩放条。
     * 接口路径与 music-login-hub/src/services/musicApi.ts 一致，网关前缀使用系统配置下发的 KG 地址。
     */
    private fun configureKugouImportUi() {
        binding.tvImportHint.setText(R.string.playlist_import_hint_kg_login)

        // 「开始导入」：登录成功后 Cookie 已落盘，此处用于确认并提示用户可去导入歌单
        binding.btnStartImport.setOnClickListener {
            if (kugouCookieRepository.getCookie().isBlank()) {
                Toast.makeText(this, R.string.playlist_import_kg_need_login_first, Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(this, R.string.playlist_import_cookie_saved, Toast.LENGTH_SHORT).show()
            }
        }

        bindKugouLoginPanel()
    }

    /**
     * 酷狗登录：双 Tab（手机 / 扫码），对齐 music-login-hub App.tsx。
     */
    private fun bindKugouLoginPanel() {
        val b = binding.kgLogin

        applyKugouMethodTabStyle(phoneSelected = true)
        b.kgPhonePanel.visibility = View.VISIBLE
        b.kgQrPanel.visibility = View.GONE

        b.kgTabPhone.setOnClickListener {
            kgQrPollJob?.cancel()
            applyKugouMethodTabStyle(phoneSelected = true)
            b.kgPhonePanel.visibility = View.VISIBLE
            b.kgQrPanel.visibility = View.GONE
        }

        // 扫码：GET /login/qr/key 取图，轮询 GET /login/qr/check（data.status：0 过期、1 等待、2 待确认、4 成功）
        b.kgTabQr.setOnClickListener {
            applyKugouMethodTabStyle(phoneSelected = false)
            b.kgPhonePanel.visibility = View.GONE
            b.kgQrPanel.visibility = View.VISIBLE
            startKugouQrLoginFlow()
        }

        // GET /captcha/sent?mobile=
        b.kgSendCodeBtn.setOnClickListener { requestKugouCaptcha() }

        // GET /login/cellphone?mobile=&code=；成功则响应体带 token、userid，[CookieRequest] 合并 Set-Cookie
        b.kgLoginSubmitBtn.setOnClickListener { submitKugouPhoneLogin() }

        b.kgQrRefreshBtn.setOnClickListener { startKugouQrLoginFlow() }

        b.kgQrSuccessReturnBtn.setOnClickListener { finish() }
    }

    /** GET /captcha/sent，成功则 60s 倒计时（与 App.tsx 一致）。 */
    private fun requestKugouCaptcha() {
        val phone = binding.kgLogin.kgPhoneInput.text?.toString()?.trim().orEmpty()
        if (phone.length != 11) {
            Toast.makeText(this, R.string.playlist_import_kg_phone_invalid, Toast.LENGTH_SHORT).show()
            return
        }
        kgCaptchaCountdownJob?.cancel()
        lifecycleScope.launch {
            try {
                val resp = withContext(Dispatchers.IO) {
                    kgApiService.sendLoginCaptcha(mobile = phone)
                }
                val env = resp.body()
                if (env?.status != 1) {
                    val msg = env?.msg ?: env?.message ?: getString(R.string.playlist_import_kg_captcha_fail)
                    Toast.makeText(this@PlaylistImportActivity, msg, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                startKugouCaptchaCountdown()
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                Toast.makeText(this@PlaylistImportActivity, R.string.playlist_import_kg_network_error, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun startKugouCaptchaCountdown() {
        val sendBtn = binding.kgLogin.kgSendCodeBtn
        kgCaptchaCountdownJob?.cancel()
        kgCaptchaCountdownJob = lifecycleScope.launch {
            sendBtn.isEnabled = false
            for (sec in 60 downTo 1) {
                sendBtn.text = getString(R.string.playlist_import_kg_send_code_cd, sec)
                delay(1000)
            }
            sendBtn.text = getString(R.string.playlist_import_kg_send_code)
            sendBtn.isEnabled = true
        }
    }

    /** 手机登录成功后走 [KugouCookieRepository.finalizeKgLoginSession]（/login/token + 合成 Cookie 字段）。 */
    private fun submitKugouPhoneLogin() {
        val phone = binding.kgLogin.kgPhoneInput.text?.toString()?.trim().orEmpty()
        val code = binding.kgLogin.kgCodeInput.text?.toString()?.trim().orEmpty()
        if (phone.length != 11) {
            Toast.makeText(this, R.string.playlist_import_kg_phone_invalid, Toast.LENGTH_SHORT).show()
            return
        }
        if (code.isBlank()) {
            Toast.makeText(this, R.string.playlist_import_kg_code_empty, Toast.LENGTH_SHORT).show()
            return
        }
        lifecycleScope.launch {
            try {
                val resp = withContext(Dispatchers.IO) {
                    kgApiService.loginCellphone(mobile = phone, code = code)
                }
                val env = resp.body()
                if (env?.status != 1) {
                    val msg = env?.msg ?: env?.message ?: getString(R.string.playlist_import_kg_save_fail_generic)
                    Toast.makeText(this@PlaylistImportActivity, msg, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                val data = env.data
                val token = data?.get("token")?.toScalarString().orEmpty()
                val userid = data?.get("userid")?.toScalarString().orEmpty()
                if (token.isBlank() || userid.isBlank()) {
                    Toast.makeText(this@PlaylistImportActivity, R.string.playlist_import_kg_login_missing_token, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                val nickname = data?.get("nickname")?.toScalarString().orEmpty()
                val pic = data?.get("pic")?.toScalarString().orEmpty()
                val cookieHeader = resp.cookieHeaderForNextRequest()
                kugouCookieRepository.finalizeKgLoginSession(cookieHeader, token, userid, nickname, pic)
                    .onSuccess {
                        Toast.makeText(this@PlaylistImportActivity, R.string.playlist_import_cookie_saved, Toast.LENGTH_SHORT).show()
                    }
                    .onFailure { e ->
                        Toast.makeText(
                            this@PlaylistImportActivity,
                            e.message ?: getString(R.string.playlist_import_kg_save_fail_generic),
                            Toast.LENGTH_SHORT,
                        ).show()
                    }
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                Toast.makeText(this@PlaylistImportActivity, R.string.playlist_import_kg_network_error, Toast.LENGTH_SHORT).show()
            }
        }
    }

    /** 拉取二维码并开始轮询；同一 [Job] 内串行，取消即停止轮询。 */
    private fun startKugouQrLoginFlow() {
        kgQrPollJob?.cancel()
        val b = binding.kgLogin
        b.kgQrLoading.visibility = View.VISIBLE
        b.kgQrPlaceholder.visibility = View.GONE
        b.kgQrImage.visibility = View.GONE
        b.kgQrOverlayExpired.visibility = View.GONE
        resetKugouQrLoginAuxiliaryUi(b)
        b.kgQrStatusHint.visibility = View.VISIBLE
        b.kgQrStatusHint.setText(R.string.playlist_import_kg_qr_hint_scan)

        kgQrPollJob = lifecycleScope.launch {
            try {
                val keyResp = withContext(Dispatchers.IO) {
                    kgApiService.loginQrKey(timestamp = System.currentTimeMillis().toString())
                }
                val keyEnv = keyResp.body()
                if (keyEnv?.status != 1 || keyEnv.data == null) {
                    b.kgQrLoading.visibility = View.GONE
                    b.kgQrPlaceholder.visibility = View.VISIBLE
                    Toast.makeText(this@PlaylistImportActivity, R.string.playlist_import_kg_qr_fetch_fail, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                val qrImg = keyEnv.data.qrcodeImg
                val key = keyEnv.data.qrcode
                val bmp = withContext(Dispatchers.Default) { decodeKugouQrBitmap(qrImg) }
                b.kgQrLoading.visibility = View.GONE
                if (bmp != null) {
                    b.kgQrImage.setImageBitmap(bmp)
                    b.kgQrImage.visibility = View.VISIBLE
                    b.kgQrPlaceholder.visibility = View.GONE
                } else {
                    b.kgQrPlaceholder.visibility = View.VISIBLE
                }
                applyKugouQrWaitingScanUi(b)
                pollKugouQrUntilDone(key)
            } catch (e: Exception) {
                if (e is CancellationException) throw e
                b.kgQrLoading.visibility = View.GONE
                b.kgQrPlaceholder.visibility = View.VISIBLE
                Toast.makeText(this@PlaylistImportActivity, R.string.playlist_import_kg_network_error, Toast.LENGTH_SHORT).show()
            }
        }
    }

    /**
     * 轮询 /login/qr/check：携带上一轮返回的 Cookie（[CookieRequest] 已合并 Set-Cookie），
     * status=4 时取 token、userid 与当前 Cookie 串，调用 [KugouCookieRepository.finalizeKgLoginSession]。
     */
    private suspend fun pollKugouQrUntilDone(key: String) {
        val b = binding.kgLogin
        var cookieForNext: String? = null
        while (true) {
            delay(3000)
            val resp = withContext(Dispatchers.IO) {
                kgApiService.loginQrCheck(
                    key = key,
                    timestamp = System.currentTimeMillis().toString(),
                    cookie = cookieForNext,
                )
            }
            cookieForNext = resp.cookieHeaderForNextRequest(cookieForNext).takeIf { it.isNotBlank() }
            val env = resp.body() ?: KgStdEnvelope()
            val d = env.data
            val innerStatus = d?.get("status")?.takeIf { it.isJsonPrimitive }?.asJsonPrimitive?.asInt ?: 1

            when (innerStatus) {
                0 -> {
                    resetKugouQrLoginAuxiliaryUi(b)
                    b.kgQrOverlayMessage.setText(R.string.playlist_import_kg_qr_expired)
                    b.kgQrOverlayExpired.visibility = View.VISIBLE
                    if (b.kgQrImage.drawable != null) {
                        b.kgQrImage.visibility = View.VISIBLE
                        b.kgQrPlaceholder.visibility = View.GONE
                    } else {
                        b.kgQrImage.visibility = View.GONE
                        b.kgQrPlaceholder.visibility = View.VISIBLE
                    }
                    b.kgQrStatusHint.visibility = View.VISIBLE
                    b.kgQrStatusHint.setText(R.string.playlist_import_kg_qr_hint_scan)
                    return
                }
                // 2：待确认 — 框内展示 pic，下方 nickname，橙色感叹号 +「请在手机上确认登录」
                2 -> {
                    b.kgQrOverlayExpired.visibility = View.GONE
                    if (d != null) {
                        applyKugouQrAwaitPhoneConfirmUi(b, d)
                    } else {
                        applyKugouQrWaitingScanUi(b)
                    }
                }
                4 -> {
                    b.kgQrOverlayExpired.visibility = View.GONE
                    val payload = d ?: return
                    val token = payload.get("token")?.toScalarString().orEmpty()
                    val userid = payload.get("userid")?.toScalarString().orEmpty()
                    if (token.isBlank() || userid.isBlank()) {
                        Toast.makeText(this@PlaylistImportActivity, R.string.playlist_import_kg_login_missing_token, Toast.LENGTH_SHORT).show()
                        return
                    }
                    val nickname = payload.get("nickname")?.toScalarString().orEmpty()
                    val pic = payload.get("pic")?.toScalarString().orEmpty()
                    val cookieHeader = cookieForNext.orEmpty()
                    val fin = kugouCookieRepository.finalizeKgLoginSession(cookieHeader, token, userid, nickname, pic)
                    fin.onSuccess {
                        Toast.makeText(this@PlaylistImportActivity, R.string.playlist_import_cookie_saved, Toast.LENGTH_SHORT).show()
                        applyKugouQrLoggedInUi(b)
                    }
                    fin.onFailure { e ->
                        Toast.makeText(
                            this@PlaylistImportActivity,
                            e.message ?: getString(R.string.playlist_import_kg_save_fail_generic),
                            Toast.LENGTH_SHORT,
                        ).show()
                        applyKugouQrFinalizeFailedUi(b)
                    }
                    return
                }
                else -> {
                    applyKugouQrWaitingScanUi(b)
                }
            }
        }
    }

    private fun Response<*>.cookieHeaderForNextRequest(previousCookie: String? = null): String =
        CookieRequest.mergeSetCookiesIntoCookieHeader(
            httpUrl = raw().request.url,
            previousCookieHeader = previousCookie,
            setCookieLines = headers().values("Set-Cookie"),
        )

    private fun resetKugouQrLoginAuxiliaryUi(b: IncludePlaylistImportKgLoginBinding) {
        b.kgQrUserAvatar.setImageDrawable(null)
        b.kgQrUserAvatar.visibility = View.GONE
        b.kgQrNickname.text = ""
        b.kgQrNickname.visibility = View.GONE
        b.kgQrConfirmHintRow.visibility = View.GONE
        b.kgQrSuccessRow.visibility = View.GONE
        b.kgQrSuccessReturnBtn.visibility = View.GONE
    }

    /** data.status == 1：等待扫码，框内为二维码。 */
    private fun applyKugouQrWaitingScanUi(b: IncludePlaylistImportKgLoginBinding) {
        b.kgQrOverlayExpired.visibility = View.GONE
        b.kgQrUserAvatar.setImageDrawable(null)
        b.kgQrUserAvatar.visibility = View.GONE
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
        b.kgQrStatusHint.setText(R.string.playlist_import_kg_qr_hint_scan)
    }

    /** data.status == 2：待确认，展示 pic、nickname、橙色感叹号 + 文案。 */
    private fun applyKugouQrAwaitPhoneConfirmUi(b: IncludePlaylistImportKgLoginBinding, data: JsonObject) {
        val pic = data.get("pic")?.toScalarString().orEmpty()
        val nickname = data.get("nickname")?.toScalarString().orEmpty()
        b.kgQrPlaceholder.visibility = View.GONE
        b.kgQrImage.visibility = View.GONE
        b.kgQrUserAvatar.visibility = View.VISIBLE
        if (pic.isNotBlank()) {
            b.kgQrUserAvatar.load(pic) {
                crossfade(true)
                transformations(CircleCropTransformation())
                placeholder(R.drawable.ic_qr_code_placeholder_120)
                error(R.drawable.ic_qr_code_placeholder_120)
            }
        } else {
            b.kgQrUserAvatar.setImageResource(R.drawable.ic_qr_code_placeholder_120)
        }
        if (nickname.isNotBlank()) {
            b.kgQrNickname.text = nickname
            b.kgQrNickname.visibility = View.VISIBLE
        } else {
            b.kgQrNickname.visibility = View.GONE
        }
        b.kgQrConfirmHintRow.visibility = View.VISIBLE
        b.kgQrSuccessRow.visibility = View.GONE
        b.kgQrSuccessReturnBtn.visibility = View.GONE
        b.kgQrStatusHint.visibility = View.GONE
    }

    /** data.status == 4 且 finalize 成功：绿色打勾 + 文案 + 返回按钮。 */
    private fun applyKugouQrLoggedInUi(b: IncludePlaylistImportKgLoginBinding) {
        b.kgQrOverlayExpired.visibility = View.GONE
        b.kgQrConfirmHintRow.visibility = View.GONE
        b.kgQrSuccessRow.visibility = View.VISIBLE
        b.kgQrSuccessReturnBtn.visibility = View.VISIBLE
        b.kgQrStatusHint.visibility = View.GONE
    }

    private fun applyKugouQrFinalizeFailedUi(b: IncludePlaylistImportKgLoginBinding) {
        resetKugouQrLoginAuxiliaryUi(b)
        b.kgQrOverlayMessage.setText(R.string.playlist_import_kg_qr_retry_after_fail)
        b.kgQrOverlayExpired.visibility = View.VISIBLE
        if (b.kgQrImage.drawable != null) {
            b.kgQrImage.visibility = View.VISIBLE
            b.kgQrPlaceholder.visibility = View.GONE
        } else {
            b.kgQrImage.visibility = View.GONE
            b.kgQrPlaceholder.visibility = View.VISIBLE
        }
        b.kgQrStatusHint.visibility = View.VISIBLE
        b.kgQrStatusHint.setText(R.string.playlist_import_kg_qr_retry_after_fail)
    }

    private fun decodeKugouQrBitmap(src: String): android.graphics.Bitmap? {
        val trimmed = src.trim()
        val b64 = if (trimmed.startsWith("data:image")) trimmed.substringAfter(',', "") else trimmed
        return try {
            val bytes = Base64.decode(b64, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        } catch (_: Exception) {
            null
        }
    }

    private fun JsonElement.toScalarString(): String {
        if (isJsonNull) return ""
        if (!isJsonPrimitive) return ""
        val p = asJsonPrimitive
        return when {
            p.isString -> p.asString
            p.isNumber -> p.asNumber.toString()
            p.isBoolean -> p.asBoolean.toString()
            else -> ""
        }
    }

    /** Tab 选中态与 App.tsx 分段控件一致：选中块底 + 主色文案强调（未选为次要色）。 */
    private fun applyKugouMethodTabStyle(phoneSelected: Boolean) {
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
        styleTab(binding.kgLogin.kgTabPhone, phoneSelected)
        styleTab(binding.kgLogin.kgTabQr, !phoneSelected)
    }

    override fun finish() {
        super.finish()
        PlaylistLoginNavTransitions.applyCloseAfterFinish(this)
    }

    override fun onDestroy() {
        kgQrPollJob?.cancel()
        kgCaptchaCountdownJob?.cancel()
        super.onDestroy()
    }

    companion object {
        private const val EXTRA_SOURCE = "extra_playlist_import_source"

        /**
         * [SongType.KG] 打开本页；[SongType.WY] 打开 [WyPlaylistLoginActivity]。
         */
        fun start(context: Context, type: SongType) {
            when (type) {
                SongType.KG -> {
                    context.startActivity(
                        Intent(context, PlaylistImportActivity::class.java).putExtra(EXTRA_SOURCE, type.name),
                    )
                    PlaylistLoginNavTransitions.applyOpenFromCaller(context)
                }
                SongType.WY -> WyPlaylistLoginActivity.start(context)
                else -> error("Unsupported import source: $type")
            }
        }
    }
}
