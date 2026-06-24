package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.widget.Toast
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
class DataSettingsActivity : SubSettingsActivity() {
    override val settingsPageTitle: CharSequence = "数据管理"

    @Inject
    lateinit var syncManager: SyncManager

    override fun createSettingsSections(): List<SubSettingsSection> = listOf(
        SubSettingsSection(
            id = "data",
            items = listOf(
                SubSettingsItem.Navigation(
                    id = ITEM_IMPORT_EXPORT,
                    title = "导入与导出",
                    summary = "备份、恢复或清除本地收藏与歌单数据",
                ),
                SubSettingsItem.Option(
                    id = ITEM_SYNC,
                    title = "收藏与同步",
                    value = syncSummary(syncManager.state()),
                    summary = "同步账号中的收藏歌曲与歌单",
                ),
                SubSettingsItem.Navigation(
                    id = ITEM_CACHE,
                    title = "缓存管理",
                    summary = "查看并清理歌曲、歌词及下载文件",
                ),
            ),
        ),
    )

    override fun onSettingsItemClick(item: SubSettingsItem) {
        when (item.id) {
            ITEM_IMPORT_EXPORT -> DataManagementActivity.start(this)
            ITEM_SYNC -> {
                if (syncManager.state().loggedIn) syncNow() else LoginActivity.start(this)
            }
            ITEM_CACHE -> CacheManagementActivity.start(this)
        }
    }

    private fun syncNow() {
        lifecycleScope.launch {
            Toast.makeText(this@DataSettingsActivity, "正在同步", Toast.LENGTH_SHORT).show()
            val state = syncManager.syncNow()
            refreshSettings()
            Toast.makeText(
                this@DataSettingsActivity,
                if (state.lastError.isBlank()) "同步完成" else state.lastError,
                Toast.LENGTH_SHORT,
            ).show()
        }
    }

    private fun syncSummary(state: SyncPrefs.State): String {
        if (!state.loggedIn) return "未登录"
        val time = if (state.lastSyncAt > 0L) {
            SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(state.lastSyncAt))
        } else {
            "未同步"
        }
        return if (state.lastError.isBlank()) {
            if (state.lastSyncAt > 0L) "已同步 · $time" else "已登录 · $time"
        } else {
            "同步异常 · ${state.lastError}"
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
