package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Bundle
import android.os.CountDownTimer
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
    private val isResetMode: Boolean
        get() = intent.getStringExtra(EXTRA_MODE) == MODE_RESET

    @Inject
    lateinit var configManager: ConfigManager

    @Inject
    lateinit var syncManager: SyncManager

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityAccountAssistBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setupSystemBars()
        bindActions()
        applyMode()
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
        binding.accountAssistSendCodeButton.setOnClickListener { sendEmailCode() }
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

    private fun sendEmailCode() {
        val email = emailText()
        if (email.isBlank()) {
            toast(R.string.account_login_email_required)
            return
        }
        binding.accountAssistSendCodeButton.isEnabled = false
        lifecycleScope.launch {
            runCatching {
                val purpose = if (isResetMode) "reset_password" else "register"
                withContext(Dispatchers.IO) {
                    configManager.sendAccountEmailCode(email, purpose)
                }
            }.onSuccess {
                toast(R.string.account_login_code_sent)
                startCodeCountDown()
            }.onFailure { error ->
                binding.accountAssistSendCodeButton.isEnabled = true
                toast(error.message ?: getString(R.string.account_assist_code_send_failed))
            }
        }
    }

    private fun registerAccount() {
        val email = emailText()
        val username = usernameText()
        val password = passwordText()
        val code = codeText()
        if (email.isBlank()) {
            toast(R.string.account_login_email_required)
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
                    configManager.registerAccount(email, username, password, code)
                }
            }.onSuccess(::notifyRegistered)
                .onFailure { error ->
                    setLoading(false)
                    toast(error.message ?: getString(R.string.account_assist_register_failed))
                }
        }
    }

    private fun resetPassword() {
        val email = emailText()
        val password = passwordText()
        val code = codeText()
        if (email.isBlank()) {
            toast(R.string.account_login_email_required)
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
                    configManager.resetAccountPassword(email, code, password)
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
        binding.accountAssistSubmitButton.isEnabled = !loading
        binding.accountAssistBackButton.isEnabled = !loading
        binding.accountAssistSendCodeButton.isEnabled = !loading && !codeCountingDown
        binding.accountAssistSubmitButton.alpha = if (loading) 0.72f else 1f
    }

    private fun emailText(): String =
        binding.accountAssistEmailEditText.text?.toString()?.trim().orEmpty()

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
