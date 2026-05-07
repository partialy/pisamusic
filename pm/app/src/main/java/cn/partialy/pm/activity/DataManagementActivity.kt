package cn.partialy.pm.activity

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityDataManagementBinding
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
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
 * 数据管理：导入 / 导出收藏歌曲和歌单数据（ZIP 格式）。
 *
 * 压缩包结构：
 * - loveList.json          收藏歌曲
 * - collected_playlists.json   歌单索引
 * - songs_<playlistId>.json    本地歌单曲目（可能多个）
 */
@AndroidEntryPoint
class DataManagementActivity : BaseActivity() {

    @Inject lateinit var playlistCollectionManager: PlaylistCollectionManager

    private lateinit var binding: ActivityDataManagementBinding
    private val gson = Gson()

    /** 导出：让用户选择保存位置 */
    private val exportLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/zip")
    ) { uri -> if (uri != null) performExport(uri) }

    /** 导入：让用户选择 ZIP 文件 */
    private val importLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri -> if (uri != null) confirmAndImport(uri) }

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityDataManagementBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        setupSystemBars()
        setupToolbar()
        setupButtons()
        loadDataOverview()
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
        binding.btnExport.setOnClickListener { startExport() }
        binding.btnImport.setOnClickListener { startImport() }
        binding.btnDeleteAll.setOnClickListener { confirmDeleteAll() }
    }

    // ==================== 数据概览 ====================

    /** 统计数据文件占用空间并显示 */
    private fun loadDataOverview() {
        lifecycleScope.launch {
            val stats = withContext(Dispatchers.IO) { calculateDataStats() }
            binding.dataOverviewText.text = buildString {
                append("收藏歌曲：${stats.lovedCount} 首（${formatSize(stats.lovedSize)}）")
                append("\n歌单：${stats.playlistCount} 个（${formatSize(stats.playlistSize)}）")
                append("\n总占用：${formatSize(stats.totalSize)}")
            }
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

    private fun formatSize(bytes: Long): String = when {
        bytes < 1024 -> "${bytes} B"
        bytes < 1024 * 1024 -> String.format(Locale.US, "%.1f KB", bytes / 1024.0)
        else -> String.format(Locale.US, "%.2f MB", bytes / (1024.0 * 1024.0))
    }

    // ==================== 删除数据 ====================

    private fun confirmDeleteAll() {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.data_delete_confirm_title)
            .setMessage(R.string.data_delete_confirm_msg)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.dialog_ok) { _, _ -> performDeleteAll() }
            .show()
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

    // ==================== 导出 ====================

    private fun startExport() {
        val ts = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        exportLauncher.launch("pm_backup_$ts.zip")
    }

    private fun performExport(uri: Uri) {
        binding.btnExport.isEnabled = false
        binding.exportStatusText.visibility = View.VISIBLE
        binding.exportStatusText.text = "正在导出…"

        lifecycleScope.launch {
            try {
                val filesDir = this@DataManagementActivity.filesDir
                val filesToPack = withContext(Dispatchers.IO) { collectExportFiles(filesDir) }
                if (filesToPack.isEmpty()) {
                    binding.exportStatusText.text = getString(R.string.data_export_empty)
                    binding.btnExport.isEnabled = true
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
                binding.exportStatusText.text = getString(R.string.data_export_success, uri.lastPathSegment ?: "backup.zip")
            } catch (e: Exception) {
                e.printStackTrace()
                binding.exportStatusText.text = getString(R.string.data_export_fail)
            } finally {
                binding.btnExport.isEnabled = true
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

    // ==================== 导入 ====================

    private fun startImport() {
        importLauncher.launch(arrayOf("application/zip", "application/octet-stream"))
    }

    private fun confirmAndImport(uri: Uri) {
        MaterialAlertDialogBuilder(this)
            .setTitle(R.string.data_import_confirm_title)
            .setMessage(R.string.data_import_confirm_msg)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.dialog_ok) { _, _ -> performImport(uri) }
            .show()
    }

    private fun performImport(uri: Uri) {
        binding.btnImport.isEnabled = false
        binding.importStatusText.visibility = View.VISIBLE
        binding.importStatusText.text = "正在导入…"

        lifecycleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) { parseAndMerge(uri) }
                binding.importStatusText.text = getString(
                    R.string.data_import_success, result.lovedCount, result.playlistCount
                )
                loadDataOverview()
            } catch (e: Exception) {
                e.printStackTrace()
                binding.importStatusText.text = getString(R.string.data_import_fail)
            } finally {
                binding.btnImport.isEnabled = true
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

    // ==================== 导航 ====================

    companion object {
        fun start(context: Context) {
            val intent = Intent(context, DataManagementActivity::class.java)
            context.startActivity(intent)
            (context as? Activity)?.overridePendingTransition(
                R.anim.slide_to_left,
                R.anim.dim_and_scale_out,
            )
        }
    }

    override fun finish() {
        super.finish()
        overridePendingTransition(R.anim.playlist_previous_scale_from_95, R.anim.slide_to_right)
    }
}
