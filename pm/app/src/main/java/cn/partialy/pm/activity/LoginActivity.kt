package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import android.os.CountDownTimer
import android.text.InputType
import android.view.View
import android.widget.ImageButton
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityLoginBinding
import cn.partialy.pm.model.AccountAuthResult
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.sync.SyncManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@AndroidEntryPoint
class LoginActivity : BaseActivity() {
    private lateinit var binding: ActivityLoginBinding
    private var loginMode: LoginMode = LoginMode.PASSWORD
    private var codeCountDownTimer: CountDownTimer? = null

    @Inject
    lateinit var configManager: ConfigManager

    @Inject
    lateinit var syncManager: SyncManager

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setupSystemBars()
        bindActions()
        applyMode(LoginMode.PASSWORD, showPhoneToast = false)
    }

    override fun onDestroy() {
        codeCountDownTimer?.cancel()
        super.onDestroy()
    }

    private fun setupSystemBars() {
        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = !isNight
            isAppearanceLightNavigationBars = !isNight
        }
        ViewCompat.setOnApplyWindowInsetsListener(binding.accountLoginRoot) { view, insets ->
            val navigationBar = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(0, 0, 0, maxOf(navigationBar.bottom, ime.bottom))
            insets
        }
        ViewCompat.requestApplyInsets(binding.accountLoginRoot)
    }

    private fun bindActions() {
        binding.accountLoginBackButton.setOnClickListener { finish() }
        binding.accountLoginRegisterButton.setOnClickListener {
            AccountAssistActivity.start(this, AccountAssistActivity.MODE_REGISTER)
        }
        binding.accountLoginResetButton.setOnClickListener {
            AccountAssistActivity.start(this, AccountAssistActivity.MODE_RESET)
        }
        binding.accountLoginPasswordModeButton.setOnClickListener {
            applyMode(LoginMode.PASSWORD)
        }
        binding.accountLoginEmailModeButton.setOnClickListener {
            applyMode(LoginMode.EMAIL_CODE)
        }
        binding.accountLoginPhoneModeButton.setOnClickListener {
            applyMode(LoginMode.PHONE, showPhoneToast = true)
        }
        binding.accountLoginSendCodeButton.setOnClickListener {
            when (loginMode) {
                LoginMode.EMAIL_CODE -> sendEmailCode()
                LoginMode.PHONE -> showPhoneUnavailable()
                LoginMode.PASSWORD -> Unit
            }
        }
        binding.accountLoginSubmitButton.setOnClickListener { submitLogin() }
    }

    private fun applyMode(next: LoginMode, showPhoneToast: Boolean = false) {
        loginMode = next
        binding.accountLoginTitleText.setText(
            when (next) {
                LoginMode.PASSWORD -> R.string.account_login_password_title
                LoginMode.EMAIL_CODE -> R.string.account_login_email_title
                LoginMode.PHONE -> R.string.account_login_phone_title
            },
        )
        binding.accountLoginIdentifierLayout.hint = getString(
            when (next) {
                LoginMode.PASSWORD -> R.string.account_login_identifier_hint
                LoginMode.EMAIL_CODE -> R.string.account_login_email_hint
                LoginMode.PHONE -> R.string.account_login_phone_hint
            },
        )
        binding.accountLoginIdentifierEditText.apply {
            inputType = when (next) {
                LoginMode.PASSWORD -> InputType.TYPE_CLASS_TEXT
                LoginMode.EMAIL_CODE -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                LoginMode.PHONE -> InputType.TYPE_CLASS_PHONE
            }
            setSelection(text?.length ?: 0)
        }
        binding.accountLoginPasswordLayout.visibility =
            if (next == LoginMode.PASSWORD) View.VISIBLE else View.GONE
        binding.accountLoginCodeRow.visibility =
            if (next == LoginMode.PASSWORD) View.GONE else View.VISIBLE
        styleModeButton(binding.accountLoginPhoneModeButton, next == LoginMode.PHONE)
        styleModeButton(binding.accountLoginEmailModeButton, next == LoginMode.EMAIL_CODE)
        styleModeButton(binding.accountLoginPasswordModeButton, next == LoginMode.PASSWORD)
        if (showPhoneToast) showPhoneUnavailable()
    }

    private fun styleModeButton(button: ImageButton, selected: Boolean) {
        button.setBackgroundResource(
            if (selected) R.drawable.bg_account_login_method_button_selected
            else R.drawable.bg_account_login_method_button,
        )
        button.imageTintList = ContextCompat.getColorStateList(
            this,
            if (selected) R.color.account_login_brand else R.color.account_login_text_secondary,
        )
    }

    private fun submitLogin() {
        when (loginMode) {
            LoginMode.PASSWORD -> submitPasswordLogin()
            LoginMode.EMAIL_CODE -> submitEmailCodeLogin()
            LoginMode.PHONE -> showPhoneUnavailable()
        }
    }

    private fun submitPasswordLogin() {
        val identifier = binding.accountLoginIdentifierEditText.text?.toString()?.trim().orEmpty()
        val password = binding.accountLoginPasswordEditText.text?.toString().orEmpty()
        if (identifier.isBlank()) {
            toast(R.string.account_login_identifier_required)
            return
        }
        if (password.isBlank()) {
            toast(R.string.account_login_password_required)
            return
        }
        setLoading(true)
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    configManager.loginAccountByPassword(identifier, password)
                }
            }.onSuccess(::notifyLoggedIn)
                .onFailure { error ->
                    setLoading(false)
                    toast(error.message ?: getString(R.string.account_login_failed))
                }
        }
    }

    private fun submitEmailCodeLogin() {
        val email = binding.accountLoginIdentifierEditText.text?.toString()?.trim().orEmpty()
        val code = binding.accountLoginCodeEditText.text?.toString()?.trim().orEmpty()
        if (email.isBlank()) {
            toast(R.string.account_login_email_required)
            return
        }
        if (code.isBlank()) {
            toast(R.string.account_login_code_required)
            return
        }
        setLoading(true)
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    configManager.loginAccountByCode(email, code)
                }
            }.onSuccess(::notifyLoggedIn)
                .onFailure { error ->
                    setLoading(false)
                    toast(error.message ?: getString(R.string.account_login_failed))
                }
        }
    }

    private fun sendEmailCode() {
        val email = binding.accountLoginIdentifierEditText.text?.toString()?.trim().orEmpty()
        if (email.isBlank()) {
            toast(R.string.account_login_email_required)
            return
        }
        binding.accountLoginSendCodeButton.isEnabled = false
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    configManager.sendAccountEmailCode(email, "login")
                }
            }.onSuccess {
                toast(R.string.account_login_code_sent)
                startCodeCountDown()
            }.onFailure { error ->
                binding.accountLoginSendCodeButton.isEnabled = true
                toast(error.message ?: getString(R.string.account_login_failed))
            }
        }
    }

    private fun startCodeCountDown() {
        codeCountDownTimer?.cancel()
        codeCountDownTimer = object : CountDownTimer(CODE_COUNTDOWN_MS, 1000L) {
            override fun onTick(millisUntilFinished: Long) {
                val seconds = (millisUntilFinished / 1000L).coerceAtLeast(1L)
                binding.accountLoginSendCodeButton.text =
                    getString(R.string.account_login_send_code_countdown, seconds)
            }

            override fun onFinish() {
                binding.accountLoginSendCodeButton.isEnabled = true
                binding.accountLoginSendCodeButton.setText(R.string.account_login_send_code)
            }
        }.also { it.start() }
    }

    private fun notifyLoggedIn(result: AccountAuthResult) {
        val previousUserId = AccountSessionStore.read(this).user.id
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                if (previousUserId.isNotBlank() && previousUserId != result.user.id) {
                    syncManager.clearLocalSyncState()
                }
                AccountSessionStore.save(this@LoginActivity, result)
                syncManager.startAccountSync()
            }
            toast(R.string.account_login_success)
            finish()
        }
    }

    private fun setLoading(loading: Boolean) {
        binding.accountLoginSubmitButton.isEnabled = !loading
        binding.accountLoginPhoneModeButton.isEnabled = !loading
        binding.accountLoginEmailModeButton.isEnabled = !loading
        binding.accountLoginPasswordModeButton.isEnabled = !loading
        binding.accountLoginRegisterButton.isEnabled = !loading
        binding.accountLoginResetButton.isEnabled = !loading
        binding.accountLoginSubmitButton.alpha = if (loading) 0.72f else 1f
    }

    private fun showPhoneUnavailable() {
        toast(R.string.account_login_phone_unavailable)
    }

    private fun toast(messageRes: Int) {
        Toast.makeText(this, messageRes, Toast.LENGTH_SHORT).show()
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    private enum class LoginMode {
        PASSWORD,
        EMAIL_CODE,
        PHONE,
    }

    companion object {
        private const val CODE_COUNTDOWN_MS = 60_000L

        fun start(context: Context) {
            context.startActivity(Intent(context, LoginActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
