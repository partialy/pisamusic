package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import androidx.lifecycle.lifecycleScope
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
    override val settingsPageTitle: CharSequence = "收藏与同步"

    @Inject
    lateinit var syncManager: SyncManager

    private var isSyncing = false

    override fun createSettingsSections(): List<SubSettingsSection> {
        val state = syncManager.state()
        return listOf(
            SubSettingsSection(
                id = "sync_status",
                title = "状态",
                items = listOf(
                    SubSettingsItem.Info(
                        id = ITEM_LOGIN_STATUS,
                        title = "登录状态",
                        value = if (state.loggedIn) "已登录" else "未登录",
                        summary = accountSummary(state),
                    ),
                    SubSettingsItem.Info(
                        id = ITEM_LAST_SYNC,
                        title = "最近同步",
                        value = lastSyncSummary(state),
                    ),
                    SubSettingsItem.Info(
                        id = ITEM_SYNC_ERROR,
                        title = "错误状态",
                        value = if (state.lastError.isBlank()) "无" else "同步异常",
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
                            title = if (isSyncing) "正在同步" else "立即同步",
                            summary = "同步账号中的收藏歌曲与歌单",
                            enabled = !isSyncing,
                        )
                    } else {
                        SubSettingsItem.Navigation(
                            id = ITEM_LOGIN,
                            title = "去登录",
                            summary = "登录后可同步收藏歌曲与歌单",
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
        showMessage("正在同步")
        lifecycleScope.launch {
            val state = syncManager.syncNow()
            isSyncing = false
            refreshSettings()
            showMessage(if (state.lastError.isBlank()) "同步完成" else state.lastError)
        }
    }

    private fun accountSummary(state: SyncPrefs.State): String? {
        if (!state.loggedIn) return "登录后可同步收藏歌曲与歌单"
        return listOf(state.username, state.email)
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .joinToString(" / ")
            .ifBlank { null }
    }

    private fun lastSyncSummary(state: SyncPrefs.State): String {
        if (!state.loggedIn || state.lastSyncAt <= 0L) return "未同步"
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
