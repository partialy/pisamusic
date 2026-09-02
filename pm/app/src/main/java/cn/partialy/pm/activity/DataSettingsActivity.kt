package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import cn.partialy.pm.R
import cn.partialy.pm.sync.SyncManager
import cn.partialy.pm.sync.SyncPrefs
import cn.partialy.pm.ui.settings.SubSettingsItem
import cn.partialy.pm.ui.settings.SubSettingsSection
import dagger.hilt.android.AndroidEntryPoint
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

@AndroidEntryPoint
class DataSettingsActivity : SubSettingsActivity() {
    override val settingsPageTitle: CharSequence by lazy { getString(R.string.settings_data_title) }

    @Inject
    lateinit var syncManager: SyncManager

    override fun createSettingsSections(): List<SubSettingsSection> = listOf(
        SubSettingsSection(
            id = "data",
            items = listOf(
                SubSettingsItem.Navigation(
                    id = ITEM_SYNC,
                    title = getString(R.string.settings_sync_title),
                    value = syncSummary(syncManager.state()),
                    summary = getString(R.string.settings_sync_summary),
                ),
                SubSettingsItem.Navigation(
                    id = ITEM_CACHE,
                    title = getString(R.string.settings_cache_title),
                    summary = getString(R.string.settings_cache_summary),
                ),
                SubSettingsItem.Navigation(
                    id = ITEM_IMPORT_EXPORT,
                    title = getString(R.string.settings_import_export_title),
                    summary = getString(R.string.settings_import_export_summary),
                ),
            ),
        ),
    )

    override fun onSettingsItemClick(item: SubSettingsItem) {
        when (item.id) {
            ITEM_IMPORT_EXPORT -> DataManagementActivity.start(this)
            ITEM_SYNC -> FavoritesSyncSettingsActivity.start(this)
            ITEM_CACHE -> CacheManagementActivity.start(this)
        }
    }

    private fun syncSummary(state: SyncPrefs.State): String {
        if (!state.loggedIn) return getString(R.string.settings_not_logged_in)
        val time = if (state.lastSyncAt > 0L) {
            SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(state.lastSyncAt))
        } else {
            getString(R.string.settings_not_synced)
        }
        return if (state.lastError.isBlank()) {
            if (state.lastSyncAt > 0L) {
                getString(R.string.settings_synced_at, time)
            } else {
                getString(R.string.settings_logged_in_at, time)
            }
        } else {
            getString(R.string.settings_sync_error_detail, state.lastError)
        }
    }

    companion object {
        private const val ITEM_IMPORT_EXPORT = "import_export"
        private const val ITEM_SYNC = "favorites_sync"
        private const val ITEM_CACHE = "cache_management"

        fun start(context: Context) {
            context.startActivity(Intent(context, DataSettingsActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
