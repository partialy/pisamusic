package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import cn.partialy.pm.R
import cn.partialy.pm.ui.settings.SubSettingsItem
import cn.partialy.pm.ui.settings.SubSettingsSection
import cn.partialy.pm.utils.LyricDisplayPrefs
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class LyricSettingsActivity : SubSettingsActivity() {
    override val settingsPageTitle: CharSequence = "歌词设置"

    override fun createSettingsSections(): List<SubSettingsSection> = listOf(
        SubSettingsSection(
            id = "lyric",
            items = listOf(
                SubSettingsItem.Navigation(
                    id = ITEM_STATUS_BAR_LYRIC,
                    title = getString(R.string.settings_status_bar_lyric_title),
                    summary = getString(R.string.settings_status_bar_lyric_summary),
                ),
                SubSettingsItem.Option(
                    id = ITEM_COLOR_PRESETS,
                    title = getString(R.string.settings_lyric_color_presets_title),
                    value = lyricColorPresetSummary(),
                    summary = "设置常规歌词和当前歌词的颜色预设",
                ),
            ),
        ),
    )

    override fun onSettingsItemClick(item: SubSettingsItem) {
        when (item.id) {
            ITEM_STATUS_BAR_LYRIC -> StatusBarLyricSettingsActivity.start(this)
            ITEM_COLOR_PRESETS -> LyricColorPresetsActivity.start(this)
        }
    }

    private fun lyricColorPresetSummary(): String {
        val normalCount = LyricDisplayPrefs.getNormalColorRgbPresets(this).size
        val currentCount = LyricDisplayPrefs.getCurrentColorArgbPresets(this).size
        return getString(R.string.settings_lyric_color_presets_summary, normalCount, currentCount)
    }

    companion object {
        private const val ITEM_STATUS_BAR_LYRIC = "status_bar_lyric"
        private const val ITEM_COLOR_PRESETS = "lyric_color_presets"

        fun start(context: Context) {
            context.startActivity(Intent(context, LyricSettingsActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
