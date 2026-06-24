package cn.partialy.pm.activity

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.annotation.DrawableRes
import androidx.appcompat.app.AppCompatDelegate
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.activity.setting.SettingAboutActivity
import cn.partialy.pm.activity.setting.SettingAnnouncementsActivity
import cn.partialy.pm.activity.setting.SettingCheckUpdateActivity
import cn.partialy.pm.databinding.ActivitySettingsBinding
import cn.partialy.pm.ui.dialog.SettingsOption
import cn.partialy.pm.ui.dialog.showSettingsOptionPicker
import cn.partialy.pm.utils.ServerDevicePrefs
import cn.partialy.pm.utils.SettingsPrefs
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.MainScope
import kotlinx.coroutines.launch

@AndroidEntryPoint
class SettingsActivity : BaseActivity() {
    private lateinit var binding: ActivitySettingsBinding
    private val uiScope = MainScope()

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

        bindSettingsItems()
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
        binding.downloadSettings.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_download_settings,
                "下载设置",
                null,
            )
            root.setOnClickListener {
                DownloadSettingsActivity.start(this@SettingsActivity)
            }
        }

        binding.lyricSettings.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_lyric_settings,
                "歌词设置",
                null,
            )
            root.setOnClickListener {
                LyricSettingsActivity.start(this@SettingsActivity)
            }
        }

        binding.playbackSettings.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_playback,
                "播放设置",
                null,
            )
            root.setOnClickListener {
                PlaybackSettingsActivity.start(this@SettingsActivity)
            }
        }

        binding.moreSettings.apply {
            bindNavRow(root, R.drawable.settings_ic_more_settings, "更多设置", null)
            root.setOnClickListener { showMessage("暂未开放") }
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
                DataSettingsActivity.start(this@SettingsActivity)
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

        binding.faultReportEntry.apply {
            bindNavRow(root, R.drawable.settings_ic_fault_report, getString(R.string.fault_report_title), null)
            root.setOnClickListener { FaultReportActivity.start(this@SettingsActivity) }
        }

        binding.feedbackEntry.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_feedback,
                getString(R.string.feedback_title),
                null,
            )
            root.setOnClickListener {
                FeedbackActivity.start(this@SettingsActivity)
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
        bindDeviceIdLabel()
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

    private fun themeModeSummary(mode: SettingsPrefs.ThemeMode): String = when (mode) {
        SettingsPrefs.ThemeMode.Dark -> "深色"
        SettingsPrefs.ThemeMode.Light -> "浅色"
        SettingsPrefs.ThemeMode.System -> "跟随系统（默认）"
    }

    companion object {
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
