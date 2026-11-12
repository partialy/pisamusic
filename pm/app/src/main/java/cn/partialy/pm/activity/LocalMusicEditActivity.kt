package cn.partialy.pm.activity

import cn.partialy.pm.ui.message.PmMessage

import android.app.RecoverableSecurityException
import android.content.IntentSender
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.DocumentsContract
import android.provider.MediaStore
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.widget.TextView
import androidx.activity.result.IntentSenderRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityLocalMusicEditBinding
import cn.partialy.pm.ui.dialog.PmSlotDialog
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.local.adapters.LocalMusicEditAdapter
import cn.partialy.pm.utils.LocalMusicMediaRow
import cn.partialy.pm.utils.LocalMusicMediaStore
import cn.partialy.pm.utils.LocalSongStore
import com.google.android.material.checkbox.MaterialCheckBox
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import javax.inject.Inject

@AndroidEntryPoint
class LocalMusicEditActivity : BaseActivity() {

    @Inject
    lateinit var localSongStore: LocalSongStore

    private lateinit var binding: ActivityLocalMusicEditBinding
    private val selectedIds = mutableSetOf<String>()
    private lateinit var adapter: LocalMusicEditAdapter
    private var allRows: List<LocalMusicMediaRow> = emptyList()
    private var filteredRows: List<LocalMusicMediaRow> = emptyList()
    private var hasLoadedRows = false
    private var pendingInitialSongId: String? = null
    private var pendingScrollRecordId: String? = null
    private var pendingScrollOffset = 0
    private var pendingDeleteHadFailure = false
    private var rowsLoadJob: Job? = null

    private val deleteLauncher = registerForActivityResult(
        ActivityResultContracts.StartIntentSenderForResult(),
    ) { result ->
        val messageRes = if (result.resultCode == RESULT_OK && !pendingDeleteHadFailure) {
            R.string.local_music_delete_file_done
        } else if (result.resultCode == RESULT_OK) {
            R.string.local_music_delete_file_failed
        } else {
            R.string.local_music_delete_cancelled
        }
        when (messageRes) {
            R.string.local_music_delete_file_done -> PmMessage.success(this, messageRes)
            R.string.local_music_delete_file_failed -> PmMessage.error(this, messageRes)
            else -> PmMessage.info(this, messageRes)
        }
        pendingDeleteHadFailure = false
        loadRows()
        setResult(RESULT_OK)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityLocalMusicEditBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        binding.localMusicEditRoot.applySystemBarsInsets { insets ->
            binding.localMusicEditStatusBarSpacer.layoutParams = binding.localMusicEditStatusBarSpacer.layoutParams.apply {
                height = insets.top
            }
            binding.deleteBarContainer.setPadding(0, 0, 0, insets.bottom)
        }

        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        binding.toolbar.setNavigationOnClickListener { finish() }

        selectedIds.addAll(savedInstanceState?.getStringArrayList(SAVED_SELECTION).orEmpty())
        pendingInitialSongId = if (savedInstanceState == null) intent.getStringExtra(EXTRA_INITIAL_SONG_ID)
            else savedInstanceState.getString(SAVED_INITIAL_SONG)
        pendingScrollRecordId = savedInstanceState?.getString(SAVED_SCROLL_RECORD)
        pendingScrollOffset = savedInstanceState?.getInt(SAVED_SCROLL_OFFSET) ?: 0
        binding.localEditSearchInput.setText(savedInstanceState?.getString(SAVED_QUERY).orEmpty())
        binding.btnDeleteSelected.setOnClickListener {
            if (selectedIds.isNotEmpty()) confirmDelete()
        }
        binding.selectAllAction.setOnClickListener {
            selectedIds.addAll(filteredRows.map { it.recordId })
            adapter.refreshSelection()
        }
        binding.invertAction.setOnClickListener {
            filteredRows.forEach { row ->
                if (!selectedIds.remove(row.recordId)) selectedIds.add(row.recordId)
            }
            adapter.refreshSelection()
        }

        adapter = LocalMusicEditAdapter(selectedIds) { refreshDeleteButton() }
        binding.recyclerView.layoutManager = LinearLayoutManager(this)
        binding.recyclerView.adapter = adapter
        setupSearchFilter()

        refreshDeleteButton()
        loadRows()
    }

    private fun refreshDeleteButton() {
        val has = selectedIds.isNotEmpty()
        binding.btnDeleteSelected.isEnabled = has
        binding.btnDeleteSelected.alpha = if (has) 1f else 0.45f
        binding.toolbar.subtitle = getString(R.string.download_management_selected_count, selectedIds.size)
        listOf(binding.selectAllAction, binding.invertAction).forEach { action ->
            action.isEnabled = filteredRows.isNotEmpty()
            action.alpha = if (action.isEnabled) 1f else 0.45f
        }
    }

    private fun setupSearchFilter() {
        binding.localEditSearchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                applySearchFilter()
            }

            override fun afterTextChanged(s: Editable?) = Unit
        })
        binding.localEditSearchCancelText.setOnClickListener {
            binding.localEditSearchInput.text?.clear()
            binding.localEditSearchInput.clearFocus()
            hideSoftKeyboard()
        }
    }

    private fun loadRows() {
        rowsLoadJob?.cancel()
        rowsLoadJob = lifecycleScope.launch(Dispatchers.IO) {
            val rows = localSongStore.queryRows()
            withContext(Dispatchers.Main) {
                allRows = rows
                hasLoadedRows = true
                selectedIds.retainAll(rows.mapTo(hashSetOf()) { it.recordId })
                // 播放 ID 可能是 content URI 或文件路径，不能直接作为索引主键。
                pendingInitialSongId?.let { initialId ->
                    rows.firstOrNull { row ->
                        LocalSongStore.resolvePlaybackId(row.contentUri, row.filePath, row.recordId) == initialId
                    }?.let { row ->
                        selectedIds.add(row.recordId)
                        pendingScrollRecordId = row.recordId
                        pendingScrollOffset = 0
                    }
                    pendingInitialSongId = null
                }
                applySearchFilter()
            }
        }
    }

    private fun applySearchFilter() {
        val keyword = binding.localEditSearchInput.text?.toString().orEmpty().trim()
        filteredRows = if (keyword.isBlank()) {
            allRows
        } else {
            allRows.filter { row ->
                row.title.contains(keyword, ignoreCase = true) ||
                    row.artist.contains(keyword, ignoreCase = true) ||
                    row.displayName.contains(keyword, ignoreCase = true)
            }
        }
        adapter.submitList(filteredRows)
        pendingScrollRecordId?.takeIf { hasLoadedRows }?.let { recordId ->
            val index = filteredRows.indexOfFirst { it.recordId == recordId }
            if (index >= 0) {
                (binding.recyclerView.layoutManager as? LinearLayoutManager)
                    ?.scrollToPositionWithOffset(index, pendingScrollOffset)
            }
            pendingScrollRecordId = null
        }
        val empty = filteredRows.isEmpty()
        binding.emptyView.visibility = if (empty) View.VISIBLE else View.GONE
        binding.recyclerView.visibility = if (empty) View.GONE else View.VISIBLE
        refreshDeleteButton()
    }

    private fun confirmDelete() {
        val n = selectedIds.size
        if (n == 0) return
        val dialogView = layoutInflater.inflate(R.layout.dialog_local_music_delete_confirm, null, false)
        val deleteFileCheckBox = dialogView.findViewById<MaterialCheckBox>(R.id.deleteOriginalFileCheckBox)
        dialogView.findViewById<TextView>(R.id.deleteConfirmMessage).text =
            getString(R.string.confirm_delete_local, n)
        PmSlotDialog.Builder(this)
            .setHeaderLayout(R.layout.dialog_pm_title_header) { view, _ ->
                view.findViewById<TextView>(R.id.dialogTitleText).setText(R.string.cache_confirm_title)
            }
            .setContentView(dialogView)
            .setCancelButton(getString(R.string.cancel))
            .setConfirmButton(
                text = getString(R.string.dialog_ok),
                textColor = ContextCompat.getColor(this, R.color.red),
            ) {
                deleteSelected(deleteOriginalFiles = deleteFileCheckBox.isChecked)
            }
            .show()
    }

    private fun deleteSelected(deleteOriginalFiles: Boolean) {
        val ids = selectedIds.toSet()
        if (ids.isEmpty()) return
        val rows = allRows.filter { it.recordId in ids }
        localSongStore.markDeleted(ids)
        selectedIds.clear()
        setResult(RESULT_OK)

        if (!deleteOriginalFiles) {
            PmMessage.success(this, R.string.local_music_delete_reference_done)
            loadRows()
            return
        }

        val mediaUris = rows.mapNotNull { row ->
            row.mediaId?.let(LocalMusicMediaStore::contentUri)
        }
        lifecycleScope.launch(Dispatchers.IO) {
            val result = deleteOriginalRows(rows, deleteMediaImmediately = Build.VERSION.SDK_INT < Build.VERSION_CODES.R)
            withContext(Dispatchers.Main) {
                pendingDeleteHadFailure = result.failedCount > 0
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && mediaUris.isNotEmpty()) {
                    requestDeleteMediaRows(mediaUris)
                    return@withContext
                }
                result.pendingSender?.let { sender ->
                    deleteLauncher.launch(IntentSenderRequest.Builder(sender).build())
                    return@withContext
                }
                if (result.failedCount == 0) {
                    PmMessage.success(this@LocalMusicEditActivity, R.string.local_music_delete_file_done)
                } else {
                    PmMessage.error(this@LocalMusicEditActivity, R.string.local_music_delete_file_failed)
                }
                loadRows()
            }
        }
    }

    private fun requestDeleteMediaRows(mediaUris: List<Uri>) {
        try {
            val pi = MediaStore.createDeleteRequest(contentResolver, mediaUris)
            deleteLauncher.launch(IntentSenderRequest.Builder(pi.intentSender).build())
        } catch (_: Exception) {
            pendingDeleteHadFailure = true
            PmMessage.error(this, R.string.local_music_delete_file_failed)
            loadRows()
        }
    }

    private fun deleteOriginalRows(
        rows: List<LocalMusicMediaRow>,
        deleteMediaImmediately: Boolean,
    ): OriginalDeleteResult {
        var failedCount = 0
        var pendingSender: IntentSender? = null
        rows.forEach { row ->
            if (row.mediaId != null) {
                if (deleteMediaImmediately) {
                    val uri = LocalMusicMediaStore.contentUri(row.mediaId)
                    val result = deleteByContentResolver(uri)
                    if (result.pendingSender != null) pendingSender = result.pendingSender
                    if (!result.success) failedCount++
                }
                return@forEach
            }
            if (row.contentUri.isBlank()) return@forEach
            if (!deleteDocumentUri(Uri.parse(row.contentUri))) {
                failedCount++
            }
        }
        return OriginalDeleteResult(failedCount, pendingSender)
    }

    private fun deleteByContentResolver(uri: Uri): SingleDeleteResult {
        return try {
            SingleDeleteResult(success = contentResolver.delete(uri, null, null) > 0)
        } catch (e: RecoverableSecurityException) {
            SingleDeleteResult(success = false, pendingSender = e.userAction.actionIntent.intentSender)
        } catch (_: Exception) {
            SingleDeleteResult(success = false)
        }
    }

    private fun deleteDocumentUri(uri: Uri): Boolean =
        try {
            DocumentsContract.deleteDocument(contentResolver, uri)
        } catch (_: Exception) {
            false
        }

    private fun hideSoftKeyboard() {
        currentFocus?.let { view ->
            (getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager)
                ?.hideSoftInputFromWindow(view.windowToken, 0)
        }
    }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        outState.putStringArrayList(SAVED_SELECTION, ArrayList(selectedIds))
        outState.putString(SAVED_QUERY, binding.localEditSearchInput.text?.toString().orEmpty())
        outState.putString(SAVED_INITIAL_SONG, pendingInitialSongId)
        val layoutManager = binding.recyclerView.layoutManager as? LinearLayoutManager
        val firstPosition = layoutManager?.findFirstVisibleItemPosition() ?: -1
        val firstRow = adapter.currentRows().getOrNull(firstPosition)
        outState.putString(SAVED_SCROLL_RECORD, firstRow?.recordId ?: pendingScrollRecordId)
        outState.putInt(SAVED_SCROLL_OFFSET, if (firstRow != null) {
            layoutManager?.findViewByPosition(firstPosition)?.top ?: 0
        } else pendingScrollOffset)
        super.onSaveInstanceState(outState)
    }

    companion object {
        const val EXTRA_INITIAL_SONG_ID = "initial_local_song_id"
        private const val SAVED_SELECTION = "selected_local_record_ids"
        private const val SAVED_QUERY = "local_edit_query"
        private const val SAVED_INITIAL_SONG = "initial_local_song_id_pending"
        private const val SAVED_SCROLL_RECORD = "local_edit_scroll_record"
        private const val SAVED_SCROLL_OFFSET = "local_edit_scroll_offset"
    }

    private data class OriginalDeleteResult(
        val failedCount: Int,
        val pendingSender: IntentSender?,
    )

    private data class SingleDeleteResult(
        val success: Boolean,
        val pendingSender: IntentSender? = null,
    )
}
