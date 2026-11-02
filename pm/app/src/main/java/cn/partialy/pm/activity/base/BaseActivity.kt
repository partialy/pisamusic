package cn.partialy.pm.activity.base

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import cn.partialy.pm.R
import cn.partialy.pm.activity.AppActivityTransitions
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.player.PlaybackUiEvent
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.utils.SettingsPrefs
import cn.partialy.pm.utils.loveUtil.LoveManager
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.launch

@AndroidEntryPoint
open class BaseActivity : AppCompatActivity() {

    @Inject
    lateinit var loveManager: LoveManager

    @Inject
    lateinit var musicController: MusicController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        observePlaybackUiEvents()
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
