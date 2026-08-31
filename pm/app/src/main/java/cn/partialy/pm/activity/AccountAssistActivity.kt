package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import android.os.CountDownTimer
import android.text.InputType
import android.view.View
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityAccountAssistBinding
import cn.partialy.pm.model.AccountAuthResult
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.ui.widget.LoadingTextButtonRenderer
import cn.partialy.pm.listening.ListeningManager
import cn.partialy.pm.sync.SyncManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@AndroidEntryPoint
class AccountAssistActivity : BaseActivity() {
    private lateinit var binding: ActivityAccountAssistBinding
    private var codeCountDownTimer: CountDownTimer? = null
    private var codeCountingDown = false
    private var contactMode = ContactMode.EMAIL
    private lateinit var submitLoading: LoadingTextButtonRenderer
    private lateinit var sendCodeLoading: LoadingTextButtonRenderer
    private val isResetMode: Boolean
        get() = intent.getStringExtra(EXTRA_MODE) == MODE_RESET

    @Inject
    lateinit var configManager: ConfigManager

    @Inject
    lateinit var syncManager: SyncManager

    @Inject
    lateinit var listeningManager: ListeningManager

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityAccountAssistBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setupSystemBars()
        submitLoading = LoadingTextButtonRenderer(binding.accountAssistSubmitButton, binding.accountAssistSubmitLoading)
        sendCodeLoading = LoadingTextButtonRenderer(binding.accountAssistSendCodeButton, binding.accountAssistSendCodeLoading)
        bindActions()
        applyMode()
        applyContactMode(ContactMode.EMAIL)
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
        ViewCompat.setOnApplyWindowInsetsListener(binding.accountAssistRoot) { view, insets ->
            val navigationBar = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(0, 0, 0, maxOf(navigationBar.bottom, ime.bottom))
            insets
        }
        ViewCompat.requestApplyInsets(binding.accountAssistRoot)
    }

    private fun bindActions() {
        binding.accountAssistBackButton.setOnClickListener { finish() }
        binding.accountAssistEmailModeButton.setOnClickListener { applyContactMode(ContactMode.EMAIL) }
        binding.accountAssistPhoneModeButton.setOnClickListener { applyContactMode(ContactMode.PHONE) }
        binding.accountAssistSendCodeButton.setOnClickListener { sendCode() }
        binding.accountAssistSubmitButton.setOnClickListener {
            if (isResetMode) resetPassword() else registerAccount()
        }
    }

    private fun applyMode() {
        if (isResetMode) {
            binding.accountAssistTitleText.setText(R.string.account_assist_reset_title)
            binding.accountAssistSubtitleText.setText(R.string.account_assist_reset_subtitle)
            binding.accountAssistModeIcon.setImageResource(R.drawable.ic_account_assist_reset_24)
            binding.accountAssistUsernameLayout.visibility = View.GONE
            binding.accountAssistPasswordLayout.hint = getString(R.string.account_assist_new_password_hint)
            binding.accountAssistSubmitButton.setText(R.string.account_assist_reset_submit)
        } else {
            binding.accountAssistTitleText.setText(R.string.account_assist_register_title)
            binding.accountAssistSubtitleText.setText(R.string.account_assist_register_subtitle)
            binding.accountAssistModeIcon.setImageResource(R.drawable.ic_account_assist_register_24)
            binding.accountAssistUsernameLayout.visibility = View.VISIBLE
            binding.accountAssistPasswordLayout.hint = getString(R.string.account_login_password_hint)
            binding.accountAssistSubmitButton.setText(R.string.account_assist_register_submit)
        }
    }

    private fun applyContactMode(mode: ContactMode) {
        contactMode = mode
        val email = mode == ContactMode.EMAIL
        binding.accountAssistEmailLayout.hint = getString(if (email) R.string.account_login_email_hint else R.string.account_login_phone_hint)
        binding.accountAssistEmailEditText.inputType = if (email) {
            InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
        } else InputType.TYPE_CLASS_PHONE
        binding.accountAssistCodeLayout.hint = getString(if (email) R.string.account_assist_email_code_hint else R.string.account_login_code_hint)
        binding.accountAssistEmailModeButton.setTextColor(getColor(if (email) R.color.account_login_brand else R.color.account_login_text_secondary))
        binding.accountAssistPhoneModeButton.setTextColor(getColor(if (!email) R.color.account_login_brand else R.color.account_login_text_secondary))
    }

    private fun sendCode() {
        val contact = contactText()
        if (contact.isBlank()) {
            toast(if (contactMode == ContactMode.EMAIL) R.string.account_login_email_required else R.string.account_login_phone_required)
            return
        }
        sendCodeLoading.setLoading(true)
        lifecycleScope.launch {
            runCatching {
                val purpose = if (isResetMode) "reset_password" else "register"
                withContext(Dispatchers.IO) {
                    if (contactMode == ContactMode.EMAIL) configManager.sendAccountEmailCode(contact, purpose)
                    else configManager.sendAccountPhoneCode(contact, purpose)
                }
            }.onSuccess {
                sendCodeLoading.setLoading(false)
                toast(R.string.account_login_code_sent)
                startCodeCountDown()
            }.onFailure { error ->
                sendCodeLoading.setLoading(false)
                toast(error.message ?: getString(R.string.account_assist_code_send_failed))
            }
        }
    }

    private fun registerAccount() {
        val contact = contactText()
        val username = usernameText()
        val password = passwordText()
        val code = codeText()
        if (contact.isBlank()) {
            toast(if (contactMode == ContactMode.EMAIL) R.string.account_login_email_required else R.string.account_login_phone_required)
            return
        }
        if (username.isBlank()) {
            toast(R.string.account_assist_username_required)
            return
        }
        if (password.isBlank()) {
            toast(R.string.account_login_password_required)
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
                    configManager.registerAccount(if (contactMode == ContactMode.EMAIL) contact else null, username, password, code, if (contactMode == ContactMode.PHONE) contact else null)
                }
            }.onSuccess(::notifyRegistered)
                .onFailure { error ->
                    setLoading(false)
                    toast(error.message ?: getString(R.string.account_assist_register_failed))
                }
        }
    }

    private fun resetPassword() {
        val contact = contactText()
        val password = passwordText()
        val code = codeText()
        if (contact.isBlank()) {
            toast(if (contactMode == ContactMode.EMAIL) R.string.account_login_email_required else R.string.account_login_phone_required)
            return
        }
        if (password.isBlank()) {
            toast(R.string.account_login_password_required)
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
                    configManager.resetAccountPassword(if (contactMode == ContactMode.EMAIL) contact else null, code, password, if (contactMode == ContactMode.PHONE) contact else null)
                }
            }.onSuccess {
                toast(R.string.account_assist_reset_success)
                finish()
            }.onFailure { error ->
                setLoading(false)
                toast(error.message ?: getString(R.string.account_assist_reset_failed))
            }
        }
    }

    private fun notifyRegistered(result: AccountAuthResult) {
        val previousUserId = AccountSessionStore.read(this).user.id
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                if (previousUserId.isNotBlank() && previousUserId != result.user.id) {
                    syncManager.clearLocalSyncState()
                }
                AccountSessionStore.save(this@AccountAssistActivity, result)
                syncManager.startAccountSync()
                listeningManager.onAccountAvailable()
            }
            toast(R.string.account_login_success)
            finish()
        }
    }

    private fun startCodeCountDown() {
        codeCountDownTimer?.cancel()
        codeCountingDown = true
        codeCountDownTimer = object : CountDownTimer(CODE_COUNTDOWN_MS, 1000L) {
            override fun onTick(millisUntilFinished: Long) {
                val seconds = (millisUntilFinished / 1000L).coerceAtLeast(1L)
                binding.accountAssistSendCodeButton.text =
                    getString(R.string.account_login_send_code_countdown, seconds)
            }

            override fun onFinish() {
                codeCountingDown = false
                binding.accountAssistSendCodeButton.isEnabled = true
                binding.accountAssistSendCodeButton.setText(R.string.account_assist_send_code)
            }
        }.also { it.start() }
    }

    private fun setLoading(loading: Boolean) {
        submitLoading.setLoading(loading)
        binding.accountAssistBackButton.isEnabled = !loading
        binding.accountAssistSendCodeButton.isEnabled = !loading && !codeCountingDown
        binding.accountAssistSubmitButton.alpha = if (loading) 0.72f else 1f
    }

    private fun contactText(): String =
        binding.accountAssistEmailEditText.text?.toString()?.trim().orEmpty()

    private enum class ContactMode { EMAIL, PHONE }

    private fun usernameText(): String =
        binding.accountAssistUsernameEditText.text?.toString()?.trim().orEmpty()

    private fun passwordText(): String =
        binding.accountAssistPasswordEditText.text?.toString().orEmpty()

    private fun codeText(): String =
        binding.accountAssistCodeEditText.text?.toString()?.trim().orEmpty()

    private fun toast(messageRes: Int) {
        Toast.makeText(this, messageRes, Toast.LENGTH_SHORT).show()
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }

    companion object {
        const val MODE_REGISTER = "register"
        const val MODE_RESET = "reset"
        private const val EXTRA_MODE = "cn.partialy.pm.extra.ACCOUNT_ASSIST_MODE"
        private const val CODE_COUNTDOWN_MS = 60_000L

        fun start(context: Context, mode: String) {
            context.startActivity(
                Intent(context, AccountAssistActivity::class.java)
                    .putExtra(EXTRA_MODE, if (mode == MODE_RESET) MODE_RESET else MODE_REGISTER),
            )
            AppActivityTransitions.applyForward(context)
        }
    }
}
