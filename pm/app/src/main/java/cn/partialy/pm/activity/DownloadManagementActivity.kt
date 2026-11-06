package cn.partialy.pm.activity

import cn.partialy.pm.ui.message.PmMessage

import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.Gravity
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupWindow
import java.io.File
import android.view.inputmethod.InputMethodManager
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityDownloadManagementBinding
import cn.partialy.pm.download.task.DownloadTask
import cn.partialy.pm.download.task.DownloadTaskRepository
import cn.partialy.pm.download.task.DownloadTaskStatus
import cn.partialy.pm.download.task.DownloadQueueCoordinator
import cn.partialy.pm.download.AudioMetadataRepairer
import cn.partialy.pm.download.AudioMetadataVerifier
import cn.partialy.pm.ui.message.MessageType
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.dialog.PmSlotDialog
import cn.partialy.pm.ui.download.DownloadTaskAdapter
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import com.google.android.material.checkbox.MaterialCheckBox
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class DownloadManagementActivity : BaseActivity() {

    @Inject
    lateinit var downloadTaskRepository: DownloadTaskRepository

    @Inject
    lateinit var downloadQueueCoordinator: DownloadQueueCoordinator

    @Inject
    lateinit var audioMetadataRepairer: AudioMetadataRepairer

    private var editMenuPopup: PopupWindow? = null
    private lateinit var binding: ActivityDownloadManagementBinding
    private lateinit var taskAdapter: DownloadTaskAdapter
    private var tasks: List<DownloadTask> = emptyList()
    private var selectedTab = TAB_DOWNLOADING

    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityDownloadManagementBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)

        val isNight =
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(
            lightStatusBarIcons = !isNight,
            lightNavigationBarIcons = !isNight,
        )
        applyInsets()
        setupList()
        setupActions()
        updateTabStyle()
        observeTasks()
    }

    private fun applyInsets() {
        binding.downloadManagementRoot.applySystemBarsInsets { insets ->
            binding.downloadManagementStatusBarSpacer.layoutParams =
                binding.downloadManagementStatusBarSpacer.layoutParams.apply {
                    height = insets.top
                }
            binding.actionSurface.setPadding(0, 10.dp, 0, insets.bottom)
        }
    }

    private fun setupList() {
        taskAdapter = DownloadTaskAdapter(::onSelectionChanged, ::onTaskClick)
        binding.taskRecyclerView.apply {
            layoutManager = LinearLayoutManager(this@DownloadManagementActivity)
            adapter = taskAdapter
            itemAnimator = null
        }
    }

    private fun setupActions() = with(binding) {
        backButton.setOnClickListener {
            if (taskAdapter.selectionMode) setEditing(false) else finish()
        }
        downloadingTab.setOnClickListener { selectTab(TAB_DOWNLOADING) }
        completedTab.setOnClickListener { selectTab(TAB_COMPLETED) }
        moreButton.setOnClickListener { showEditMenu() }
        doneButton.setOnClickListener { setEditing(false) }
        repairAction.setOnClickListener {
            if (taskAdapter.selection.isNotEmpty()) repairTasks(taskAdapter.selection)
        }
        selectAllAction.setOnClickListener { taskAdapter.selectAll() }
        invertAction.setOnClickListener { taskAdapter.invertSelection() }
        deleteAction.setOnClickListener {
            if (taskAdapter.selection.isNotEmpty()) showDeleteConfirmation()
        }
        clearSearchButton.setOnClickListener {
            searchInput.text?.clear()
            searchInput.clearFocus()
            hideKeyboard()
        }
        searchInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                clearSearchButton.isVisible = !s.isNullOrEmpty()
                renderTasks()
            }

            override fun afterTextChanged(s: Editable?) = Unit
        })
    }

    private fun showEditMenu() {
        editMenuPopup?.dismiss()
        val content = layoutInflater.inflate(R.layout.layout_search_source_dropdown, null, false)
        val container = content.findViewById<LinearLayout>(R.id.searchSourceOptionsContainer)
        val row = layoutInflater.inflate(R.layout.item_compact_action_menu_row, container, false)
        val color = com.google.android.material.color.MaterialColors.getColor(
            container, com.google.android.material.R.attr.colorOnSurface,
            ContextCompat.getColor(this, R.color.colorOnBgNormal),
        )
        row.findViewById<ImageView>(R.id.actionMenuItemIcon).apply {
            setImageResource(R.drawable.ic_edit_24)
            setColorFilter(color)
        }
        row.findViewById<TextView>(R.id.actionMenuItemText).apply {
            setText(R.string.download_management_edit)
            setTextColor(color)
        }
        row.setOnClickListener {
            editMenuPopup?.dismiss()
            setEditing(true)
        }
        container.addView(row)
        editMenuPopup = PopupWindow(content, 120.dp,
            android.view.ViewGroup.LayoutParams.WRAP_CONTENT, true).apply {
            isOutsideTouchable = true
            elevation = 8.dp.toFloat()
        }
        editMenuPopup?.showAsDropDown(binding.moreButton, 0, 6.dp, Gravity.END)
    }

    private fun repairTasks(ids: Set<String>) {
        if (ids.isEmpty()) return
        setEditing(false)
        lifecycleScope.launch {
            try {
                val result = audioMetadataRepairer.repairSelected(ids)
                val message = getString(R.string.download_management_repair_summary,
                    result.success, result.skipped, result.failed)
                PmMessage.show(
                    this@DownloadManagementActivity,
                    if (result.failed > 0) MessageType.WARNING else MessageType.SUCCESS,
                    message, 2500L, null,
                )
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (error: Exception) {
                PmMessage.error(this@DownloadManagementActivity, R.string.download_management_delete_failed)
            }
        }
    }

    private fun onTaskClick(task: DownloadTask) {
        if (task.status == DownloadTaskStatus.COMPLETED) return
        if (task.status.isActive) {
            PmMinimalDialog.Builder(this)
                .setTitle(getString(R.string.download_queue_cancel_title))
                .setMessage(getString(R.string.download_queue_cancel_message))
                .setCancelButton()
                .setConfirmButton(getString(R.string.download_queue_cancel_action)) {
                    downloadTaskRepository.cancelTask(task.id)
                }.show()
        } else if (task.status == DownloadTaskStatus.FAILED &&
            task.targetPath?.let(::File)?.let(AudioMetadataVerifier::isReadable) == true) {
            PmMinimalDialog.Builder(this)
                .setTitle(getString(R.string.download_management_repair_action))
                .setMessage(getString(R.string.download_management_repair_action))
                .setCancelButton()
                .setConfirmButton(getString(R.string.download_management_repair_action)) {
                    repairTasks(setOf(task.id))
                }.show()
        } else {
            PmMinimalDialog.Builder(this)
                .setTitle(getString(R.string.download_queue_retry_action))
                .setMessage(getString(R.string.download_queue_retry_message, task.title, task.errorMessage.orEmpty()))
                .setCancelButton()
                .setConfirmButton(getString(R.string.download_queue_retry_action)) {
                    lifecycleScope.launch {
                        val result = downloadQueueCoordinator.retry(task)
                        PmMessage.show(this@DownloadManagementActivity, if (result.failedKeys.isNotEmpty()) cn.partialy.pm.ui.message.MessageType.WARNING else cn.partialy.pm.ui.message.MessageType.SUCCESS, getString(R.string.download_queue_summary, result.enqueuedKeys.size, result.skippedKeys.size, result.failedKeys.size), 2000L, null)
                    }
                }.show()
        }
    }

    private fun observeTasks() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                downloadTaskRepository.tasks.collect { latestTasks ->
                    tasks = latestTasks
                    renderTasks()
                }
            }
        }
    }

    private fun selectTab(tab: Int) {
        if (selectedTab == tab) return
        selectedTab = tab
        setEditing(false)
        updateTabStyle()
        renderTasks()
    }

    private fun updateTabStyle() = with(binding) {
        val downloadingSelected = selectedTab == TAB_DOWNLOADING
        downloadingTab.alpha = if (downloadingSelected) 1f else 0.5f
        completedTab.alpha = if (downloadingSelected) 0.5f else 1f
        downloadingTab.setTextColor(getColor(if (downloadingSelected) R.color.primary else R.color.text_secondary))
        completedTab.setTextColor(getColor(if (downloadingSelected) R.color.text_secondary else R.color.primary))
    }

    private fun renderTasks() {
        val query = binding.searchInput.text?.toString().orEmpty().trim()
        val filtered = tasks.asSequence()
            .filter { task ->
                if (selectedTab == TAB_COMPLETED) {
                    task.status == DownloadTaskStatus.COMPLETED
                } else {
                    task.status != DownloadTaskStatus.COMPLETED
                }
            }
            .filter { task ->
                query.isBlank() ||
                    task.title.contains(query, ignoreCase = true) ||
                    task.artist.contains(query, ignoreCase = true) ||
                    task.fileName?.contains(query, ignoreCase = true) == true
            }
            .sortedByDescending { task ->
                if (selectedTab == TAB_COMPLETED) task.completedAt ?: task.updatedAt else task.updatedAt
            }
            .toList()

        taskAdapter.submitTasks(filtered)
        binding.taskRecyclerView.isVisible = filtered.isNotEmpty()
        binding.emptyView.isVisible = filtered.isEmpty()
        binding.emptyView.setText(
            if (selectedTab == TAB_COMPLETED) {
                R.string.download_management_empty_completed
            } else {
                R.string.download_management_empty_downloading
            },
        )
    }

    private fun setEditing(editing: Boolean) = with(binding) {
        taskAdapter.selectionMode = editing
        actionSurface.isVisible = editing
        headerTabs.isVisible = !editing
        selectedCountTextView.isVisible = editing
        moreButton.isVisible = !editing
        doneButton.isVisible = editing
        repairAction.isVisible = editing && selectedTab == TAB_COMPLETED
        backButton.setImageResource(if (editing) R.drawable.ic_close_24dp else R.drawable.ic_back_24)
        selectedCountTextView.text = getString(R.string.download_management_selected_count, 0)
    }

    private fun onSelectionChanged(selection: Set<String>) = with(binding) {
        selectedCountTextView.text = getString(R.string.download_management_selected_count, selection.size)
        val hasSelection = selection.isNotEmpty()
        deleteAction.isEnabled = hasSelection
        deleteAction.alpha = if (hasSelection) 1f else 0.45f
        repairAction.isEnabled = hasSelection
        repairAction.alpha = if (hasSelection) 1f else 0.45f
    }

    private fun showDeleteConfirmation() {
        val selectedIds = taskAdapter.selection
        if (selectedIds.isEmpty()) return
        val dialogView = layoutInflater.inflate(R.layout.dialog_local_music_delete_confirm, null, false)
        val deleteFilesCheckBox =
            dialogView.findViewById<MaterialCheckBox>(R.id.deleteOriginalFileCheckBox)
        deleteFilesCheckBox.setText(R.string.download_management_delete_files)
        dialogView.findViewById<TextView>(R.id.deleteConfirmMessage).text =
            getString(R.string.download_management_confirm_delete, selectedIds.size)

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
                deleteTasks(selectedIds, deleteFilesCheckBox.isChecked)
            }
            .show()
    }

    private fun deleteTasks(ids: Set<String>, deleteFiles: Boolean) {
        lifecycleScope.launch {
            runCatching {
                downloadTaskRepository.removeTasks(ids, deleteFiles)
            }.onSuccess { result ->
                if (result.failedPaths.isEmpty()) setEditing(false)
                if (result.failedPaths.isEmpty()) {
                    PmMessage.success(this@DownloadManagementActivity, R.string.download_management_delete_done)
                } else {
                    PmMessage.warning(this@DownloadManagementActivity, R.string.download_management_delete_partial_failed)
                }
            }.onFailure {
                PmMessage.error(
                    this@DownloadManagementActivity,
                    R.string.download_management_delete_failed)
            }
        }
    }

    private fun hideKeyboard() {
        currentFocus?.let { view ->
            (getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager)
                ?.hideSoftInputFromWindow(view.windowToken, 0)
        }
    }

    override fun onDestroy() {
        editMenuPopup?.dismiss()
        super.onDestroy()
    }

    override fun finish() {
        super.finish()
        AppActivityTransitions.applyBack(this)
    }

    private val Int.dp: Int
        get() = (this * resources.displayMetrics.density).toInt()

    companion object {
        private const val TAB_DOWNLOADING = 0
        private const val TAB_COMPLETED = 1

        fun start(context: Context) {
            context.startActivity(Intent(context, DownloadManagementActivity::class.java))
            AppActivityTransitions.applyForward(context)
        }
    }
}
