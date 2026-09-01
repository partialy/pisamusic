package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.dialog.SettingsOption
import cn.partialy.pm.ui.dialog.SleepTimerPresetSettingsBottomSheet
import cn.partialy.pm.ui.dialog.showSettingsOptionPicker
import cn.partialy.pm.player.SleepTimerManager
import cn.partialy.pm.ui.settings.SubSettingsItem
import cn.partialy.pm.ui.settings.SubSettingsSection
import cn.partialy.pm.utils.SettingsPrefs
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.launch

@AndroidEntryPoint
class PlaybackSettingsActivity : SubSettingsActivity() {
    @Inject
    lateinit var sleepTimerManager: SleepTimerManager

    override val settingsPageTitle: CharSequence by lazy { getString(R.string.settings_playback_title) }

    override fun createSettingsSections(): List<SubSettingsSection> = listOf(
        SubSettingsSection(
            id = "playback",
            items = listOf(
                SubSettingsItem.Option(
                    id = ITEM_AUTO_SWITCH_LIST,
                    title = getString(R.string.settings_playback_switch),
                    value = autoSwitchListModeSummary(SettingsPrefs.getAutoSwitchListMode(this)),
                ),
                SubSettingsItem.Option(
                    id = ITEM_AUDIO_COEXISTENCE,
                    title = getString(R.string.settings_audio_coexistence),
                    value = audioCoexistenceModeSummary(SettingsPrefs.getAudioCoexistenceMode(this)),
                ),
                SubSettingsItem.Switch(
                    id = ITEM_DYNAMIC_LYRIC_BACKGROUND,
                    title = getString(R.string.settings_dynamic_lyric_background),
                    checked = SettingsPrefs.isDynamicLyricBackgroundEnabled(this),
                    summary = getString(R.string.settings_dynamic_lyric_background_summary),
                ),
                SubSettingsItem.Navigation(
                    id = ITEM_SLEEP_TIMER_CONFIG,
                    title = getString(R.string.settings_sleep_timer_config),
                    value = getString(
                        R.string.settings_sleep_timer_presets_value,
                        sleepTimerManager.presets.value.joinToString(" / "),
                    ),
                ),
            ),
        ),
    )

    override fun onSettingsItemClick(item: SubSettingsItem) {
        when (item.id) {
            ITEM_AUTO_SWITCH_LIST -> showAutoSwitchListPicker()
            ITEM_AUDIO_COEXISTENCE -> showAudioCoexistencePicker()
            ITEM_SLEEP_TIMER_CONFIG -> SleepTimerPresetSettingsBottomSheet.show(
                activity = this,
                sleepTimerManager = sleepTimerManager,
                onSaved = ::refreshSettings,
            )
        }
    }

    override fun onSettingsSwitchChanged(item: SubSettingsItem.Switch, checked: Boolean) {
        when (item.id) {
            ITEM_DYNAMIC_LYRIC_BACKGROUND -> {
                SettingsPrefs.setDynamicLyricBackgroundEnabled(this, checked)
                refreshSettings()
            }
        }
    }

    private fun showAutoSwitchListPicker() {
        lifecycleScope.launch {
            val current = SettingsPrefs.getAutoSwitchListMode(this@PlaybackSettingsActivity)
            val picked = showSettingsOptionPicker(
                context = this@PlaybackSettingsActivity,
                title = getString(R.string.settings_playback_switch),
                options = listOf(
                    SettingsOption("off", getString(R.string.settings_auto_switch_off)),
                    SettingsOption("local", getString(R.string.settings_auto_switch_local)),
                    SettingsOption("cached", getString(R.string.settings_auto_switch_cached)),
                    SettingsOption("downloaded", getString(R.string.settings_auto_switch_downloaded)),
                ),
                selectedIndex = when (current) {
                    SettingsPrefs.AutoSwitchListMode.Off -> 0
                    SettingsPrefs.AutoSwitchListMode.Local -> 1
                    SettingsPrefs.AutoSwitchListMode.Cached -> 2
                    SettingsPrefs.AutoSwitchListMode.Downloaded -> 3
                },
            )
            val mode = when (picked?.id) {
                "off" -> SettingsPrefs.AutoSwitchListMode.Off
                "local" -> SettingsPrefs.AutoSwitchListMode.Local
                "cached" -> SettingsPrefs.AutoSwitchListMode.Cached
                "downloaded" -> SettingsPrefs.AutoSwitchListMode.Downloaded
                else -> return@launch
            }
            SettingsPrefs.setAutoSwitchListMode(this@PlaybackSettingsActivity, mode)
            refreshSettings()
            showAutoSwitchModeSavedDialog(mode)
        }
    }

    private fun showAudioCoexistencePicker() {
        lifecycleScope.launch {
            val current = SettingsPrefs.getAudioCoexistenceMode(this@PlaybackSettingsActivity)
            val picked = showSettingsOptionPicker(
                context = this@PlaybackSettingsActivity,
                title = getString(R.string.settings_coexistence_picker_title),
                options = listOf(
                    SettingsOption(
                        id = "all",
                        label = getString(R.string.settings_coexistence_all),
                        summary = getString(R.string.settings_coexistence_all_summary),
                    ),
                    SettingsOption(
                        id = "partial",
                        label = getString(R.string.settings_coexistence_partial),
                        summary = getString(R.string.settings_coexistence_partial_summary),
                    ),
                    SettingsOption(id = "off", label = getString(R.string.settings_coexistence_off)),
                ),
                selectedIndex = when (current) {
                    SettingsPrefs.AudioCoexistenceMode.All -> 0
                    SettingsPrefs.AudioCoexistenceMode.Partial -> 1
                    SettingsPrefs.AudioCoexistenceMode.Off -> 2
                },
            )
            val mode = when (picked?.id) {
                "all" -> SettingsPrefs.AudioCoexistenceMode.All
                "partial" -> SettingsPrefs.AudioCoexistenceMode.Partial
                "off" -> SettingsPrefs.AudioCoexistenceMode.Off
                else -> return@launch
            }
            musicController.applyAudioCoexistenceMode(mode)
            refreshSettings()
        }
    }

    private fun autoSwitchListModeSummary(mode: SettingsPrefs.AutoSwitchListMode): String = when (mode) {
        SettingsPrefs.AutoSwitchListMode.Off -> getString(R.string.settings_auto_switch_off)
        SettingsPrefs.AutoSwitchListMode.Local -> getString(R.string.settings_auto_switch_local)
        SettingsPrefs.AutoSwitchListMode.Cached -> getString(R.string.settings_auto_switch_cached)
        SettingsPrefs.AutoSwitchListMode.Downloaded -> getString(R.string.settings_auto_switch_downloaded)
    }

    private fun audioCoexistenceModeSummary(mode: SettingsPrefs.AudioCoexistenceMode): String = when (mode) {
        SettingsPrefs.AudioCoexistenceMode.All -> getString(R.string.settings_coexistence_all)
        SettingsPrefs.AudioCoexistenceMode.Partial -> getString(R.string.settings_coexistence_partial)
        SettingsPrefs.AudioCoexistenceMode.Off -> getString(R.string.settings_coexistence_off)
    }

    private fun showAutoSwitchModeSavedDialog(mode: SettingsPrefs.AutoSwitchListMode) {
        PmMinimalDialog.show(
            context = this,
            message = if (mode == SettingsPrefs.AutoSwitchListMode.Off) {
                getString(R.string.settings_switch_failure_pause)
            } else {
                getString(R.string.settings_switch_failure_list)
            },
            confirmText = getString(R.string.dialog_i_know),
            singleButton = true,
        )
    }

    companion object {
        private const val ITEM_AUTO_SWITCH_LIST = "auto_switch_list"
        private const val ITEM_AUDIO_COEXISTENCE = "audio_coexistence"
        private const val ITEM_DYNAMIC_LYRIC_BACKGROUND = "dynamic_lyric_background"
        private const val ITEM_SLEEP_TIMER_CONFIG = "sleep_timer_config"

        fun start(context: Context) {
            context.startActivity(Intent(context, PlaybackSettingsActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
