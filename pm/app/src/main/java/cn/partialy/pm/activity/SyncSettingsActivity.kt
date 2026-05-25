package cn.partialy.pm.activity

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivitySyncSettingsBinding
import cn.partialy.pm.sync.SyncManager
import cn.partialy.pm.sync.SyncPrefs
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.inject.Inject

@AndroidEntryPoint
class SyncSettingsActivity : BaseActivity() {
    private lateinit var binding: ActivitySyncSettingsBinding
    private var busy = false

    @Inject
    lateinit var syncManager: SyncManager

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivitySyncSettingsBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setupSystemBars()
        setupToolbar()
        setupActions()
        refreshState()
    }

    private fun setupSystemBars() {
        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.syncSettingsRoot.applySystemBarsInsets { insets ->
            val lp = binding.statusBarSpacer.layoutParams
            lp.height = insets.top
            binding.statusBarSpacer.layoutParams = lp
            binding.scrollView.setPadding(0, 0, 0, insets.bottom)
        }
    }

    private fun setupToolbar() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowTitleEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }
    }

    private fun setupActions() {
        binding.btnCreateSyncCode.setOnClickListener {
            val state = syncManager.state()
            if (state.bound) {
                confirmResetSyncCode()
            } else {
                createOrResetSyncCode()
            }
        }
        binding.btnCopySyncCode.setOnClickListener {
            val code = syncManager.state().syncCode
            if (code.isBlank()) {
                Toast.makeText(this, "暂无同步码", Toast.LENGTH_SHORT).show()
            } else {
                copyText("同步码", code)
                Toast.makeText(this, "同步码已复制", Toast.LENGTH_SHORT).show()
            }
        }
        binding.btnJoinSync.setOnClickListener {
            val code = binding.joinCodeInput.text?.toString()?.trim().orEmpty()
            if (code.isBlank()) {
                Toast.makeText(this, "同步码不能为空", Toast.LENGTH_SHORT).show()
            } else {
                joinSyncSpace(code)
            }
        }
        binding.btnSyncNow.setOnClickListener { syncNow() }
        binding.btnUnbind.setOnClickListener { confirmUnbind() }
    }

    private fun confirmResetSyncCode() {
        MaterialAlertDialogBuilder(this)
            .setTitle("重新生成同步码")
            .setMessage("重新生成会清空旧同步空间的数据，并让旧同步码和旧 token 失效。每个同步空间 4 小时内只能重新生成一次。")
            .setNegativeButton("取消", null)
            .setPositiveButton("重新生成") { _, _ -> createOrResetSyncCode() }
            .show()
    }

    private fun createOrResetSyncCode() {
        runBusy("正在生成同步码") {
            val state = syncManager.createSyncSpace()
            refreshState(state)
            copyText("同步码", state.syncCode)
            "同步码已生成并复制"
        }
    }

    private fun joinSyncSpace(code: String) {
        runBusy("正在加入同步空间") {
            val state = syncManager.joinSyncSpace(code)
            binding.joinCodeInput.setText("")
            refreshState(state)
            if (state.lastError.isBlank()) "同步完成" else state.lastError
        }
    }

    private fun syncNow() {
        runBusy("正在同步") {
            val state = syncManager.syncNow()
            refreshState(state)
            if (state.lastError.isBlank()) "同步完成" else state.lastError
        }
    }

    private fun confirmUnbind() {
        MaterialAlertDialogBuilder(this)
            .setTitle("解绑当前设备")
            .setMessage("解绑后本机不再自动同步，已同步到其他设备的数据不会被删除。")
            .setNegativeButton("取消", null)
            .setPositiveButton("解绑") { _, _ -> unbind() }
            .show()
    }

    private fun unbind() {
        runBusy("正在解绑") {
            val state = syncManager.unbind()
            refreshState(state)
            "已解绑同步设备"
        }
    }

    private fun runBusy(startMessage: String, block: suspend () -> String) {
        if (busy) return
        lifecycleScope.launch {
            setBusy(true)
            Toast.makeText(this@SyncSettingsActivity, startMessage, Toast.LENGTH_SHORT).show()
            runCatching { block() }
                .onSuccess { Toast.makeText(this@SyncSettingsActivity, it, Toast.LENGTH_SHORT).show() }
                .onFailure {
                    refreshState()
                    Toast.makeText(
                        this@SyncSettingsActivity,
                        it.message ?: "操作失败",
                        Toast.LENGTH_SHORT,
                    ).show()
                }
            setBusy(false)
        }
    }

    private fun setBusy(value: Boolean) {
        busy = value
        val state = syncManager.state()
        binding.btnCreateSyncCode.isEnabled = !value
        binding.btnJoinSync.isEnabled = !value
        binding.joinCodeInput.isEnabled = !value
        binding.btnCopySyncCode.isEnabled = !value && state.bound
        binding.btnSyncNow.isEnabled = !value && state.bound
        binding.btnUnbind.isEnabled = !value && state.bound
    }

    private fun refreshState(state: SyncPrefs.State = syncManager.state()) {
        val bound = state.bound
        binding.statusText.text = when {
            !bound -> "未开启"
            state.lastError.isNotBlank() -> "同步异常"
            else -> "已开启"
        }
        binding.lastSyncText.text = "上次同步：${formatLastSync(state.lastSyncAt)}"
        binding.errorText.visibility = if (state.lastError.isBlank()) View.GONE else View.VISIBLE
        binding.errorText.text = if (state.lastError.isBlank()) "" else "错误：${state.lastError}"
        binding.syncCodeText.text = state.syncCode.ifBlank { "未创建" }
        binding.deviceText.text = state.deviceId.ifBlank { "未绑定" }
        binding.btnCreateSyncCode.text = if (bound) "重新生成同步码" else "创建同步码"
        binding.btnCopySyncCode.isEnabled = !busy && bound
        binding.btnSyncNow.isEnabled = !busy && bound
        binding.btnUnbind.isEnabled = !busy && bound
    }

    private fun formatLastSync(timestamp: Long): String {
        if (timestamp <= 0L) return "尚未同步"
        return SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(timestamp))
    }

    private fun copyText(label: String, value: String) {
        if (value.isBlank()) return
        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText(label, value))
    }

    companion object {
        fun start(context: Context) {
            context.startActivity(Intent(context, SyncSettingsActivity::class.java))
            (context as? Activity)?.overridePendingTransition(R.anim.slide_up, R.anim.dim_and_scale_out)
        }
    }
}
