package cn.partialy.pm.activity

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityLocalMusicScanBinding
import cn.partialy.pm.databinding.DialogLocalMusicScanFilterBinding
import cn.partialy.pm.ui.dialog.PmSlotDialog
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.local.adapters.LocalMusicScanResultAdapter
import cn.partialy.pm.utils.LocalSongProvider
import cn.partialy.pm.utils.LocalSongScanCandidate
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@AndroidEntryPoint
class LocalMusicScanActivity : BaseActivity() {

    @Inject
    lateinit var localSongProvider: LocalSongProvider

    private lateinit var binding: ActivityLocalMusicScanBinding
    private lateinit var resultAdapter: LocalMusicScanResultAdapter
    private val selectedKeys = mutableSetOf<String>()
    private var allCandidates: List<LocalSongScanCandidate> = emptyList()
    private var filterShortSongs: Boolean = true

    private val audioPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            scanMediaStore()
        } else {
            Toast.makeText(this, R.string.local_music_scan_permission_denied, Toast.LENGTH_SHORT).show()
        }
    }

    private val customScanLauncher = registerForActivityResult(
        ActivityResultContracts.OpenDocumentTree(),
    ) { uri ->
        uri ?: return@registerForActivityResult
        takeTreeReadPermission(uri)
        scanDocumentTree(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLocalMusicScanBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        filterShortSongs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .getBoolean(PREF_FILTER_SHORT, true)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.localMusicScanRoot.applySystemBarsInsets { insets ->
            binding.localMusicScanStatusBarSpacer.layoutParams =
                binding.localMusicScanStatusBarSpacer.layoutParams.apply {
                    height = insets.top
                }
            binding.scanImportBar.setPadding(
                binding.scanImportBar.paddingLeft,
                binding.scanImportBar.paddingTop,
                binding.scanImportBar.paddingRight,
                resources.getDimensionPixelSize(R.dimen.home_mini_player_bottom_margin) + insets.bottom,
            )
        }

        resultAdapter = LocalMusicScanResultAdapter(selectedKeys) {
            updateResultSummary()
        }
        binding.scanResultRecyclerView.layoutManager = LinearLayoutManager(this)
        binding.scanResultRecyclerView.adapter = resultAdapter

        binding.scanCloseButton.setOnClickListener { finish() }
        binding.startScanButton.setOnClickListener { startDefaultScan() }
        binding.customScanButton.setOnClickListener { customScanLauncher.launch(null) }
        binding.scanFilterButton.setOnClickListener { showFilterDialog() }
        binding.scanImportButton.setOnClickListener { importSelectedSongs() }

        showInitialState()
    }

    private fun startDefaultScan() {
        val permission = audioReadPermission()
        if (ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED) {
            scanMediaStore()
        } else {
            audioPermissionLauncher.launch(permission)
        }
    }

    private fun scanMediaStore() {
        showLoadingState()
        lifecycleScope.launch(Dispatchers.IO) {
            val result = runCatching {
                localSongProvider.scanMediaStoreSongs(filterShortSongs)
            }
            withContext(Dispatchers.Main) {
                result.fold(
                    onSuccess = ::showResultState,
                    onFailure = { showScanFailed() },
                )
            }
        }
    }

    private fun scanDocumentTree(treeUri: Uri) {
        showLoadingState()
        lifecycleScope.launch(Dispatchers.IO) {
            val result = runCatching {
                localSongProvider.scanDocumentTreeSongs(treeUri, filterShortSongs)
            }
            withContext(Dispatchers.Main) {
                result.fold(
                    onSuccess = ::showResultState,
                    onFailure = { showScanFailed() },
                )
            }
        }
    }

    private fun showInitialState() {
        binding.scanInitialContent.isVisible = true
        binding.scanLoadingContent.isVisible = false
        binding.scanResultContent.isVisible = false
        binding.scanImportBar.isVisible = false
    }

    private fun showLoadingState() {
        binding.scanInitialContent.isVisible = false
        binding.scanLoadingContent.isVisible = true
        binding.scanResultContent.isVisible = false
        binding.scanImportBar.isVisible = false
    }

    private fun showResultState(candidates: List<LocalSongScanCandidate>) {
        allCandidates = candidates
        binding.scanInitialContent.isVisible = false
        binding.scanLoadingContent.isVisible = false
        binding.scanResultContent.isVisible = true
        binding.scanImportBar.isVisible = true
        resultAdapter.submitList(candidates)

        val empty = candidates.isEmpty()
        binding.scanResultRecyclerView.isVisible = !empty
        binding.scanEmptyView.isVisible = empty
        updateResultSummary()
    }

    private fun showScanFailed() {
        Toast.makeText(this, R.string.local_music_scan_failed, Toast.LENGTH_SHORT).show()
        showInitialState()
    }

    private fun updateResultSummary() {
        val selectedCount = resultAdapter.selectedCandidates().size
        binding.scanResultSummaryText.text = getString(
            R.string.local_music_scan_summary,
            allCandidates.size,
            selectedCount,
        )
        binding.scanImportButton.text = if (selectedCount > 0) {
            getString(R.string.local_music_scan_import_count, selectedCount)
        } else {
            getString(R.string.local_music_scan_import)
        }
        binding.scanImportButton.isEnabled = selectedCount > 0
        binding.scanImportButton.alpha = if (selectedCount > 0) 1f else 0.45f
    }

    private fun importSelectedSongs() {
        val selected = resultAdapter.selectedCandidates()
        if (selected.isEmpty()) return
        binding.scanImportButton.isEnabled = false
        binding.scanImportButton.text = getString(R.string.local_music_scan_importing)
        lifecycleScope.launch(Dispatchers.IO) {
            val result = localSongProvider.importScannedSongs(selected)
            withContext(Dispatchers.Main) {
                Toast.makeText(
                    this@LocalMusicScanActivity,
                    getString(R.string.local_music_import_done, result.importedCount, result.skippedCount),
                    Toast.LENGTH_SHORT,
                ).show()
                setResult(RESULT_OK)
                finish()
            }
        }
    }

    private fun showFilterDialog() {
        val dialogBinding = DialogLocalMusicScanFilterBinding.inflate(layoutInflater)
        dialogBinding.filterShortSwitch.isChecked = filterShortSongs
        dialogBinding.scanFilterRow.setOnClickListener {
            dialogBinding.filterShortSwitch.isChecked = !dialogBinding.filterShortSwitch.isChecked
        }
        PmSlotDialog.Builder(this)
            .setHeaderLayout(R.layout.dialog_pm_title_header) { view, _ ->
                view.findViewById<TextView>(R.id.dialogTitleText)
                    .setText(R.string.local_music_scan_filter_settings)
            }
            .setContentView(dialogBinding.root)
            .setCancelButton(getString(R.string.cancel))
            .setConfirmButton(getString(R.string.dialog_ok)) {
                filterShortSongs = dialogBinding.filterShortSwitch.isChecked
                getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                    .edit()
                    .putBoolean(PREF_FILTER_SHORT, filterShortSongs)
                    .apply()
            }
            .show()
    }

    private fun takeTreeReadPermission(uri: Uri) {
        runCatching {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    private fun audioReadPermission(): String =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Manifest.permission.READ_MEDIA_AUDIO
        } else {
            Manifest.permission.READ_EXTERNAL_STORAGE
        }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }

    companion object {
        private const val PREFS_NAME = "local_music_scan"
        private const val PREF_FILTER_SHORT = "filter_short_songs"

        fun start(context: Context) {
            context.startActivity(Intent(context, LocalMusicScanActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
