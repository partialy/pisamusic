package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.dialog.SettingsOption
import cn.partialy.pm.ui.dialog.showSettingsOptionPicker
import cn.partialy.pm.ui.settings.SubSettingsItem
import cn.partialy.pm.ui.settings.SubSettingsSection
import cn.partialy.pm.utils.SettingsPrefs
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class PlaybackSettingsActivity : SubSettingsActivity() {
    override val settingsPageTitle: CharSequence = "播放设置"

    override fun createSettingsSections(): List<SubSettingsSection> = listOf(
        SubSettingsSection(
            id = "playback",
            items = listOf(
                SubSettingsItem.Option(
                    id = ITEM_AUTO_SWITCH_LIST,
                    title = "播放切换",
                    value = autoSwitchListModeSummary(SettingsPrefs.getAutoSwitchListMode(this)),
                ),
                SubSettingsItem.Option(
                    id = ITEM_AUDIO_COEXISTENCE,
                    title = "与其他应用同时播放",
                    value = audioCoexistenceModeSummary(SettingsPrefs.getAudioCoexistenceMode(this)),
                ),
            ),
        ),
    )

    override fun onSettingsItemClick(item: SubSettingsItem) {
        when (item.id) {
            ITEM_AUTO_SWITCH_LIST -> showAutoSwitchListPicker()
            ITEM_AUDIO_COEXISTENCE -> showAudioCoexistencePicker()
        }
    }

    private fun showAutoSwitchListPicker() {
        lifecycleScope.launch {
            val current = SettingsPrefs.getAutoSwitchListMode(this@PlaybackSettingsActivity)
            val picked = showSettingsOptionPicker(
                context = this@PlaybackSettingsActivity,
                title = "播放切换",
                options = listOf(
                    SettingsOption("off", "关闭（默认）"),
                    SettingsOption("local", "本地歌曲"),
                    SettingsOption("cached", "已缓存歌曲"),
                    SettingsOption("downloaded", "已下载歌曲"),
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
                title = "选择允许同时播放音乐的场景",
                options = listOf(
                    SettingsOption(
                        id = "all",
                        label = "所有场景",
                        summary = "游戏、影音、直播、短视频、录制、音视频通话等",
                    ),
                    SettingsOption(
                        id = "partial",
                        label = "部分场景",
                        summary = "游戏、影音、直播、短视频等（录制、音视频通话除外）",
                    ),
                    SettingsOption(id = "off", label = "关闭"),
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
        SettingsPrefs.AutoSwitchListMode.Off -> "关闭（默认）"
        SettingsPrefs.AutoSwitchListMode.Local -> "本地歌曲"
        SettingsPrefs.AutoSwitchListMode.Cached -> "已缓存歌曲"
        SettingsPrefs.AutoSwitchListMode.Downloaded -> "已下载歌曲"
    }

    private fun audioCoexistenceModeSummary(mode: SettingsPrefs.AudioCoexistenceMode): String = when (mode) {
        SettingsPrefs.AudioCoexistenceMode.All -> "所有场景"
        SettingsPrefs.AudioCoexistenceMode.Partial -> "部分场景"
        SettingsPrefs.AudioCoexistenceMode.Off -> "关闭"
    }

    private fun showAutoSwitchModeSavedDialog(mode: SettingsPrefs.AutoSwitchListMode) {
        PmMinimalDialog.show(
            context = this,
            message = if (mode == SettingsPrefs.AutoSwitchListMode.Off) {
                "在线歌曲播放失败时将自动暂停。"
            } else {
                "在线歌曲播放失败时将自动播放对应歌曲列表。"
            },
            confirmText = "我知道了",
            singleButton = true,
        )
    }

    companion object {
        private const val ITEM_AUTO_SWITCH_LIST = "auto_switch_list"
        private const val ITEM_AUDIO_COEXISTENCE = "audio_coexistence"

        fun start(context: Context) {
            context.startActivity(Intent(context, PlaybackSettingsActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
