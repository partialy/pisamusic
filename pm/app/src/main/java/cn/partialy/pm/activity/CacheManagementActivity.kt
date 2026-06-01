package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.View
import android.widget.LinearLayout
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityCacheManagementBinding
import cn.partialy.pm.databinding.IncludeCacheCategoryCardBinding
import cn.partialy.pm.ui.dialog.SettingsOption
import cn.partialy.pm.ui.dialog.showSettingsOptionPicker
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.AppStorageInspector
import cn.partialy.pm.utils.AppStorageInspector.AppCacheBreakdown
import cn.partialy.pm.utils.DownloadPathManager
import cn.partialy.pm.utils.SettingsPrefs
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@AndroidEntryPoint
class CacheManagementActivity : BaseActivity() {

    private lateinit var binding: ActivityCacheManagementBinding
    private lateinit var songCard: IncludeCacheCategoryCardBinding
    private lateinit var lyricCard: IncludeCacheCategoryCardBinding
    private lateinit var downloadedCard: IncludeCacheCategoryCardBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityCacheManagementBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.cacheManagementRoot.applySystemBarsInsets { insets ->
            val lp = binding.cacheStatusBarSpacer.layoutParams
            lp.height = insets.top
            binding.cacheStatusBarSpacer.layoutParams = lp
            binding.cacheScrollView.setPadding(0, 0, 0, insets.bottom)
        }

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }

        songCard = binding.cardSongCache
        lyricCard = binding.cardLyricCache
        downloadedCard = binding.cardDownloaded

        songCard.btnManage.visibility = View.VISIBLE
        lyricCard.btnManage.visibility = View.GONE
        downloadedCard.btnManage.visibility = View.VISIBLE
        songCard.btnManage.text = getString(R.string.cache_action_set_limit)

        songCard.categoryTitle.text = getString(R.string.cache_category_song)
        songCard.categoryDescText.text = getString(R.string.cache_desc_song)
        lyricCard.categoryTitle.text = getString(R.string.cache_category_lyric)
        lyricCard.categoryDescText.text = getString(R.string.cache_desc_lyric)
        downloadedCard.categoryTitle.text = getString(R.string.cache_category_downloaded)
        downloadedCard.categoryDescText.text = getString(R.string.cache_desc_downloaded)

        songCard.btnClean.setOnClickListener { confirmCleanSongCache() }
        songCard.btnManage.setOnClickListener { showSongCacheLimitDialog() }
        lyricCard.btnClean.setOnClickListener { confirmCleanLyricCache() }
//        downloadedCard.btnClean.setOnClickListener { confirmCleanDownloaded() }
        downloadedCard.btnClean.visibility = View.GONE
        downloadedCard.btnManage.setOnClickListener {
            LocalMusicActivity.start(this, LocalMusicActivity.TAB_DOWNLOADED)
        }
    }

    override fun onResume() {
        super.onResume()
        loadStats()
    }

    private fun loadStats() {
        lifecycleScope.launch {
            val data = withContext(Dispatchers.IO) {
                AppStorageInspector.compute(this@CacheManagementActivity)
            }
            applyBreakdown(data)
        }
    }

    private fun applyBreakdown(b: AppCacheBreakdown) {
        binding.usageTotalText.text = AppStorageInspector.formatSize(b.appUsageBytes)
        val total = b.phone.totalBytes
        binding.phoneTotalStorageText.text = getString(
            R.string.cache_phone_total_capacity,
            AppStorageInspector.formatSize(total),
        )

        val appSharePct = percentOf(b.appUsageBytes, total)
        binding.usagePercentText.text = getString(R.string.cache_percent_line, appSharePct)

        val app = b.appUsageBytes.toFloat()
        val otherUsed = (b.phone.usedBytes - b.appUsageBytes).coerceAtLeast(0L).toFloat()
        val free = b.phone.availableBytes.toFloat()
        val sum = app + otherUsed + free
        if (sum <= 0f) {
            setBarWeight(binding.usageBarApp, 1f)
            setBarWeight(binding.usageBarPhoneUsed, 1f)
            setBarWeight(binding.usageBarFree, 1f)
        } else {
            fun w(v: Float, nonZero: Boolean) =
                (v / sum * 1000f).coerceAtLeast(if (nonZero) 1.5f else 0f)
            setBarWeight(binding.usageBarApp, w(app, app > 0f))
            setBarWeight(binding.usageBarPhoneUsed, w(otherUsed, otherUsed > 0f))
            setBarWeight(binding.usageBarFree, w(free, free > 0f))
        }
        binding.usageBar.requestLayout()

        val otherUsedBytes = (b.phone.usedBytes - b.appUsageBytes).coerceAtLeast(0L)
        binding.legendAppText.text = getString(R.string.cache_legend_app, appSharePct)
        binding.legendPhoneUsedText.text =
            getString(R.string.cache_legend_phone_used, percentOf(otherUsedBytes, total))
        binding.legendFreeText.text =
            getString(R.string.cache_legend_free, percentOf(b.phone.availableBytes, total))

        songCard.categorySizeText.text = AppStorageInspector.formatSize(b.songCacheBytes)
        songCard.categoryExtraText.visibility = View.VISIBLE
        val currentLimitMb = SettingsPrefs.getAudioCacheMaxMb(this)
        songCard.categoryExtraText.text = if (SettingsPrefs.getAudioCacheMode(this) == SettingsPrefs.AudioCacheMode.Auto) {
            "当前上限：自动（当前 ${currentLimitMb} MB）"
        } else {
            getString(R.string.cache_limit_current, currentLimitMb)
        }
        lyricCard.categorySizeText.text = AppStorageInspector.formatSize(b.lyricCacheBytes)
        downloadedCard.categorySizeText.text = AppStorageInspector.formatSize(b.downloadedBytes)
        if (b.downloadedAudioCount > 0) {
            downloadedCard.categoryExtraText.visibility = View.VISIBLE
            downloadedCard.categoryExtraText.text =
                getString(R.string.cache_downloaded_count, b.downloadedAudioCount)
        } else {
            downloadedCard.categoryExtraText.visibility = View.GONE
        }
    }

    /** 占手机总存储的百分比，保留两位小数（0.00～100.00）。 */
    private fun percentOf(part: Long, totalBytes: Long): Double {
        if (totalBytes <= 0L) return 0.0
        val raw = part.toDouble() * 100.0 / totalBytes.toDouble()
        return raw.coerceIn(0.0, 100.0)
    }

    private fun setBarWeight(view: View, weight: Float) {
        val lp = view.layoutParams as LinearLayout.LayoutParams
        lp.weight = weight
        view.layoutParams = lp
    }

    private fun confirmCleanSongCache() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.cache_confirm_title)
            .setMessage(R.string.cache_confirm_song)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.dialog_ok) { _, _ ->
                lifecycleScope.launch {
                    withContext(Dispatchers.IO) {
                        AppStorageInspector.clearSongCache(this@CacheManagementActivity)
                    }
                    loadStats()
                }
            }
            .show()
    }

    private fun confirmCleanLyricCache() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.cache_confirm_title)
            .setMessage(R.string.cache_confirm_lyric)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.dialog_ok) { _, _ ->
                lifecycleScope.launch {
                    withContext(Dispatchers.IO) {
                        AppStorageInspector.clearLyricCache(this@CacheManagementActivity)
                    }
                    loadStats()
                }
            }
            .show()
    }

    private fun confirmCleanDownloaded() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.cache_confirm_title)
            .setMessage(R.string.cache_confirm_downloaded)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.dialog_ok) { _, _ ->
                lifecycleScope.launch {
                    withContext(Dispatchers.IO) {
                        val root = File(DownloadPathManager.getDownloadPath(this@CacheManagementActivity))
                        AppStorageInspector.clearDownloadedMusic(root)
                    }
                    loadStats()
                }
            }
            .show()
    }

    private fun showSongCacheLimitDialog() {
        lifecycleScope.launch {
            val options = listOf(
                SettingsOption("mb_500", "500 MB"),
                SettingsOption("mb_1024", "1 GB"),
                SettingsOption("mb_2048", "2 GB"),
                SettingsOption("mb_4096", "4 GB"),
                SettingsOption("mb_8192", "8 GB"),
                SettingsOption("mb_16384", "16 GB"),
                SettingsOption("custom", "自定义（MB）"),
                SettingsOption("auto", "自动（剩余空间的10%）"),
            )
            val manualPresetIdsByMb = mapOf(
                500L to "mb_500",
                1024L to "mb_1024",
                2048L to "mb_2048",
                4096L to "mb_4096",
                8192L to "mb_8192",
                16384L to "mb_16384",
            )
            val currentMode = SettingsPrefs.getAudioCacheMode(this@CacheManagementActivity)
            val currentMb = SettingsPrefs.getAudioCacheMaxMb(this@CacheManagementActivity)
            val selectedId = if (currentMode == SettingsPrefs.AudioCacheMode.Auto) {
                "auto"
            } else {
                manualPresetIdsByMb[currentMb] ?: "custom"
            }
            val selectedIndex = options.indexOfFirst { it.id == selectedId }.coerceAtLeast(0)
            val picked = showSettingsOptionPicker(
                context = this@CacheManagementActivity,
                title = getString(R.string.cache_limit_dialog_title),
                options = options,
                selectedIndex = selectedIndex,
            ) ?: return@launch

            when (picked.id) {
                "auto" -> {
                    SettingsPrefs.setAudioCacheMode(this@CacheManagementActivity, SettingsPrefs.AudioCacheMode.Auto)
                    SettingsPrefs.setAudioCacheMaxMb(
                        this@CacheManagementActivity,
                        SettingsPrefs.computeAutoAudioCacheMb(),
                    )
                    loadStats()
                    showCacheLimitSavedDialog()
                }

                "custom" -> showCustomSongCacheLimitDialog()

                else -> {
                    val parsed = picked.id.removePrefix("mb_").toLongOrNull() ?: return@launch
                    SettingsPrefs.setAudioCacheMode(this@CacheManagementActivity, SettingsPrefs.AudioCacheMode.Manual)
                    SettingsPrefs.setAudioCacheMaxMb(this@CacheManagementActivity, parsed)
                    loadStats()
                    showCacheLimitSavedDialog()
                }
            }
        }
    }

    private fun showCustomSongCacheLimitDialog() {
        val horizontalPaddingPx = (20 * resources.displayMetrics.density).toInt()
        val inputLayout = TextInputLayout(this).apply {
            hint = getString(R.string.cache_limit_input_hint)
            setPadding(horizontalPaddingPx, 0, horizontalPaddingPx, 0)
        }
        val input = TextInputEditText(this).apply {
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
            setText(SettingsPrefs.getAudioCacheMaxMb(this@CacheManagementActivity).toString())
            setSelection(text?.length ?: 0)
        }
        inputLayout.addView(input)
        val min = SettingsPrefs.getAudioCacheMinMb()
        val max = SettingsPrefs.getAudioCacheMaxMbLimit()
        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.cache_limit_dialog_title)
            .setMessage(getString(R.string.cache_limit_dialog_message, min, max))
            .setView(inputLayout)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.dialog_ok) { _, _ ->
                val raw = input.text?.toString()?.trim().orEmpty()
                val parsed = raw.toLongOrNull()
                if (parsed == null || parsed !in min..max) {
                    MaterialAlertDialogBuilder(this)
                        .setTitle(R.string.cache_limit_invalid_title)
                        .setMessage(getString(R.string.cache_limit_invalid_message, min, max))
                        .setPositiveButton(R.string.dialog_ok, null)
                        .show()
                    return@setPositiveButton
                }
                SettingsPrefs.setAudioCacheMode(this, SettingsPrefs.AudioCacheMode.Manual)
                SettingsPrefs.setAudioCacheMaxMb(this, parsed)
                loadStats()
                showCacheLimitSavedDialog()
            }
            .create()
        dialog.show()
        applyHomeStyleDialogBackground(dialog)
    }

    private fun showCacheLimitSavedDialog() {
        val dialog = MaterialAlertDialogBuilder(this)
            .setTitle(R.string.cache_limit_saved_title)
            .setMessage(R.string.cache_limit_saved_message)
            .setPositiveButton(R.string.dialog_ok, null)
            .create()
        dialog.show()
        applyHomeStyleDialogBackground(dialog)
    }

    private fun applyHomeStyleDialogBackground(dialog: androidx.appcompat.app.AlertDialog) {
        val radiusPx = 12f * resources.displayMetrics.density
        dialog.window?.setBackgroundDrawable(
            GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = radiusPx
                setColor(ContextCompat.getColor(this@CacheManagementActivity, R.color.home_page_bg))
            },
        )
    }

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, CacheManagementActivity::class.java)
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }
}
