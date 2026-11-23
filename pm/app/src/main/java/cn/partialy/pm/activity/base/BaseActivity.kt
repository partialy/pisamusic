package cn.partialy.pm.activity.base

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import cn.partialy.pm.R
import cn.partialy.pm.activity.AppActivityTransitions
import cn.partialy.pm.activity.ServiceInterceptActivity
import cn.partialy.pm.model.AndroidStartupRequest
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.player.PlaybackUiEvent
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.home.MainStartupCoordinator.Companion.isCurrentlyLocked
import cn.partialy.pm.ui.home.MainStartupCoordinator.Companion.isServiceUnavailable
import cn.partialy.pm.ui.home.MainStartupCoordinator.Companion.lockedMessage
import cn.partialy.pm.ui.home.StartupAgreementPrefs
import cn.partialy.pm.util.DeviceInfoCollector
import cn.partialy.pm.utils.ServerDevicePrefs
import cn.partialy.pm.utils.SettingsPrefs
import cn.partialy.pm.utils.loveUtil.LoveManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@AndroidEntryPoint
open class BaseActivity : AppCompatActivity() {

    @Inject
    lateinit var loveManager: LoveManager

    @Inject
    lateinit var musicController: MusicController

    @Inject
    lateinit var runtimeConfigManager: ConfigManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        observePlaybackUiEvents()
    }

    override fun onResume() {
        super.onResume()
        revalidateRestoredRuntimeIfNeeded()
    }

    private fun revalidateRestoredRuntimeIfNeeded() {
        if (this is ServiceInterceptActivity) return
        if (runtimeConfigManager.isLocalMode() || runtimeConfigManager.hasFreshBootstrapInProcess()) return
        lifecycleScope.launch {
            val startupData = try {
                withContext(Dispatchers.IO) {
                    val session = AccountSessionStore.read(this@BaseActivity)
                    val request = AndroidStartupRequest(
                        device = DeviceInfoCollector.build(this@BaseActivity),
                        agreementVersion = StartupAgreementPrefs.readAcceptedVersion(this@BaseActivity),
                    )
                    runtimeConfigManager.revalidateRestoredRuntimeIfNeeded(
                        request = request,
                        bearerToken = session.token.takeIf { session.loggedIn },
                    )
                }
            } catch (cancelled: CancellationException) {
                throw cancelled
            } catch (error: Throwable) {
                if (error.isServiceUnavailable() && !isFinishing && !isDestroyed) {
                    val apiError = error as? ConfigManager.ApiException
                    ServiceInterceptActivity.startForServiceUnavailable(
                        activity = this@BaseActivity,
                        message = error.message ?: getString(R.string.startup_unavailable_title),
                        code = apiError?.code ?: -233,
                    )
                }
                null
            } ?: return@launch

            ServerDevicePrefs.saveReportIdentity(
                this@BaseActivity,
                startupData.device.id,
                startupData.device.messageToken,
            )
            if (startupData.device.isCurrentlyLocked() && !isFinishing && !isDestroyed) {
                ServiceInterceptActivity.startForDeviceLocked(
                    activity = this@BaseActivity,
                    report = startupData.device,
                    message = startupData.device.lockedMessage(this@BaseActivity),
                )
            }
        }
    }

    private fun observePlaybackUiEvents() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                musicController.playbackEvents.collect { event ->
                    when (event) {
                        is PlaybackUiEvent.NetworkPoorPaused -> showNetworkPoorPausedDialog()
                        is PlaybackUiEvent.AutoSwitched -> showAutoSwitchedDialog(event)
                    }
                }
            }
        }
    }

    private fun showNetworkPoorPausedDialog() {
        PmMinimalDialog.show(
            context = this,
            message = getString(R.string.network_local_mode_message),
            confirmText = getString(R.string.dialog_i_know),
            singleButton = true,
        )
    }

    private fun showAutoSwitchedDialog(event: PlaybackUiEvent.AutoSwitched) {
        val label = when (event.mode) {
            SettingsPrefs.AutoSwitchListMode.Local -> getString(R.string.network_list_local)
            SettingsPrefs.AutoSwitchListMode.Cached -> getString(R.string.network_list_cached)
            SettingsPrefs.AutoSwitchListMode.Downloaded -> getString(R.string.network_list_downloaded)
            SettingsPrefs.AutoSwitchListMode.Off -> getString(R.string.network_list_local)
        }
        PmMinimalDialog.show(
            context = this,
            message = getString(R.string.network_switched_list, label),
            confirmText = getString(R.string.dialog_i_know),
            singleButton = true,
        )
    }

    protected open val defaultActivityTransitionEnabled: Boolean = true

    override fun finish() {
        super.finish()
        if (defaultActivityTransitionEnabled) {
            AppActivityTransitions.applyBack(this)
        }
    }

}
