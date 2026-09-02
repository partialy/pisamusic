package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityFavoritesSyncSettingsBinding
import cn.partialy.pm.model.AccountUser
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.network.config.ConfigManager
import cn.partialy.pm.sync.SyncManager
import cn.partialy.pm.sync.SyncOutboxStore
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import coil.load
import coil.transform.CircleCropTransformation
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

/**
 * 收藏与同步：展示账号画像、多指标数据概览及云端同步控制。
 */
@AndroidEntryPoint
class FavoritesSyncSettingsActivity : BaseActivity() {

    @Inject lateinit var syncManager: SyncManager
    @Inject lateinit var playlistCollectionManager: PlaylistCollectionManager
    @Inject lateinit var configManager: ConfigManager

    private lateinit var binding: ActivityFavoritesSyncSettingsBinding
    private var isSyncing = false

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityFavoritesSyncSettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setupSystemBars()
        setupToolbar()
        setupButtons()
    }

    override fun onResume() {
        super.onResume()
        refreshDisplay()
    }

    // ==================== UI 初始化 ====================

    private fun setupSystemBars() {
        val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = !isNight, lightNavigationBarIcons = !isNight)
        binding.favoritesSyncRoot.applySystemBarsInsets { insets ->
            val lp = binding.statusBarSpacer.layoutParams
            lp.height = insets.top
            binding.statusBarSpacer.layoutParams = lp
            binding.scrollView.setPadding(0, 0, 0, insets.bottom)
        }
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupButtons() {
        binding.btnSyncNow.setOnClickListener { syncNow() }
        binding.btnGoLogin.setOnClickListener { LoginActivity.start(this) }
    }

    // ==================== 数据与状态展示 ====================

    private fun refreshDisplay() {
        val session = AccountSessionStore.read(this)
        val syncState = syncManager.state()

        lifecycleScope.launch {
            val (lovedCount, playlistCount, pendingOps) = withContext(Dispatchers.IO) {
                val loved = loveManager.getLoveList().size
                val playlists = playlistCollectionManager.getAllPlaylists().size
                val pending = if (session.loggedIn) {
                    SyncOutboxStore(this@FavoritesSyncSettingsActivity).listPending(session.user.id).size
                } else 0
                Triple(loved, playlists, pending)
            }

            // 1. 账号卡片
            if (session.loggedIn) {
                binding.containerLoggedIn.visibility = View.VISIBLE
                binding.containerNotLoggedIn.visibility = View.GONE
                binding.accountNickname.text = session.user.username.ifBlank { "用户" }
                binding.accountSubtitle.text = session.user.email.ifBlank {
                    session.user.phone.orEmpty()
                }.ifBlank { "UID: ${session.user.id}" }
                binding.vipBadge.visibility = if (session.vipActive) View.VISIBLE else View.GONE

                val avatarUrl = resolveAccountAvatarUrl(session.user)
                if (avatarUrl.isNullOrBlank()) {
                    binding.avatarImageView.setImageResource(R.drawable.ic_pm_icon)
                } else {
                    binding.avatarImageView.load(avatarUrl) {
                        placeholder(R.drawable.ic_pm_icon)
                        error(R.drawable.ic_pm_icon)
                        transformations(CircleCropTransformation())
                    }
                }
            } else {
                binding.containerLoggedIn.visibility = View.GONE
                binding.containerNotLoggedIn.visibility = View.VISIBLE
            }

            // 2. 数据概览 4 磁贴
            binding.overviewLovedCount.text = getString(R.string.data_count_songs_format, lovedCount)
            binding.overviewPlaylistCount.text = getString(R.string.data_count_playlists_format, playlistCount)
            binding.overviewPendingOpsCount.text = "${pendingOps} 条"
            if (pendingOps > 0) {
                binding.overviewPendingOpsCount.setTextColor(ContextCompat.getColor(this@FavoritesSyncSettingsActivity, R.color.orange_tag))
            } else {
                binding.overviewPendingOpsCount.setTextColor(
                    ContextCompat.getColor(this@FavoritesSyncSettingsActivity, R.color.primary)
                )
            }
            binding.overviewSyncVersion.text = if (session.loggedIn && syncState.lastVersion > 0L) {
                "v${syncState.lastVersion}"
            } else if (session.loggedIn) {
                "v0"
            } else {
                "-"
            }

            // 3. 同步控制与状态
            binding.btnSyncNow.isEnabled = session.loggedIn && !isSyncing
            binding.btnSyncNow.text = if (isSyncing) {
                getString(R.string.settings_syncing)
            } else {
                getString(R.string.sync_now_button)
            }

            if (session.loggedIn && syncState.lastSyncAt > 0L) {
                val timeStr = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(syncState.lastSyncAt))
                binding.lastSyncTimeText.text = timeStr
            } else {
                binding.lastSyncTimeText.text = getString(R.string.settings_not_synced)
            }

            when {
                isSyncing -> {
                    binding.syncStatusText.visibility = View.VISIBLE
                    binding.syncStatusText.setText(R.string.sync_status_syncing)
                    binding.syncStatusText.setTextColor(ContextCompat.getColor(this@FavoritesSyncSettingsActivity, R.color.primary))
                }
                syncState.lastError.isNotBlank() -> {
                    binding.syncStatusText.visibility = View.VISIBLE
                    binding.syncStatusText.text = getString(R.string.sync_status_failed, syncState.lastError)
                    binding.syncStatusText.setTextColor(ContextCompat.getColor(this@FavoritesSyncSettingsActivity, R.color.red))
                }
                session.loggedIn && syncState.lastSyncAt > 0L -> {
                    binding.syncStatusText.visibility = View.VISIBLE
                    binding.syncStatusText.setText(R.string.sync_status_synced)
                    binding.syncStatusText.setTextColor(ContextCompat.getColor(this@FavoritesSyncSettingsActivity, R.color.primary))
                }
                else -> {
                    binding.syncStatusText.visibility = View.GONE
                }
            }
        }
    }

    private fun syncNow() {
        if (isSyncing) return
        isSyncing = true
        refreshDisplay()

        lifecycleScope.launch {
            val state = syncManager.syncNow()
            isSyncing = false
            refreshDisplay()
            val msg = if (state.lastError.isBlank()) {
                getString(R.string.settings_sync_complete)
            } else {
                state.lastError
            }
            Toast.makeText(this@FavoritesSyncSettingsActivity, msg, Toast.LENGTH_SHORT).show()
        }
    }

    private fun resolveAccountAvatarUrl(user: AccountUser): String? {
        val raw = user.avatarUrl.ifBlank { user.avatar }.trim()
        if (raw.isBlank()) return null
        return configManager.resolveSystemUrl(raw)
    }

    // ==================== 导航 ====================

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, FavoritesSyncSettingsActivity::class.java)
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }
}
