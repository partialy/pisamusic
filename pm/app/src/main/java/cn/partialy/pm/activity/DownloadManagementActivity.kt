package cn.partialy.pm.activity

import android.app.Dialog
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.InputMethodManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import androidx.activity.addCallback
import androidx.activity.viewModels
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.viewpager2.adapter.FragmentStateAdapter
import androidx.viewpager2.widget.ViewPager2
import cn.partialy.pm.R
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.ActivityDownloadManagementBinding
import cn.partialy.pm.download.AudioMetadataRepairer
import cn.partialy.pm.download.task.DownloadQueueCoordinator
import cn.partialy.pm.download.task.DownloadTaskRepository
import cn.partialy.pm.download.task.DownloadTaskStatus
import cn.partialy.pm.download.task.DeleteDownloadTasksUseCase
import cn.partialy.pm.listen.ListenTogetherManager
import cn.partialy.pm.ui.download.DownloadTaskActionMenu
import cn.partialy.pm.ui.download.DownloadTaskDetailDialog
import cn.partialy.pm.ui.download.DownloadTaskFileReader
import cn.partialy.pm.ui.download.DownloadTaskFileInfo
import cn.partialy.pm.download.task.DownloadTask
import java.io.File
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import cn.partialy.pm.ui.dialog.PmSlotDialog
import cn.partialy.pm.ui.download.DownloadManagementState
import cn.partialy.pm.ui.download.DownloadManagementViewModel
import cn.partialy.pm.ui.download.DownloadTaskPageFragment
import cn.partialy.pm.ui.insets.applySystemBarsInsets
import cn.partialy.pm.ui.insets.enableEdgeToEdgeSystemBars
import cn.partialy.pm.ui.message.MessageType
import cn.partialy.pm.ui.message.PmMessage
import com.google.android.material.checkbox.MaterialCheckBox
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch
import kotlinx.coroutines.Job
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map

@AndroidEntryPoint
class DownloadManagementActivity : BaseActivity() {
    @Inject lateinit var repository: DownloadTaskRepository
    @Inject lateinit var coordinator: DownloadQueueCoordinator
    @Inject lateinit var repairer: AudioMetadataRepairer
    @Inject lateinit var deletion: DeleteDownloadTasksUseCase
    @Inject lateinit var listenTogether: ListenTogetherManager
    private var actionJob: Job? = null
    private var actionDialog: Dialog? = null
    private val model: DownloadManagementViewModel by viewModels()
    private lateinit var binding: ActivityDownloadManagementBinding
    private var menu: PopupWindow? = null
    private val pageCallback = object : ViewPager2.OnPageChangeCallback() {
        override fun onPageSelected(position: Int) { model.selectPage(position); hideKeyboard() }
    }
    override fun onCreate(savedInstanceState: Bundle?) {
        binding = ActivityDownloadManagementBinding.inflate(layoutInflater)
        setContentView(binding.root)
        super.onCreate(savedInstanceState)
        val night = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        enableEdgeToEdgeSystemBars(lightStatusBarIcons = !night, lightNavigationBarIcons = !night)
        binding.downloadManagementRoot.applySystemBarsInsets { insets ->
            binding.downloadManagementStatusBarSpacer.layoutParams = binding.downloadManagementStatusBarSpacer.layoutParams.apply { height = insets.top }
            binding.actionSurface.setPadding(0, 10.dp, 0, insets.bottom)
            binding.taskPager.setPadding(0, 0, 0, if (model.state.value.editing) 0 else insets.bottom)
        }
        binding.taskPager.adapter = object : FragmentStateAdapter(this) {
            override fun getItemCount() = 2
            override fun createFragment(position: Int): Fragment = DownloadTaskPageFragment.create(position)
        }
        binding.taskPager.setCurrentItem(model.state.value.page, false)
        binding.taskPager.registerOnPageChangeCallback(pageCallback)
        binding.backButton.setOnClickListener { back() }
        onBackPressedDispatcher.addCallback(this) { back() }
        binding.downloadingTab.setOnClickListener { if (!model.state.value.editing) binding.taskPager.currentItem = 0 }
        binding.completedTab.setOnClickListener { if (!model.state.value.editing) binding.taskPager.currentItem = 1 }
        binding.moreButton.setOnClickListener { showMenu() }
        binding.doneButton.setOnClickListener { model.edit(false) }
        binding.selectAllAction.setOnClickListener { model.selectAll() }
        binding.invertAction.setOnClickListener { model.invert() }
        binding.repairAction.setOnClickListener { repair(model.state.value.selection) }
        binding.deleteAction.setOnClickListener { showDeleteConfirmation { model.state.value.selection } }
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) { model.state.collect(::render) }
        }
    }
    private fun back() { if (model.state.value.editing) model.edit(false) else finish() }
    private fun render(state: DownloadManagementState) = with(binding) {
        taskPager.isUserInputEnabled = !state.editing
        downloadingTab.isEnabled = !state.editing
        completedTab.isEnabled = !state.editing
        downloadingTab.alpha = if (state.page == 0) 1f else .5f
        completedTab.alpha = if (state.page == 1) 1f else .5f
        downloadingTab.setTextColor(getColor(if (state.page == 0) R.color.primary else R.color.text_secondary))
        completedTab.setTextColor(getColor(if (state.page == 1) R.color.primary else R.color.text_secondary))
        actionSurface.isVisible = state.editing
        headerTabs.isVisible = !state.editing
        selectedCountTextView.isVisible = state.editing
        moreButton.isVisible = !state.editing
        doneButton.isVisible = state.editing
        repairAction.isVisible = state.editing && state.page == 1
        selectedCountTextView.text = getString(R.string.download_management_selected_count, state.selection.size)
        listOf(deleteAction, repairAction).forEach { it.isEnabled = state.selection.isNotEmpty(); it.alpha = if (it.isEnabled) 1f else .45f }
        backButton.setImageResource(if (state.editing) R.drawable.ic_close_24dp else R.drawable.ic_back_24)
        androidx.core.view.ViewCompat.requestApplyInsets(downloadManagementRoot)
    }
    private data class MenuAction(val title: Int, val icon: Int, val enabled: Boolean = true, val danger: Boolean = false, val action: () -> Unit)
    private fun showMenu() {
        menu?.dismiss()
        val state = model.state.value
        val actions = mutableListOf(MenuAction(R.string.download_management_edit, R.drawable.ic_edit_24, state.visibleTasks(state.page).isNotEmpty()) { model.edit(true) })
        if (state.page == 0) {
            actions += MenuAction(R.string.download_ui_pause_all, R.drawable.ic_pause_24, state.tasks.any { it.status.canPause }) {
                lifecycleScope.launch {
                    val count = withContext(Dispatchers.IO) { coordinator.pauseAll() }
                    PmMessage.info(this@DownloadManagementActivity, getString(R.string.download_ui_paused, count))
                }
            }
            actions += MenuAction(R.string.download_ui_resume_all, R.drawable.ic_play_24, state.tasks.any { it.status.canResume }) {
                lifecycleScope.launch { val count = withContext(Dispatchers.IO) { coordinator.resumeAll() }; PmMessage.info(this@DownloadManagementActivity, getString(R.string.download_ui_resumed, count)) }
            }
        } else actions += MenuAction(R.string.download_ui_clear_all, R.drawable.ic_delete_24, state.tasks.any { it.status.isTerminal }, true) {
            showDeleteConfirmation { repository.tasks.value.filter { it.status.isTerminal }.map { it.id }.toSet() }
        }
        val content = layoutInflater.inflate(R.layout.layout_search_source_dropdown, null, false)
        val container = content.findViewById<LinearLayout>(R.id.searchSourceOptionsContainer)
        actions.forEach { item ->
            val row = layoutInflater.inflate(R.layout.item_compact_action_menu_row, container, false)
            val color = if (item.danger) getColor(R.color.pm_dialog_danger) else com.google.android.material.color.MaterialColors.getColor(container, com.google.android.material.R.attr.colorOnSurface)
            row.findViewById<ImageView>(R.id.actionMenuItemIcon).apply { setImageResource(item.icon); setColorFilter(color) }
            row.findViewById<TextView>(R.id.actionMenuItemText).apply { setText(item.title); setTextColor(color) }
            row.isEnabled = item.enabled; row.alpha = if (item.enabled) 1f else .4f
            row.setOnClickListener { menu?.dismiss(); item.action() }
            container.addView(row)
        }
        content.measure(View.MeasureSpec.makeMeasureSpec(resources.displayMetrics.widthPixels - 32.dp, View.MeasureSpec.AT_MOST), View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED))
        menu = PopupWindow(content, content.measuredWidth.coerceAtLeast(160.dp), ViewGroup.LayoutParams.WRAP_CONTENT, true).apply { isOutsideTouchable = true; elevation = 8.dp.toFloat() }
        menu?.showAsDropDown(binding.moreButton, 0, 6.dp, Gravity.END)
    }
    fun onDownloadTaskClick(id: String) {
        val task = repository.find(id) ?: return
        when {
            task.status.canPause -> coordinator.pause(id)
            task.status.canResume -> lifecycleScope.launch {
                if (!withContext(Dispatchers.IO) { coordinator.resume(id) }) PmMessage.warning(this@DownloadManagementActivity, repository.find(id)?.pauseReason ?: getString(R.string.download_ui_resume_failed))
            }
            task.status == DownloadTaskStatus.COMPLETED -> withTaskFile(id) { latest, file -> playLocal(latest, file) }
            task.status.isTerminal -> showTaskMenu(id)
        }
    }
    fun onDownloadTaskTrailingClick(id: String) {
        val task = repository.find(id) ?: return
        if (task.status.isTerminal) { showTaskMenu(id); return }
        if (task.status == DownloadTaskStatus.PROCESSING || actionDialog?.isShowing == true) return
        actionDialog = PmMinimalDialog.Builder(this).setTitle(getString(R.string.download_queue_cancel_title))
            .setMessage(getString(R.string.download_queue_cancel_message)).setCancelButton()
            .setConfirmButton(getString(R.string.download_queue_cancel_action)) { repository.cancelTask(id) }.show()
    }
    private fun withTaskFile(id: String, action: (DownloadTask, DownloadTaskFileInfo) -> Unit) {
        if (actionJob?.isActive == true || actionDialog?.isShowing == true) return
        actionJob = lifecycleScope.launch {
            try {
                val task = repository.find(id) ?: return@launch
                val file = DownloadTaskFileReader.read(applicationContext, task)
                val latest = repository.find(id) ?: return@launch
                if (!lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED) || latest.status != task.status || latest.attemptGeneration != task.attemptGeneration) return@launch
                action(latest, file)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { PmMessage.error(this@DownloadManagementActivity, R.string.download_ui_operation_failed) }
        }
    }
    private fun showTaskMenu(id: String) = withTaskFile(id) { task, file ->
        actionDialog = DownloadTaskActionMenu.show(this, task, file,
            onPlay = { withTaskFile(id) { latest, fresh -> playLocal(latest, fresh) } },
            onRepair = { repair(setOf(id)) },
            onDetails = { withTaskFile(id) { latest, fresh -> actionDialog = DownloadTaskDetailDialog.show(this, latest, fresh) } },
            onDelete = { showDeleteConfirmation { setOf(id) } },
            onRetry = { retry(id) },
        )
    }
    private fun playLocal(task: DownloadTask, file: DownloadTaskFileInfo) {
        if (listenTogether.state.value.enabled) {
            PmMessage.warning(this, R.string.listen_together_local_unsupported)
            return
        }
        val target = task.targetPath?.let(::File)
        if (task.status != DownloadTaskStatus.COMPLETED || !file.readable || target?.isFile != true || !target.canRead()) {
            PmMessage.warning(this, R.string.download_ui_file_unplayable)
            return
        }
        // play 只切换/追加当前歌曲；起播结果由已有播放器状态处理。
        musicController.play(file.song)
    }
    private fun retry(id: String) {
        lifecycleScope.launch {
            try {
                val task = repository.find(id) ?: return@launch
                val result = withContext(Dispatchers.IO) { coordinator.retry(task) }
                if (result.failedKeys.isNotEmpty()) PmMessage.warning(this@DownloadManagementActivity, R.string.download_ui_resume_failed)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { PmMessage.error(this@DownloadManagementActivity, R.string.download_ui_operation_failed) }
        }
    }
    private fun repair(ids: Set<String>) {
        if (ids.isEmpty()) return
        lifecycleScope.launch {
            try {
                val result = repairer.repairSelected(ids)
                PmMessage.show(this@DownloadManagementActivity, if (result.failed > 0) MessageType.WARNING else MessageType.SUCCESS,
                    getString(R.string.download_management_repair_summary, result.success, result.skipped, result.failed), 2500L, null)
            } catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { PmMessage.error(this@DownloadManagementActivity, R.string.download_ui_operation_failed) }
        }
    }
    private fun showDeleteConfirmation(idsProvider: () -> Set<String>) {
        if (idsProvider().isEmpty() || actionDialog?.isShowing == true) return
        val content = layoutInflater.inflate(R.layout.dialog_local_music_delete_confirm, null, false)
        val check = content.findViewById<MaterialCheckBox>(R.id.deleteOriginalFileCheckBox)
        val message = content.findViewById<TextView>(R.id.deleteConfirmMessage)
        check.setText(R.string.download_management_delete_files)
        check.isChecked = false
        message.text = getString(R.string.download_management_confirm_delete, idsProvider().size)
        var previewJob: Job? = null
        val dialog = PmSlotDialog.Builder(this)
            .setHeaderLayout(R.layout.dialog_pm_title_header) { view, _ -> view.findViewById<TextView>(R.id.dialogTitleText).setText(R.string.cache_confirm_title) }
            .setContentView(content).setCancelButton().setConfirmButton(textColor = getColor(R.color.pm_dialog_danger)) {
                // 确认瞬间快照；此后新完成的任务不会被本批删除。
                val ids = idsProvider().toSet()
                previewJob?.cancel()
                lifecycleScope.launch {
                    try {
                        val result = deletion.execute(ids, check.isChecked)
                        if (result.failedCount == 0 && result.skippedInUseCount == 0) model.edit(false)
                        PmMessage.show(this@DownloadManagementActivity,
                            if (result.failedCount > 0 || result.skippedInUseCount > 0) MessageType.WARNING else MessageType.SUCCESS,
                            getString(R.string.download_ui_delete_summary, result.removedCount, result.deletedFileCount, result.sharedFileCount, result.skippedInUseCount, result.failedCount), 3500L, null)
                    } catch (cancelled: CancellationException) { throw cancelled }
                    catch (_: Exception) { PmMessage.error(this@DownloadManagementActivity, R.string.download_management_delete_failed) }
                }
            }.show()
        actionDialog = dialog
        previewJob = lifecycleScope.launch {
            repository.tasks.map { idsProvider().toSet() }.distinctUntilChanged().collectLatest { ids ->
                val preview = deletion.preview(ids)
                if (dialog.isShowing) message.text = getString(R.string.download_ui_delete_preview, preview.count,
                    android.text.format.Formatter.formatShortFileSize(this@DownloadManagementActivity, preview.totalBytes))
            }
        }
        dialog.setOnDismissListener { previewJob?.cancel() }
    }
    private fun hideKeyboard() {
        currentFocus?.let { view ->
            (getSystemService(INPUT_METHOD_SERVICE) as? InputMethodManager)?.hideSoftInputFromWindow(view.windowToken, 0)
            view.clearFocus()
        }
    }
    override fun onDestroy() { actionJob?.cancel(); actionDialog?.dismiss(); menu?.dismiss(); binding.taskPager.unregisterOnPageChangeCallback(pageCallback); super.onDestroy() }
    override fun finish() { super.finish(); AppActivityTransitions.applyBack(this) }
    private val Int.dp get() = (this * resources.displayMetrics.density).toInt()
    companion object {
        fun start(context: Context) { context.startActivity(Intent(context, DownloadManagementActivity::class.java)); AppActivityTransitions.applyForward(context) }
    }
}
