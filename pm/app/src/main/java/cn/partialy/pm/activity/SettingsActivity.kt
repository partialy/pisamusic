package cn.partialy.pm.activity

import android.Manifest
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.Settings
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.annotation.DrawableRes
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import androidx.documentfile.provider.DocumentFile
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.activity.setting.SettingAboutActivity
import cn.partialy.pm.activity.setting.SettingAnnouncementsActivity
import cn.partialy.pm.activity.setting.SettingCheckUpdateActivity
import cn.partialy.pm.databinding.ActivitySettingsBinding
import cn.partialy.pm.sync.SyncManager
import cn.partialy.pm.sync.SyncPrefs
import cn.partialy.pm.ui.dialog.SettingsOption
import cn.partialy.pm.ui.dialog.showSettingsOptionPicker
import cn.partialy.pm.utils.DownloadPathManager
import cn.partialy.pm.utils.LyricDisplayPrefs
import cn.partialy.pm.utils.ServerDevicePrefs
import cn.partialy.pm.utils.SettingsPrefs
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

@AndroidEntryPoint
class SettingsActivity : BaseActivity() {
    private lateinit var binding: ActivitySettingsBinding
    private val uiScope = MainScope()

    @Inject
    lateinit var syncManager: SyncManager

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        when {
            permissions.getOrDefault(Manifest.permission.READ_MEDIA_AUDIO, false) ||
            permissions.getOrDefault(Manifest.permission.READ_EXTERNAL_STORAGE, false) -> {
                // 音频权限被授予
                showDirectoryPicker()
            }
            else -> {
                showPermissionDeniedMessage()
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        // 先创建绑定
        binding = ActivitySettingsBinding.inflate(layoutInflater)
        // 在调用 super.onCreate 之前设置 contentView，这样父类就能找到根视图
        setContentView(binding.root)
        // 调用父类的 onCreate，它会添加悬浮按钮
        super.onCreate(savedInstanceState)

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowTitleEnabled(true)

        binding.toolbar.setNavigationOnClickListener {
            finish()
        }

        binding.downloadLocation.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_download,
                getString(R.string.download_location),
                DownloadPathManager.getDisplayPath(this@SettingsActivity),
            )
            root.setOnClickListener { checkStoragePermission() }
        }

        bindSettingsItems()
    }

    private fun openMainFromSettings(action: String) {
        startActivity(Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(MainActivity.EXTRA_SETTINGS_ACTION, action)
        })
        finish()
    }

    private fun bindSwitchRow(
        row: View,
        @DrawableRes iconRes: Int,
        title: CharSequence,
        summary: CharSequence?,
    ) {
        row.findViewById<ImageView>(R.id.iconImageView).setImageResource(iconRes)
        row.findViewById<TextView>(R.id.titleTextView).text = title
        val summaryTv = row.findViewById<TextView>(R.id.summaryTextView)
        if (summary.isNullOrEmpty()) {
            summaryTv.visibility = View.GONE
            summaryTv.text = ""
        } else {
            summaryTv.visibility = View.VISIBLE
            summaryTv.text = summary
        }
    }

    private fun bindNavRow(
        row: View,
        @DrawableRes iconRes: Int,
        title: CharSequence,
        value: CharSequence?,
    ) {
        row.findViewById<ImageView>(R.id.iconImageView).setImageResource(iconRes)
        row.findViewById<TextView>(R.id.titleTextView).text = title
        val valueTv = row.findViewById<TextView>(R.id.valueTextView)
        if (value.isNullOrEmpty()) {
            valueTv.visibility = View.GONE
            valueTv.text = ""
        } else {
            valueTv.visibility = View.VISIBLE
            valueTv.text = value
        }
    }

    private fun bindSettingsItems() {
        binding.fileNamingRule.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_naming,
                "文件名命名规则",
                fileNamingRuleSummary(SettingsPrefs.getFileNamingRule(this@SettingsActivity)),
            )
            root.setOnClickListener {
                uiScope.launch {
                    val picked = showSettingsOptionPicker(
                        context = this@SettingsActivity,
                        title = "文件名命名规则",
                        options = listOf(
                            SettingsOption("title_artist", "歌名 - 歌手"),
                            SettingsOption("artist_title", "歌手 - 歌名"),
                        ),
                        selectedIndex = when (SettingsPrefs.getFileNamingRule(this@SettingsActivity)) {
                            SettingsPrefs.FileNamingRule.TitleDashArtist -> 0
                            SettingsPrefs.FileNamingRule.ArtistDashTitle -> 1
                        },
                    )
                    val rule = when (picked?.id) {
                        "title_artist" -> SettingsPrefs.FileNamingRule.TitleDashArtist
                        "artist_title" -> SettingsPrefs.FileNamingRule.ArtistDashTitle
                        else -> return@launch
                    }
                    SettingsPrefs.setFileNamingRule(this@SettingsActivity, rule)
                    root.findViewById<TextView>(R.id.valueTextView).text = fileNamingRuleSummary(rule)
                }
            }
        }

        binding.lyricColorPresets.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_color_preset,
                getString(R.string.settings_lyric_color_presets_title),
                lyricColorPresetSummary(),
            )
            root.setOnClickListener {
                LyricColorPresetsActivity.start(this@SettingsActivity)
            }
        }

        binding.statusBarLyrics.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_statusbar_lyric,
                getString(R.string.settings_status_bar_lyric_title),
                getString(R.string.settings_status_bar_lyric_summary),
            )
            root.setOnClickListener {
                StatusBarLyricSettingsActivity.start(this@SettingsActivity)
            }
        }

        binding.writeCover.apply {
            bindSwitchRow(
                root,
                R.drawable.settings_ic_cover,
                "写入封面",
                getString(R.string.settings_write_cover_summary),
            )
            val sw = root.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.switchView)
            sw.isChecked = SettingsPrefs.isWriteCoverEnabled(this@SettingsActivity)
            root.setOnClickListener { sw.toggle() }
            sw.setOnCheckedChangeListener { _, isChecked ->
                SettingsPrefs.setWriteCoverEnabled(this@SettingsActivity, isChecked)
            }
        }

        binding.writeTags.apply {
            bindSwitchRow(
                root,
                R.drawable.settings_ic_tag,
                "写入标签",
                getString(R.string.settings_write_tags_summary),
            )
            val sw = root.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.switchView)
            sw.isChecked = SettingsPrefs.isWriteTagsEnabled(this@SettingsActivity)
            root.setOnClickListener { sw.toggle() }
            sw.setOnCheckedChangeListener { _, isChecked ->
                SettingsPrefs.setWriteTagsEnabled(this@SettingsActivity, isChecked)
            }
        }

        binding.writeLyrics.apply {
            bindSwitchRow(
                root,
                R.drawable.settings_ic_lyric,
                "写入歌词",
                getString(R.string.settings_write_lyrics_summary),
            )
            val sw = root.findViewById<com.google.android.material.switchmaterial.SwitchMaterial>(R.id.switchView)
            sw.isChecked = SettingsPrefs.isWriteLyricsEnabled(this@SettingsActivity)
            root.setOnClickListener { sw.toggle() }
            sw.setOnCheckedChangeListener { _, isChecked ->
                SettingsPrefs.setWriteLyricsEnabled(this@SettingsActivity, isChecked)
            }
        }

        binding.themeMode.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_theme,
                "外观主题",
                themeModeSummary(SettingsPrefs.getThemeMode(this@SettingsActivity)),
            )
            root.setOnClickListener {
                uiScope.launch {
                    val current = SettingsPrefs.getThemeMode(this@SettingsActivity)
                    val picked = showSettingsOptionPicker(
                        context = this@SettingsActivity,
                        title = "外观主题",
                        options = listOf(
                            SettingsOption("dark", "深色"),
                            SettingsOption("light", "浅色"),
                            SettingsOption("system", "跟随系统"),
                        ),
                        selectedIndex = when (current) {
                            SettingsPrefs.ThemeMode.Dark -> 0
                            SettingsPrefs.ThemeMode.Light -> 1
                            SettingsPrefs.ThemeMode.System -> 2
                        },
                    )
                    val mode = when (picked?.id) {
                        "dark" -> SettingsPrefs.ThemeMode.Dark
                        "light" -> SettingsPrefs.ThemeMode.Light
                        "system" -> SettingsPrefs.ThemeMode.System
                        else -> return@launch
                    }
                    SettingsPrefs.setThemeMode(this@SettingsActivity, mode)
                    root.findViewById<TextView>(R.id.valueTextView).text = themeModeSummary(mode)
                    AppCompatDelegate.setDefaultNightMode(SettingsPrefs.toNightMode(mode))
                    recreate()
                }
            }
        }

        binding.dataManagement.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_data,
                getString(R.string.settings_data_management),
                null,
            )
            root.setOnClickListener {
                DataManagementActivity.start(this@SettingsActivity)
            }
        }

        binding.syncManagement.apply {
            bindNavRow(
                root,
                R.drawable.ic_data_sync,
                "收藏与歌单同步",
                syncSummary(syncManager.state()),
            )
            root.setOnClickListener {
                if (syncManager.state().bound) syncNow() else LoginActivity.start(this@SettingsActivity)
            }
        }

        binding.cacheManagement.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_cache,
                getString(R.string.settings_cache_management),
                null,
            )
            root.setOnClickListener {
//                startActivity(Intent(this@SettingsActivity, CacheManagementActivity::class.java))
                CacheManagementActivity.start(this@SettingsActivity)
            }
        }

        if (BuildConfig.DEBUG) {
            binding.devDebugEntry.apply {
                bindNavRow(
                    root,
                    R.drawable.settings_ic_developer,
                    getString(R.string.settings_dev_debug_title),
                    getString(R.string.settings_dev_debug_summary),
                )
                root.setOnClickListener {
                    startActivity(Intent(this@SettingsActivity, DevDebugActivity::class.java))
                    AppActivityTransitions.applyForward(this@SettingsActivity)
                }
            }
        } else {
            binding.devDebugDivider.visibility = View.GONE
            binding.devDebugEntry.root.visibility = View.GONE
        }

        binding.feedbackEntry.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_feedback,
                getString(R.string.feedback_title),
                null,
            )
            root.setOnClickListener {
                FeedbackWebActivity.start(this@SettingsActivity)
            }
        }

        binding.announcementEntry.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_announcement,
                getString(R.string.settings_announcements),
                null,
            )
            root.setOnClickListener {
                startActivity(Intent(this@SettingsActivity, SettingAnnouncementsActivity::class.java))
                AppActivityTransitions.applyForward(this@SettingsActivity)
            }
        }

        binding.checkUpdateEntry.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_update,
                getString(R.string.check_update),
                null,
            )
            root.setOnClickListener {
                startActivity(Intent(this@SettingsActivity, SettingCheckUpdateActivity::class.java))
                AppActivityTransitions.applyForward(this@SettingsActivity)
            }
        }

        binding.aboutEntry.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_about,
                getString(R.string.about),
                null,
            )
            root.setOnClickListener {
                startActivity(Intent(this@SettingsActivity, SettingAboutActivity::class.java))
                AppActivityTransitions.applyForward(this@SettingsActivity)
            }
        }

        bindDeviceIdLabel()
    }

    override fun onResume() {
        super.onResume()
        binding.lyricColorPresets.root.findViewById<TextView>(R.id.valueTextView).text = lyricColorPresetSummary()
        refreshSyncRow()
        bindDeviceIdLabel()
    }

    private fun refreshSyncRow() {
        if (!::binding.isInitialized) return
        binding.syncManagement.root.findViewById<TextView>(R.id.valueTextView).apply {
            val summary = syncSummary(syncManager.state())
            visibility = if (summary.isBlank()) View.GONE else View.VISIBLE
            text = summary
        }
    }

    private fun syncNow() {
        uiScope.launch {
            Toast.makeText(this@SettingsActivity, "正在同步", Toast.LENGTH_SHORT).show()
            val state = syncManager.syncNow()
            refreshSyncRow()
            Toast.makeText(
                this@SettingsActivity,
                if (state.lastError.isBlank()) "同步完成" else state.lastError,
                Toast.LENGTH_SHORT,
            ).show()
        }
    }

    private fun syncSummary(state: SyncPrefs.State): String {
        if (!state.bound) return "未开启"
        val time = if (state.lastSyncAt > 0L) {
            SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(state.lastSyncAt))
        } else {
            "未同步"
        }
        return if (state.lastError.isBlank()) {
            "已开启 · $time"
        } else {
            "异常 · ${state.lastError}"
        }
    }

    private fun bindDeviceIdLabel() {
        val deviceId = ServerDevicePrefs.getDeviceId(this).trim()
        val display = deviceId.ifEmpty { "未获取" }
        binding.deviceIdLabelTextView.apply {
            text = "设备ID：$display"
            setOnClickListener {
                if (deviceId.isEmpty()) {
                    Toast.makeText(this@SettingsActivity, "设备ID暂未生成，请稍后重试", Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("设备ID", deviceId))
                Toast.makeText(this@SettingsActivity, "设备ID已复制", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun fileNamingRuleSummary(rule: SettingsPrefs.FileNamingRule): String = when (rule) {
        SettingsPrefs.FileNamingRule.TitleDashArtist -> "歌名 - 歌手"
        SettingsPrefs.FileNamingRule.ArtistDashTitle -> "歌手 - 歌名（默认）"
    }

    private fun themeModeSummary(mode: SettingsPrefs.ThemeMode): String = when (mode) {
        SettingsPrefs.ThemeMode.Dark -> "深色"
        SettingsPrefs.ThemeMode.Light -> "浅色"
        SettingsPrefs.ThemeMode.System -> "跟随系统（默认）"
    }

    private fun lyricColorPresetSummary(): String {
        val normalCount = LyricDisplayPrefs.getNormalColorRgbPresets(this).size
        val currentCount = LyricDisplayPrefs.getCurrentColorArgbPresets(this).size
        return getString(R.string.settings_lyric_color_presets_summary, normalCount, currentCount)
    }

    private fun checkStoragePermission() {
        val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(
                Manifest.permission.READ_MEDIA_AUDIO,
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO
            )
        } else {
            arrayOf(
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            )
        }

        when {
            permissions.all { permission ->
                ContextCompat.checkSelfPermission(this, permission) == 
                    PackageManager.PERMISSION_GRANTED
            } -> {
                showDirectoryPicker()
            }
            permissions.any { permission ->
                ActivityCompat.shouldShowRequestPermissionRationale(this, permission)
            } -> {
                showPermissionRationaleDialog(permissions)
            }
            else -> {
                requestPermissionLauncher.launch(permissions)
            }
        }
    }

    private fun showDirectoryPicker() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
            // 可选：添加初始位置
            putExtra("android.provider.extra.INITIAL_URI", 
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).toUri())
        }
        startActivityForResult(intent, PICK_DIRECTORY_REQUEST_CODE)
    }

    private fun showPermissionRationaleDialog(permissions: Array<String>) {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.storage_permission_required)
            .setMessage(R.string.storage_permission_rationale)
            .setPositiveButton("授予权限") { _, _ ->
                requestPermissionLauncher.launch(permissions)
            }
            .setNegativeButton("取消", null)
            .show()
    }

    private fun showPermissionDeniedMessage() {
        Snackbar.make(
            binding.root,
            R.string.storage_permission_denied,
            Snackbar.LENGTH_LONG
        ).setAction("设置") {
            openAppSettings()
        }.show()
    }

    private fun openAppSettings() {
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", packageName, null)
            startActivity(this)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == PICK_DIRECTORY_REQUEST_CODE && resultCode == RESULT_OK) {
            data?.data?.let { uri ->
                // 将 Uri 转换为实际路径
                val path = getPathFromUri(uri)
                // 保存新的下载路径
                DownloadPathManager.setDownloadPath(this, path)
                // 创建目录
                DownloadPathManager.createDownloadDirectory(path)
                // 更新显示
                binding.downloadLocation.root.findViewById<TextView>(R.id.valueTextView).apply {
                    visibility = View.VISIBLE
                    text = DownloadPathManager.getDisplayPath(this@SettingsActivity)
                }
            }
        }
    }

    private fun getPathFromUri(uri: Uri): String {
        // 从 Uri 获取实际文件路径
        val docFile = DocumentFile.fromTreeUri(this, uri)
        return if (docFile?.exists() == true) {
            // 如果是外部存储路径，尝试获取实际路径
            val path = uri.path?.replace("/tree/primary:", "/storage/emulated/0/")
            path ?: DownloadPathManager.getDefaultPath()
        } else {
            DownloadPathManager.getDefaultPath()
        }
    }

    companion object {
        private const val PICK_DIRECTORY_REQUEST_CODE = 1
        fun start(context: Context) {
            val intent = Intent(context, SettingsActivity::class.java)
            context.startActivity(intent)
            // 设置启动动画
            AppActivityTransitions.applyForward(context)
        }
    }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }
} 
