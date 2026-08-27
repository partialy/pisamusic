package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.sync.SyncManager
import cn.partialy.pm.sync.SyncPrefs
import cn.partialy.pm.ui.settings.SubSettingsItem
import cn.partialy.pm.ui.settings.SubSettingsSection
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

@AndroidEntryPoint
class FavoritesSyncSettingsActivity : SubSettingsActivity() {
    override val settingsPageTitle: CharSequence by lazy { getString(R.string.settings_sync_title) }

    @Inject
    lateinit var syncManager: SyncManager

    private var isSyncing = false

    override fun createSettingsSections(): List<SubSettingsSection> {
        val state = syncManager.state()
        return listOf(
            SubSettingsSection(
                id = "sync_status",
                title = getString(R.string.settings_status),
                items = listOf(
                    SubSettingsItem.Info(
                        id = ITEM_LOGIN_STATUS,
                        title = getString(R.string.settings_login_status),
                        value = getString(
                            if (state.loggedIn) R.string.settings_logged_in else R.string.settings_not_logged_in,
                        ),
                        summary = accountSummary(state),
                    ),
                    SubSettingsItem.Info(
                        id = ITEM_LAST_SYNC,
                        title = getString(R.string.settings_last_sync),
                        value = lastSyncSummary(state),
                    ),
                    SubSettingsItem.Info(
                        id = ITEM_SYNC_ERROR,
                        title = getString(R.string.settings_error_status),
                        value = getString(
                            if (state.lastError.isBlank()) R.string.settings_none else R.string.settings_sync_error,
                        ),
                        summary = state.lastError.ifBlank { null },
                    ),
                ),
            ),
            SubSettingsSection(
                id = "sync_action",
                items = listOf(
                    if (state.loggedIn) {
                        SubSettingsItem.Option(
                            id = ITEM_SYNC_NOW,
                            title = getString(
                                if (isSyncing) R.string.settings_syncing else R.string.settings_sync_now,
                            ),
                            summary = getString(R.string.settings_sync_summary),
                            enabled = !isSyncing,
                        )
                    } else {
                        SubSettingsItem.Navigation(
                            id = ITEM_LOGIN,
                            title = getString(R.string.settings_go_login),
                            summary = getString(R.string.settings_login_to_sync),
                        )
                    },
                ),
            ),
        )
    }

    override fun onSettingsItemClick(item: SubSettingsItem) {
        when (item.id) {
            ITEM_SYNC_NOW -> syncNow()
            ITEM_LOGIN -> LoginActivity.start(this)
        }
    }

    private fun syncNow() {
        if (isSyncing) return
        isSyncing = true
        refreshSettings()
        showMessage(getString(R.string.settings_syncing))
        lifecycleScope.launch {
            val state = syncManager.syncNow()
            isSyncing = false
            refreshSettings()
            showMessage(if (state.lastError.isBlank()) getString(R.string.settings_sync_complete) else state.lastError)
        }
    }

    private fun accountSummary(state: SyncPrefs.State): String? {
        if (!state.loggedIn) return getString(R.string.settings_login_to_sync)
        return listOf(state.username, state.email)
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .joinToString(" / ")
            .ifBlank { null }
    }

    private fun lastSyncSummary(state: SyncPrefs.State): String {
        if (!state.loggedIn || state.lastSyncAt <= 0L) return getString(R.string.settings_not_synced)
        return SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(state.lastSyncAt))
    }

    companion object {
        private const val ITEM_LOGIN_STATUS = "login_status"
        private const val ITEM_LAST_SYNC = "last_sync"
        private const val ITEM_SYNC_ERROR = "sync_error"
        private const val ITEM_SYNC_NOW = "sync_now"
        private const val ITEM_LOGIN = "login"

        fun start(context: Context) {
            context.startActivity(Intent(context, FavoritesSyncSettingsActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
