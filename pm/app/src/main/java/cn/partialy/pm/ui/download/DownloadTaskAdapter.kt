package cn.partialy.pm.ui.download

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.databinding.ItemDownloadTaskBinding
import cn.partialy.pm.download.task.DownloadTask
import cn.partialy.pm.download.task.DownloadTaskStatus
import coil.load

class DownloadTaskAdapter(
    private val onSelectionChanged: (Set<String>) -> Unit,
    private val onTaskClick: (DownloadTask) -> Unit = {},
) : ListAdapter<DownloadTask, DownloadTaskAdapter.TaskViewHolder>(TaskDiffCallback) {

    private val selectedIds = linkedSetOf<String>()
    var selectionMode: Boolean = false
        set(value) {
            if (field == value) return
            field = value
            if (!value) selectedIds.clear()
            notifyDataSetChanged()
            onSelectionChanged(selectedIds.toSet())
        }

    val selection: Set<String>
        get() = selectedIds.toSet()

    fun submitTasks(tasks: List<DownloadTask>) {
        val validIds = tasks.asSequence().map(DownloadTask::id).toSet()
        if (selectedIds.retainAll(validIds)) {
            onSelectionChanged(selectedIds.toSet())
        }
        submitList(tasks)
    }

    fun selectAll() {
        if (!selectionMode) return
        selectedIds.clear()
        selectedIds.addAll(currentList.map(DownloadTask::id))
        notifyDataSetChanged()
        onSelectionChanged(selectedIds.toSet())
    }

    fun invertSelection() {
        if (!selectionMode) return
        val currentIds = currentList.map(DownloadTask::id).toSet()
        selectedIds.apply {
            val previouslySelected = toSet()
            clear()
            addAll(currentIds - previouslySelected)
        }
        notifyDataSetChanged()
        onSelectionChanged(selectedIds.toSet())
    }

    fun clearSelection() {
        if (selectedIds.isEmpty()) return
        selectedIds.clear()
        notifyDataSetChanged()
        onSelectionChanged(emptySet())
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TaskViewHolder =
        TaskViewHolder(
            ItemDownloadTaskBinding.inflate(LayoutInflater.from(parent.context), parent, false),
        )

    override fun onBindViewHolder(holder: TaskViewHolder, position: Int) {
        holder.bind(getItem(position), selectionMode, getItem(position).id in selectedIds)
    }

    inner class TaskViewHolder(
        private val binding: ItemDownloadTaskBinding,
    ) : RecyclerView.ViewHolder(binding.root) {

        fun bind(task: DownloadTask, editing: Boolean, selected: Boolean) = with(binding) {
            selectionCheckBox.isVisible = editing
            selectionCheckBox.setOnCheckedChangeListener(null)
            selectionCheckBox.isChecked = selected
            selectionCheckBox.setOnCheckedChangeListener { _, _ -> toggleSelection(task.id) }
            root.setOnClickListener {
                if (selectionMode) toggleSelection(task.id) else onTaskClick(task)
            }

            coverImageView.load(task.coverUrl.takeIf { !it.isNullOrBlank() }) {
                crossfade(true)
                placeholder(R.drawable.mine_entry_my_songs)
                error(R.drawable.mine_entry_my_songs)
                fallback(R.drawable.mine_entry_my_songs)
            }
            titleTextView.text = task.title.ifBlank {
                task.fileName.orEmpty().ifBlank {
                    root.context.getString(R.string.download_management_unknown_song)
                }
            }
            val artist = task.artist.ifBlank {
                root.context.getString(R.string.download_management_unknown_artist)
            }
            subtitleTextView.text = root.context.getString(
                R.string.download_management_source_quality,
                "$artist · ${task.source}",
                task.qualityKey,
            )
            sizeTextView.text = formatBytes(task.totalBytes.takeIf { it > 0L } ?: task.downloadedBytes)
            statusTextView.text = statusText(task)
            progressIndicator.isVisible = task.status == DownloadTaskStatus.DOWNLOADING
            progressIndicator.setProgressCompat(task.progress.coerceIn(0, 100), true)
        }

        private fun formatBytes(bytes: Long): String =
            if (bytes > 0L) {
                android.text.format.Formatter.formatShortFileSize(binding.root.context, bytes)
            } else {
                binding.root.context.getString(R.string.download_management_unknown_size)
            }

        private fun statusText(task: DownloadTask): CharSequence = with(binding.root.context) {
            when (task.status) {
                DownloadTaskStatus.QUEUED -> getString(R.string.download_management_status_queued)
                DownloadTaskStatus.PREPARING -> getString(R.string.download_management_status_preparing)
                DownloadTaskStatus.DOWNLOADING -> getString(
                    R.string.download_management_status_downloading,
                    task.progress.coerceIn(0, 100),
                )
                DownloadTaskStatus.PROCESSING -> getString(R.string.download_management_status_processing)
                DownloadTaskStatus.COMPLETED -> when (task.metadataStatus) {
                    cn.partialy.pm.download.MetadataWriteStatus.PENDING ->
                        getString(R.string.download_management_repairing)
                    cn.partialy.pm.download.MetadataWriteStatus.FAILED,
                    cn.partialy.pm.download.MetadataWriteStatus.PARTIAL ->
                        getString(R.string.download_management_metadata_warning,
                            task.metadataWarning?.takeIf(String::isNotBlank) ?: "歌曲信息写入异常")
                    else -> getString(R.string.download_management_status_completed)
                }
                DownloadTaskStatus.FAILED -> task.errorMessage
                    ?.takeIf(String::isNotBlank)
                    ?: getString(R.string.download_management_status_failed)
                DownloadTaskStatus.CANCELLED -> getString(R.string.download_management_status_cancelled)
            }
        }
    }

    private fun toggleSelection(id: String) {
        if (!selectionMode) return
        if (!selectedIds.add(id)) selectedIds.remove(id)
        val index = currentList.indexOfFirst { it.id == id }
        if (index >= 0) notifyItemChanged(index)
        onSelectionChanged(selectedIds.toSet())
    }

    private object TaskDiffCallback : DiffUtil.ItemCallback<DownloadTask>() {
        override fun areItemsTheSame(oldItem: DownloadTask, newItem: DownloadTask): Boolean =
            oldItem.id == newItem.id

        override fun areContentsTheSame(oldItem: DownloadTask, newItem: DownloadTask): Boolean =
            oldItem == newItem
    }
}
