package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityFaultReportBinding
import cn.partialy.pm.fault.FaultReportRepository
import cn.partialy.pm.fault.PlaybackFaultStats
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import dagger.hilt.android.AndroidEntryPoint
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.launch

@AndroidEntryPoint
class FaultReportActivity : BaseActivity() {
    @Inject lateinit var repository: FaultReportRepository

    private lateinit var binding: ActivityFaultReportBinding
    private var submitting = false

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityFaultReportBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)
        setupSystemBars()
        setupToolbar()
        binding.reportNowButton.setOnClickListener { confirmReport() }
        loadStats()
    }

    override fun onResume() {
        super.onResume()
        if (::binding.isInitialized && !submitting) loadStats()
    }

    private fun setupSystemBars() {
        val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = !isNight, lightNavigationBarIcons = !isNight)
        binding.faultReportRoot.applySystemBarsInsets { insets ->
            binding.statusBarSpacer.layoutParams = binding.statusBarSpacer.layoutParams.apply { height = insets.top }
            binding.scrollView.setPadding(0, 0, 0, insets.bottom)
        }
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun loadStats() {
        lifecycleScope.launch {
            runCatching { repository.loadStats() }
                .onSuccess(::renderStats)
                .onFailure { showMessage(getString(R.string.fault_report_load_failed)) }
        }
    }

    private fun renderStats(stats: PlaybackFaultStats) {
        binding.totalCountText.text = getString(R.string.fault_report_total_count, stats.totalCount)
        binding.recentCountText.text = getString(R.string.fault_report_recent_count, stats.recentSevenDaysCount)
        binding.pendingCountText.text = getString(R.string.fault_report_pending_count, stats.pendingCount)
        binding.latestErrorText.text = getString(R.string.fault_report_latest_error, formatTime(stats.latestOccurredAt))
        binding.sceneText.text = getString(R.string.fault_report_scene, getString(R.string.fault_report_scene_play_url))
        binding.lastReportText.text = getString(R.string.fault_report_last_time, formatTime(stats.lastReportedAt))
        binding.reportNowButton.isEnabled = stats.pendingCount > 0 && !submitting
        binding.reportHintText.text = if (stats.pendingCount > 0) {
            getString(R.string.fault_report_privacy_hint)
        } else {
            getString(R.string.fault_report_empty)
        }
    }

    private fun confirmReport() {
        if (!binding.reportNowButton.isEnabled || submitting) return
        PmMinimalDialog.show(
            context = this,
            title = getString(R.string.fault_report_confirm_title),
            message = getString(R.string.fault_report_confirm_message),
            cancelText = getString(R.string.cancel),
            confirmText = getString(R.string.dialog_ok),
            onConfirm = { submitReport() },
        )
    }

    private fun submitReport() {
        if (submitting) return
        submitting = true
        binding.reportNowButton.isEnabled = false
        binding.reportNowButton.text = getString(R.string.fault_report_uploading)
        lifecycleScope.launch {
            runCatching { repository.submitPending() }
                .onSuccess { showMessage(getString(R.string.fault_report_success)) }
                .onFailure { showMessage(it.message ?: getString(R.string.fault_report_failed)) }
            submitting = false
            binding.reportNowButton.text = getString(R.string.fault_report_now)
            loadStats()
        }
    }

    private fun formatTime(value: Long?): String {
        if (value == null || value <= 0L) return getString(R.string.fault_report_never)
        return SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(value))
    }

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, FaultReportActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
