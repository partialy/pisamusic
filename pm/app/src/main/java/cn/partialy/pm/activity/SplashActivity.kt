package cn.partialy.pm.activity

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import android.view.animation.DecelerateInterpolator
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.updatePadding
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ActivitySplashBinding
import cn.partialy.pm.model.AndroidStartupRequest
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.home.MainStartupCoordinator.Companion.isCurrentlyLocked
import cn.partialy.pm.ui.home.MainStartupCoordinator.Companion.isServiceUnavailable
import cn.partialy.pm.ui.home.MainStartupCoordinator.Companion.lockedMessage
import cn.partialy.pm.ui.home.StartupAgreementPrefs
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.util.DeviceInfoCollector
import cn.partialy.pm.utils.ServerDevicePrefs
import cn.partialy.pm.utils.loveUtil.LoveManager
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.TimeoutCancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import javax.inject.Inject

/**
 * 原生启动页：XML 渐变品牌区 + Canvas 音柱动效，状态栏隐藏。
 * 结合 SWR 服务发现缓存优先，在单次 `POST /api/config/startup` 内完成必须配置拉取与启动上下文聚合：
 * - 若返回 `-233` 或设备封禁 `locked`，立即跳转全屏 [ServiceInterceptActivity]；
 * - 否则立即进入 [MainActivity]，由 [MainStartupCoordinator] 消费内存快照零等待按需弹窗。
 */
@SuppressLint("CustomSplashScreen")
@AndroidEntryPoint
class SplashActivity : AppCompatActivity() {

    private lateinit var binding: ActivitySplashBinding
    private var hasNavigated = false
    private var bootstrapRequested = false
    private var pendingScanLink: String? = null
    private var localModeButtonJob: Job? = null
    private var openingMain = false

    @Inject
    lateinit var configManager: ConfigManager

    @Inject
    lateinit var loveManager: LoveManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        captureScanLink(intent)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideStatusBar()

        binding = ActivitySplashBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.splashRoot.applySystemBarsInsets { insets ->
            binding.splashRoot.updatePadding(bottom = insets.bottom)
        }
        binding.btnEnterLocalMode.setOnClickListener {
            enterLocalModeImmediately(getString(R.string.splash_local_mode_manual_reason))
        }
        playBrandEntranceAnimation()

        tryBootstrap()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    finish()
                }
            },
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        captureScanLink(intent)
    }

    override fun onDestroy() {
        localModeButtonJob?.cancel()
        if (::binding.isInitialized) {
            binding.splashBrandGroup.animate().cancel()
            binding.splashLocalModeBox.animate().cancel()
        }
        super.onDestroy()
    }

    private fun hideStatusBar() {
        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.statusBars())
            isAppearanceLightNavigationBars = !isNight
            systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun playBrandEntranceAnimation() {
        if (!ValueAnimator.areAnimatorsEnabled()) return
        val offsetPx = 20f * resources.displayMetrics.density
        binding.splashBrandGroup.alpha = 0f
        binding.splashBrandGroup.translationY = offsetPx
        binding.splashBrandGroup.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(600L)
            .setInterpolator(DecelerateInterpolator())
            .start()
    }

    private fun tryBootstrap() {
        if (bootstrapRequested || hasNavigated) return
        bootstrapRequested = true

        lifecycleScope.launch {
            if (hasNavigated) return@launch
            configManager.beginOnlineStartup()
            scheduleLocalModeButtonIfNeeded()

            runCatching {
                withTimeout(SPLASH_BOOTSTRAP_TIMEOUT_MS) {
                    withContext(Dispatchers.IO) {
                        val session = AccountSessionStore.read(this@SplashActivity)
                        val request = AndroidStartupRequest(
                            device = DeviceInfoCollector.build(this@SplashActivity),
                            agreementVersion = StartupAgreementPrefs.readAcceptedVersion(this@SplashActivity),
                        )
                        configManager.executeStartupBootstrap(
                            request = request,
                            bearerToken = session.token.takeIf { session.loggedIn },
                        )
                    }
                }
            }.onSuccess { startupData ->
                if (hasNavigated) return@onSuccess
                ServerDevicePrefs.saveReportIdentity(
                    this@SplashActivity,
                    startupData.device.id,
                    startupData.device.messageToken,
                )
                if (startupData.device.isCurrentlyLocked()) {
                    hasNavigated = true
                    cancelLocalModeButton()
                    ServiceInterceptActivity.startForDeviceLocked(
                        activity = this@SplashActivity,
                        report = startupData.device,
                        message = startupData.device.lockedMessage(this@SplashActivity),
                    )
                    return@onSuccess
                }
                hasNavigated = true
                cancelLocalModeButton()
                startMainActivity()
            }.onFailure { error ->
                if (hasNavigated) return@onFailure
                when {
                    error.isServiceUnavailable() -> {
                        hasNavigated = true
                        cancelLocalModeButton()
                        val apiError = error as? ConfigManager.ApiException
                        ServiceInterceptActivity.startForServiceUnavailable(
                            activity = this@SplashActivity,
                            message = error.message ?: getString(R.string.startup_unavailable_title),
                            code = apiError?.code ?: -233,
                        )
                    }

                    error is TimeoutCancellationException -> {
                        enterLocalModeImmediately(getString(R.string.splash_server_connection_failed))
                    }

                    else -> {
                        enterLocalModeImmediately(
                            error.message ?: getString(R.string.splash_server_connection_failed),
                        )
                    }
                }
            }
        }
    }

    private fun scheduleLocalModeButtonIfNeeded() {
        if (hasNavigated) return
        if (localModeButtonJob?.isActive == true) return
        localModeButtonJob = lifecycleScope.launch {
            delay(LOCAL_MODE_BUTTON_DELAY_MS)
            if (!hasNavigated && !isFinishing && !isDestroyed) {
                showLocalModeBox(true)
            }
        }
    }

    private fun cancelLocalModeButton() {
        localModeButtonJob?.cancel()
        localModeButtonJob = null
        showLocalModeBox(false)
    }

    private fun showLocalModeBox(show: Boolean) {
        if (!::binding.isInitialized) return
        val box = binding.splashLocalModeBox
        box.animate().cancel()
        if (!show) {
            box.visibility = View.INVISIBLE
            box.alpha = 0f
            return
        }
        box.visibility = View.VISIBLE
        if (!ValueAnimator.areAnimatorsEnabled()) {
            box.alpha = 1f
            box.translationY = 0f
            return
        }
        box.alpha = 0f
        box.translationY = 6f * resources.displayMetrics.density
        box.animate()
            .alpha(1f)
            .translationY(0f)
            .setDuration(350L)
            .setInterpolator(DecelerateInterpolator())
            .start()
    }

    private fun enterLocalModeImmediately(localModeReason: String) {
        if (hasNavigated) return
        hasNavigated = true
        cancelLocalModeButton()
        if (!isFinishing && !isDestroyed) {
            startMainActivity(localModeReason)
        }
    }

    private fun showErrorDialog(message: String) {
        if (isFinishing || isDestroyed) return
        PmMinimalDialog.show(
            context = this,
            title = getString(R.string.startup_error_title),
            message = message,
            confirmText = getString(R.string.dialog_ok),
            singleButton = true,
            cancelable = false,
            onConfirm = { finishAffinity() },
        )
    }

    private fun captureScanLink(intent: Intent?) {
        intent?.dataString?.trim()?.takeIf { it.isNotEmpty() }?.let { pendingScanLink = it }
    }

    private fun startMainActivity(localModeReason: String? = null) {
        if (openingMain) return
        openingMain = true
        lifecycleScope.launch {
            try {
                loveManager.awaitPreloaded()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                openingMain = false
                hasNavigated = false
                showErrorDialog(e.message ?: "收藏数据读取失败")
                return@launch
            }
            if (!localModeReason.isNullOrBlank()) {
                configManager.enterLocalMode()
            }
            MainActivity.start(
                context = this@SplashActivity,
                localModeReason = localModeReason,
                scanLink = pendingScanLink,
            )
            pendingScanLink = null
            finish()
        }
    }

    companion object {
        private const val LOCAL_MODE_BUTTON_DELAY_MS = 3_000L
        private const val SPLASH_BOOTSTRAP_TIMEOUT_MS = 10_000L
    }
}
