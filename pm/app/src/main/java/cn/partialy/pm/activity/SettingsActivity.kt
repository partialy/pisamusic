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
                getString(R.string.settings_download_title),
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
                getString(R.string.settings_lyrics_title),
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
                getString(R.string.settings_playback_title),
                null,
            )
            root.setOnClickListener {
                PlaybackSettingsActivity.start(this@SettingsActivity)
            }
        }

        binding.moreSettings.apply {
            bindNavRow(root, R.drawable.settings_ic_more_settings, getString(R.string.settings_more), null)
            root.setOnClickListener { showMessage(getString(R.string.common_not_available_yet)) }
        }

        binding.themeMode.apply {
            bindNavRow(
                root,
                R.drawable.settings_ic_theme,
                getString(R.string.settings_appearance_theme),
                themeModeSummary(SettingsPrefs.getThemeMode(this@SettingsActivity)),
            )
            root.setOnClickListener {
                uiScope.launch {
                    val current = SettingsPrefs.getThemeMode(this@SettingsActivity)
                    val picked = showSettingsOptionPicker(
                        context = this@SettingsActivity,
                        title = getString(R.string.settings_appearance_theme),
                        options = listOf(
                            SettingsOption("dark", getString(R.string.settings_theme_dark)),
                            SettingsOption("light", getString(R.string.settings_theme_light)),
                            SettingsOption("system", getString(R.string.settings_theme_system)),
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
        val display = deviceId.ifEmpty { getString(R.string.settings_device_id_missing) }
        binding.deviceIdLabelTextView.apply {
            text = getString(R.string.settings_device_id_value, display)
            setOnClickListener {
                if (deviceId.isEmpty()) {
                    Toast.makeText(this@SettingsActivity, R.string.settings_device_id_pending, Toast.LENGTH_SHORT).show()
                    return@setOnClickListener
                }
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText(getString(R.string.settings_device_id_clip_label), deviceId))
                Toast.makeText(this@SettingsActivity, R.string.settings_device_id_copied, Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun themeModeSummary(mode: SettingsPrefs.ThemeMode): String = when (mode) {
        SettingsPrefs.ThemeMode.Dark -> getString(R.string.settings_theme_dark)
        SettingsPrefs.ThemeMode.Light -> getString(R.string.settings_theme_light)
        SettingsPrefs.ThemeMode.System -> getString(R.string.settings_theme_system_default)
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
