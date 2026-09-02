package cn.partialy.pm.activity

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityDataManagementBinding
import cn.partialy.pm.fault.FaultReportRepository
import cn.partialy.pm.fault.PlaybackFaultStats
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.player.diagnostic.PlaybackDiagnosticStore
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.dialog.SettingsOption
import cn.partialy.pm.ui.dialog.showSettingsOptionPicker
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.BufferedOutputStream
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream
import javax.inject.Inject

/**
 * 导入与导出：备份、恢复或清除收藏歌曲和歌单数据（ZIP 格式），以及导出播放诊断日志（JSON 格式）。
 */
@AndroidEntryPoint
class DataManagementActivity : BaseActivity() {

    @Inject lateinit var playlistCollectionManager: PlaylistCollectionManager
    @Inject lateinit var playbackDiagnosticStore: PlaybackDiagnosticStore
    @Inject lateinit var faultReportRepository: FaultReportRepository

    private lateinit var binding: ActivityDataManagementBinding
    private val gson = Gson()
    private var pendingDiagnosticsLimit: Int? = null
    private var submittingFaultReport = false

    /** 导出备份：让用户选择保存位置 */
    private val exportLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/zip")
    ) { uri -> if (uri != null) performExport(uri) }

    /** 导入恢复：让用户选择 ZIP 文件 */
    private val importLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri -> if (uri != null) confirmAndImport(uri) }

    /** 导出播放诊断日志：让用户选择保存位置 */
    private val exportDiagnosticsLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri -> if (uri != null) performExportDiagnostics(uri, pendingDiagnosticsLimit) }

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityDataManagementBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setupSystemBars()
        setupToolbar()
        setupButtons()
        loadDataOverview()
    }

    override fun onResume() {
        super.onResume()
        if (::binding.isInitialized && !submittingFaultReport) loadFaultReportStats()
    }

    // ==================== UI 初始化 ====================

    private fun setupSystemBars() {
        val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = !isNight, lightNavigationBarIcons = !isNight)
        binding.dataManagementRoot.applySystemBarsInsets { insets ->
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
        binding.btnDeleteAll.setOnClickListener { confirmDeleteAll() }
        binding.btnExportBackup.setOnClickListener { startExport() }
        binding.btnImportBackup.setOnClickListener { startImport() }
        binding.btnExportDiagnostics.setOnClickListener { startExportDiagnostics() }
        binding.reportNowButton.setOnClickListener { confirmFaultReport() }
    }

    // ==================== 数据概览 ====================

    /** 统计数据文件占用空间并显示在 3 个磁贴中 */
    private fun loadDataOverview() {
        lifecycleScope.launch {
            val stats = withContext(Dispatchers.IO) { calculateDataStats() }
            binding.overviewLovedCount.text = getString(R.string.data_count_songs_format, stats.lovedCount)
            binding.overviewLovedSize.text = formatSize(stats.lovedSize)
            binding.overviewPlaylistCount.text = getString(R.string.data_count_playlists_format, stats.playlistCount)
            binding.overviewPlaylistSize.text = formatSize(stats.playlistSize)
            binding.overviewTotalSize.text = formatSize(stats.totalSize)
        }
    }

    private data class DataStats(
        val lovedCount: Int,
        val lovedSize: Long,
        val playlistCount: Int,
        val playlistSize: Long,
        val totalSize: Long,
    )

    private fun calculateDataStats(): DataStats {
        val filesDir = this.filesDir
        loveManager.syncLegacyMirrorNow()
        playlistCollectionManager.syncLegacyMirrorNow()
        val loveFile = File(filesDir, "loveList.json")
        val lovedSize = if (loveFile.exists()) loveFile.length() else 0L
        val lovedCount = loveManager.getLoveList().size

        val playlists = playlistCollectionManager.getAllPlaylists()
        val indexFile = File(filesDir, "collected_playlists.json")
        var playlistSize = if (indexFile.exists()) indexFile.length() else 0L
        val playlistCount = playlists.size

        filesDir.listFiles()
            ?.filter { it.name.startsWith("songs_") && it.name.endsWith(".json") }
            ?.forEach { playlistSize += it.length() }
        getDatabasePath("pm_local_music.db").takeIf { it.exists() }?.let {
            playlistSize += it.length()
        }

        return DataStats(
            lovedCount = lovedCount,
            lovedSize = lovedSize,
            playlistCount = playlistCount,
            playlistSize = playlistSize,
            totalSize = lovedSize + playlistSize,
        )
    }

    // ==================== 故障上报 ====================

    private fun loadFaultReportStats() {
        lifecycleScope.launch {
            runCatching { faultReportRepository.loadStats() }
                .onSuccess(::renderFaultReportStats)
                .onFailure {
                    Toast.makeText(
                        this@DataManagementActivity,
                        R.string.fault_report_load_failed,
                        Toast.LENGTH_SHORT,
                    ).show()
                }
        }
    }

    private fun renderFaultReportStats(stats: PlaybackFaultStats) {
        binding.faultTotalCountText.text = stats.totalCount.toString()
        binding.faultRecentCountText.text = stats.recentSevenDaysCount.toString()
        binding.faultPendingCountText.text = stats.pendingCount.toString()
        binding.faultLatestErrorText.text = getString(
            R.string.fault_report_latest_error,
            formatFaultReportTime(stats.latestOccurredAt),
        )
        binding.faultLastReportText.text = getString(
            R.string.fault_report_last_time,
            formatFaultReportTime(stats.lastReportedAt),
        )
        binding.reportNowButton.isEnabled = stats.pendingCount > 0 && !submittingFaultReport
    }

    private fun confirmFaultReport() {
        if (!binding.reportNowButton.isEnabled || submittingFaultReport) return
        PmMinimalDialog.show(
            context = this,
            title = getString(R.string.fault_report_confirm_title),
            message = getString(R.string.fault_report_confirm_message),
            cancelText = getString(R.string.cancel),
            confirmText = getString(R.string.dialog_ok),
            onConfirm = { submitFaultReport() },
        )
    }

    private fun submitFaultReport() {
        if (submittingFaultReport) return
        submittingFaultReport = true
        binding.reportNowButton.isEnabled = false
        binding.reportNowButton.text = getString(R.string.fault_report_uploading)
        lifecycleScope.launch {
            runCatching { faultReportRepository.submitPending() }
                .onSuccess {
                    Toast.makeText(
                        this@DataManagementActivity,
                        R.string.fault_report_success,
                        Toast.LENGTH_SHORT,
                    ).show()
                }
                .onFailure { error ->
                    Toast.makeText(
                        this@DataManagementActivity,
                        error.message ?: getString(R.string.fault_report_failed),
                        Toast.LENGTH_SHORT,
                    ).show()
                }
            submittingFaultReport = false
            binding.reportNowButton.text = getString(R.string.fault_report_now)
            loadFaultReportStats()
        }
    }

    private fun formatFaultReportTime(value: Long?): String {
        if (value == null || value <= 0L) return getString(R.string.fault_report_never)
        return SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault()).format(Date(value))
    }

    private fun formatSize(bytes: Long): String = when {
        bytes < 1024 -> "${bytes} B"
        bytes < 1024 * 1024 -> String.format(Locale.US, "%.1f KB", bytes / 1024.0)
        else -> String.format(Locale.US, "%.2f MB", bytes / (1024.0 * 1024.0))
    }

    // ==================== 删除数据 ====================

    private fun confirmDeleteAll() {
        PmMinimalDialog.show(
            context = this,
            title = getString(R.string.data_delete_confirm_title),
            message = getString(R.string.data_delete_confirm_msg),
            cancelText = getString(R.string.cancel),
            confirmText = getString(R.string.dialog_ok),
            confirmColor = ContextCompat.getColor(this, R.color.red),
            onConfirm = { performDeleteAll() },
        )
    }

    private fun performDeleteAll() {
        lifecycleScope.launch {
            withContext(Dispatchers.IO) {
                val filesDir = this@DataManagementActivity.filesDir
                loveManager.clearLoveList()
                playlistCollectionManager.clearAll()
                File(filesDir, "loveList.json").delete()
            }
            loveManager.reload()
            loadDataOverview()
            Toast.makeText(this@DataManagementActivity, R.string.data_delete_success, Toast.LENGTH_SHORT).show()
        }
    }

    // ==================== 导出备份 (ZIP) ====================

    private fun startExport() {
        val ts = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        exportLauncher.launch("pm_backup_$ts.zip")
    }

    private fun performExport(uri: Uri) {
        binding.btnExportBackup.isEnabled = false

        lifecycleScope.launch {
            try {
                val filesDir = this@DataManagementActivity.filesDir
                val filesToPack = withContext(Dispatchers.IO) { collectExportFiles(filesDir) }
                if (filesToPack.isEmpty()) {
                    Toast.makeText(this@DataManagementActivity, R.string.data_export_empty, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                withContext(Dispatchers.IO) {
                    contentResolver.openOutputStream(uri)?.use { out ->
                        ZipOutputStream(BufferedOutputStream(out)).use { zip ->
                            for ((name, file) in filesToPack) {
                                zip.putNextEntry(ZipEntry(name))
                                file.inputStream().use { it.copyTo(zip) }
                                zip.closeEntry()
                            }
                        }
                    }
                }
                val successText = getString(
                    R.string.data_export_success,
                    uri.lastPathSegment ?: getString(R.string.common_default_backup_filename),
                )
                Toast.makeText(this@DataManagementActivity, successText, Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(this@DataManagementActivity, R.string.data_export_fail, Toast.LENGTH_SHORT).show()
            } finally {
                binding.btnExportBackup.isEnabled = true
            }
        }
    }

    /** 收集需要打包的文件：loveList + playlists 索引 + 本地歌单曲目 */
    private fun collectExportFiles(filesDir: File): List<Pair<String, File>> {
        loveManager.syncLegacyMirrorNow()
        playlistCollectionManager.syncLegacyMirrorNow()
        val result = mutableListOf<Pair<String, File>>()
        val loveFile = File(filesDir, "loveList.json")
        if (loveFile.exists() && loveFile.length() > 2) result.add("loveList.json" to loveFile)

        val playlistIndex = File(filesDir, "collected_playlists.json")
        if (playlistIndex.exists() && playlistIndex.length() > 2) {
            result.add("collected_playlists.json" to playlistIndex)
            filesDir.listFiles()?.filter { it.name.startsWith("songs_") && it.name.endsWith(".json") }
                ?.forEach { result.add(it.name to it) }
        }
        return result
    }

    // ==================== 导入恢复 (ZIP) ====================

    private fun startImport() {
        importLauncher.launch(arrayOf("application/zip", "application/octet-stream"))
    }

    private fun confirmAndImport(uri: Uri) {
        PmMinimalDialog.show(
            context = this,
            title = getString(R.string.data_import_confirm_title),
            message = getString(R.string.data_import_confirm_msg),
            cancelText = getString(R.string.cancel),
            confirmText = getString(R.string.dialog_ok),
            onConfirm = { performImport(uri) },
        )
    }

    private fun performImport(uri: Uri) {
        binding.btnImportBackup.isEnabled = false

        lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) { parseAndMerge(uri) }
                val successText = getString(
                    R.string.data_import_success, result.lovedCount, result.playlistCount
                )
                Toast.makeText(this@DataManagementActivity, successText, Toast.LENGTH_SHORT).show()
                loadDataOverview()
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(this@DataManagementActivity, R.string.data_import_fail, Toast.LENGTH_SHORT).show()
            } finally {
                binding.btnImportBackup.isEnabled = true
            }
        }
    }

    private data class ImportResult(val lovedCount: Int, val playlistCount: Int)

    /** 解压 ZIP 并合并数据到本地存储 */
    private fun parseAndMerge(uri: Uri): ImportResult {
        val filesDir = this.filesDir
        var lovedCount = 0
        var playlistCount = 0
        val songFiles = mutableMapOf<String, ByteArray>()

        contentResolver.openInputStream(uri)?.use { input ->
            ZipInputStream(input).use { zip ->
                var entry = zip.nextEntry
                while (entry != null) {
                    val bytes = zip.readBytes()
                    when {
                        entry.name == "loveList.json" -> {
                            lovedCount = mergeLoveList(bytes)
                        }
                        entry.name == "collected_playlists.json" -> {
                            playlistCount = mergePlaylistIndex(filesDir, bytes)
                        }
                        entry.name.startsWith("songs_") && entry.name.endsWith(".json") -> {
                            songFiles[entry.name] = bytes
                        }
                    }
                    zip.closeEntry()
                    entry = zip.nextEntry
                }
            }
        }

        for ((name, bytes) in songFiles) {
            mergeSongsFile(filesDir, name, bytes)
        }
        playlistCollectionManager.reload()

        return ImportResult(lovedCount, playlistCount)
    }

    /** 合并收藏歌曲：按 id 去重，追加新歌曲 */
    private fun mergeLoveList(importedBytes: ByteArray): Int {
        val type = object : TypeToken<List<SongInfo>>() {}.type
        val imported: List<SongInfo> = try {
            gson.fromJson(String(importedBytes), type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
        if (imported.isEmpty()) return 0

        return loveManager.mergeLegacySongs(imported)
    }

    /** 合并歌单索引：按 type+id 去重，追加新歌单 */
    private fun mergePlaylistIndex(filesDir: File, importedBytes: ByteArray): Int {
        val type = object : TypeToken<List<CollectedPlaylist>>() {}.type
        val imported: List<CollectedPlaylist> = try {
            gson.fromJson(String(importedBytes), type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
        if (imported.isEmpty()) return 0

        val file = File(filesDir, "collected_playlists.json")
        val existing: List<CollectedPlaylist> = try {
            if (file.exists()) gson.fromJson(file.readText(), type) ?: emptyList() else emptyList()
        } catch (_: Exception) { emptyList() }

        val existingKeys = existing.map { "${it.type}:${it.id}" }.toHashSet()
        val newPlaylists = imported.filter { "${it.type}:${it.id}" !in existingKeys }
        if (newPlaylists.isNotEmpty()) {
            file.writeText(gson.toJson(existing + newPlaylists))
        }
        playlistCollectionManager.reload()
        return newPlaylists.size
    }

    /** 合并本地歌单曲目文件：按 id 去重追加 */
    private fun mergeSongsFile(filesDir: File, fileName: String, importedBytes: ByteArray) {
        val type = object : TypeToken<List<SongInfo>>() {}.type
        val imported: List<SongInfo> = try {
            gson.fromJson(String(importedBytes), type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
        if (imported.isEmpty()) return

        val file = File(filesDir, fileName)
        val existing: List<SongInfo> = try {
            if (file.exists()) gson.fromJson(file.readText(), type) ?: emptyList() else emptyList()
        } catch (_: Exception) { emptyList() }

        val existingIds = existing.map { it.id }.toHashSet()
        val merged = existing + imported.filter { it.id !in existingIds }
        file.writeText(gson.toJson(merged))
    }

    // ==================== 导出播放诊断日志 (JSON) ====================

    private fun startExportDiagnostics() {
        lifecycleScope.launch {
            val totalEvents = withContext(Dispatchers.IO) { playbackDiagnosticStore.getEventsCount() }
            if (totalEvents <= 0) {
                Toast.makeText(this@DataManagementActivity, R.string.data_diagnostics_empty, Toast.LENGTH_SHORT).show()
                return@launch
            }

            val options = listOf(
                SettingsOption(
                    id = "10",
                    label = getString(R.string.data_diagnostics_limit_10_label),
                ),
                SettingsOption(
                    id = "50",
                    label = getString(R.string.data_diagnostics_limit_50_label),
                ),
                SettingsOption(
                    id = "100",
                    label = getString(R.string.data_diagnostics_limit_100_label),
                ),
                SettingsOption(
                    id = "all",
                    label = getString(R.string.data_diagnostics_limit_all_label),
                ),
            )

            val picked = showSettingsOptionPicker(
                context = this@DataManagementActivity,
                title = getString(R.string.data_diagnostics_picker_title),
                options = options,
                selectedIndex = 1,
            ) ?: return@launch

            val limit = if (picked.id == "all") null else picked.id.toIntOrNull()
            pendingDiagnosticsLimit = limit

            val ts = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val filename = "pm_playback_diagnostics_${ts}_recent${picked.id}.json"
            exportDiagnosticsLauncher.launch(filename)
        }
    }

    private fun performExportDiagnostics(uri: Uri, limit: Int?) {
        binding.btnExportDiagnostics.isEnabled = false

        lifecycleScope.launch {
            try {
                val rows = withContext(Dispatchers.IO) {
                    playbackDiagnosticStore.queryRecentEvents(limit)
                }
                if (rows.isEmpty()) {
                    Toast.makeText(this@DataManagementActivity, R.string.data_diagnostics_empty, Toast.LENGTH_SHORT).show()
                    return@launch
                }
                val jsonString = withContext(Dispatchers.IO) {
                    playbackDiagnosticStore.exportToJsonString(rows, limit)
                }
                withContext(Dispatchers.IO) {
                    contentResolver.openOutputStream(uri)?.use { out ->
                        out.write(jsonString.toByteArray(Charsets.UTF_8))
                    }
                }
                val filename = uri.lastPathSegment ?: "playback_diagnostics.json"
                val successText = getString(R.string.data_diagnostics_export_success, filename, rows.size)
                Toast.makeText(this@DataManagementActivity, successText, Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                e.printStackTrace()
                Toast.makeText(this@DataManagementActivity, R.string.data_diagnostics_export_fail, Toast.LENGTH_SHORT).show()
            } finally {
                binding.btnExportDiagnostics.isEnabled = true
            }
        }
    }

    // ==================== 导航 ====================

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, DataManagementActivity::class.java)
            context.startActivity(intent)
            AppActivityTransitions.applyForward(context)
        }
    }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }
}
