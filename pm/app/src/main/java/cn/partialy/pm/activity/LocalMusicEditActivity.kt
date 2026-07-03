package cn.partialy.pm.activity

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
import android.widget.Toast
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
    private var pendingDeleteHadFailure = false

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
        pendingDeleteHadFailure = false
        Toast.makeText(this, messageRes, Toast.LENGTH_SHORT).show()
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

        binding.btnDeleteSelected.setOnClickListener {
            if (selectedIds.isNotEmpty()) confirmDelete()
        }
        setupSearchFilter()

        adapter = LocalMusicEditAdapter(selectedIds) { refreshDeleteButton() }
        binding.recyclerView.layoutManager = LinearLayoutManager(this)
        binding.recyclerView.adapter = adapter

        refreshDeleteButton()
        loadRows()
    }

    private fun refreshDeleteButton() {
        val has = selectedIds.isNotEmpty()
        binding.btnDeleteSelected.isEnabled = has
        binding.btnDeleteSelected.alpha = if (has) 1f else 0.45f
    }

    private fun setupSearchFilter() {
        binding.localEditSearchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                applySearchFilter(clearSelection = false)
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
        lifecycleScope.launch(Dispatchers.IO) {
            val rows = localSongStore.queryRows()
            withContext(Dispatchers.Main) {
                allRows = rows
                applySearchFilter(clearSelection = true)
            }
        }
    }

    private fun applySearchFilter(clearSelection: Boolean) {
        val keyword = binding.localEditSearchInput.text?.toString().orEmpty().trim()
        val filtered = if (keyword.isBlank()) {
            allRows
        } else {
            allRows.filter { row ->
                row.title.contains(keyword, ignoreCase = true) ||
                    row.artist.contains(keyword, ignoreCase = true) ||
                    row.displayName.contains(keyword, ignoreCase = true)
            }
        }
        adapter.submitList(filtered, clearSelection = clearSelection)
        val empty = filtered.isEmpty()
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
            Toast.makeText(this, R.string.local_music_delete_reference_done, Toast.LENGTH_SHORT).show()
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
                Toast.makeText(
                    this@LocalMusicEditActivity,
                    if (result.failedCount == 0) R.string.local_music_delete_file_done
                    else R.string.local_music_delete_file_failed,
                    Toast.LENGTH_SHORT,
                ).show()
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
            Toast.makeText(this, R.string.local_music_delete_file_failed, Toast.LENGTH_SHORT).show()
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

    private data class OriginalDeleteResult(
        val failedCount: Int,
        val pendingSender: IntentSender?,
    )

    private data class SingleDeleteResult(
        val success: Boolean,
        val pendingSender: IntentSender? = null,
    )
}
