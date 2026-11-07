package cn.partialy.pm.ui.download

import android.animation.ValueAnimator
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
import cn.partialy.pm.ui.widget.SongSourceTagBinder
import cn.partialy.pm.utils.SongCoverUrl
import coil.load
import com.google.android.material.color.MaterialColors
import java.io.File

class DownloadTaskAdapter(
    private val onTaskClick: (DownloadTask) -> Unit,
    private val onTaskLongClick: (DownloadTask) -> Unit,
    private val onTrailingClick: (DownloadTask) -> Unit,
    private val onToggleSelection: (String) -> Unit,
) : ListAdapter<DownloadTask, DownloadTaskAdapter.TaskViewHolder>(TaskDiffCallback) {
    private var editing = false
    private var selected = emptySet<String>()
    private var currentLocalPath: String? = null
    private var playing = false
    private var pageActive = false
    private val attached = mutableSetOf<TaskViewHolder>()
    private val stableIds = mutableMapOf<String, Long>()
    private var nextStableId = 0L

    init { setHasStableIds(true) }
    override fun getItemId(position: Int): Long = stableIds.getOrPut(getItem(position).id) { nextStableId++ }

    fun submitTasks(tasks: List<DownloadTask>) { submitList(tasks) }

    fun renderState(editing: Boolean, selected: Set<String>, currentLocalPath: String?, playing: Boolean) {
        if (this.editing == editing && this.selected == selected && this.currentLocalPath == currentLocalPath && this.playing == playing) return
        this.editing = editing
        this.selected = selected.toSet()
        this.currentLocalPath = currentLocalPath
        this.playing = playing
        notifyItemRangeChanged(0, itemCount, LIVE_PAYLOAD)
    }

    fun setPageActive(active: Boolean) {
        pageActive = active
        attached.forEach { it.updateActivity() }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TaskViewHolder =
        TaskViewHolder(ItemDownloadTaskBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: TaskViewHolder, position: Int) { holder.bind(getItem(position), true) }
    override fun onBindViewHolder(holder: TaskViewHolder, position: Int, payloads: MutableList<Any>) {
        holder.bind(getItem(position), payloads.isEmpty())
    }
    override fun onViewAttachedToWindow(holder: TaskViewHolder) {
        super.onViewAttachedToWindow(holder)
        attached += holder
        holder.updateActivity()
    }
    override fun onViewDetachedFromWindow(holder: TaskViewHolder) {
        holder.stopActivity()
        attached -= holder
        super.onViewDetachedFromWindow(holder)
    }
    override fun onViewRecycled(holder: TaskViewHolder) {
        holder.stopActivity()
        attached -= holder
        super.onViewRecycled(holder)
    }
    override fun onDetachedFromRecyclerView(recyclerView: RecyclerView) {
        attached.forEach { it.stopActivity() }
        attached.clear()
        super.onDetachedFromRecyclerView(recyclerView)
    }

    inner class TaskViewHolder(private val binding: ItemDownloadTaskBinding) : RecyclerView.ViewHolder(binding.root) {
        private var task: DownloadTask? = null
        private var current = false
        private val progressBackground = DownloadProgressBackgroundDrawable(
            MaterialColors.getColor(binding.root, com.google.android.material.R.attr.colorPrimary),
        )
        init {
            binding.root.background = progressBackground
            binding.root.setOnClickListener {
                task?.let { if (editing) onToggleSelection(it.id) else onTaskClick(it) }
            }
            binding.root.setOnLongClickListener { task?.let(onTaskLongClick); true }
            binding.btnMore.setOnClickListener { task?.let(onTrailingClick) }
            binding.selectionCheckBox.setOnClickListener { task?.let { onToggleSelection(it.id) } }
        }

        fun bind(value: DownloadTask, bindCover: Boolean) = with(binding) {
            task = value
            if (bindCover) {
                coverImageView.load(SongCoverUrl.getRemoteCover(value.source.name.lowercase(), value.coverUrl, SongCoverUrl.SIZE_SMALL).takeIf { it.isNotBlank() }) {
                    placeholder(R.drawable.mine_entry_my_songs)
                    error(R.drawable.mine_entry_my_songs)
                    fallback(R.drawable.mine_entry_my_songs)
                }
                titleTextView.text = value.title.ifBlank { value.fileName.orEmpty().ifBlank { root.context.getString(R.string.download_management_unknown_song) } }
                subtitleTextView.text = value.artist.ifBlank { root.context.getString(R.string.download_management_unknown_artist) }
                SongSourceTagBinder.bind(sourceTagTextView, value.source)
            }
            DownloadStatusTagBinder.bindQuality(qualityTagTextView, value.qualityKey)
            selectionCheckBox.isVisible = editing
            selectionCheckBox.isChecked = value.id in selected
            root.isActivated = value.id in selected
            btnMore.isVisible = !editing
            btnMore.setImageResource(if (value.status.isTerminal) R.drawable.ic_more_vert_24 else R.drawable.ic_close_24dp)
            btnMore.contentDescription = root.context.getString(if (value.status.isTerminal) R.string.more else R.string.download_row_cancel)
            btnMore.isEnabled = value.status != DownloadTaskStatus.PROCESSING
            btnMore.alpha = if (btnMore.isEnabled) 1f else 0.35f
            statusTagTextView.isVisible = value.status.isTerminal
            if (value.status.isTerminal) DownloadStatusTagBinder.bind(statusTagTextView, value)
            statusTextView.isVisible = !value.status.isTerminal
            statusTextView.text = statusText(value)
            current = value.targetPath != null && currentLocalPath != null && samePath(value.targetPath, currentLocalPath!!)
            currentSongCoverMask.isVisible = current
            titleTextView.setTextColor(MaterialColors.getColor(root, if (current) com.google.android.material.R.attr.colorPrimary else com.google.android.material.R.attr.colorOnSurface))
            progressBackground.update(value.progress, value.totalBytes <= 0, value.status == DownloadTaskStatus.DOWNLOADING, !value.status.isTerminal)
            updateActivity()
        }

        fun updateActivity() {
            val active = pageActive && this in attached && binding.root.isShown
            progressBackground.setActive(active)
            binding.playingSpectrumView.setPlaybackState(current, playing && active && ValueAnimator.areAnimatorsEnabled())
        }
        fun stopActivity() {
            progressBackground.setActive(false)
            binding.playingSpectrumView.setPlaybackState(current, false)
        }
        private fun statusText(task: DownloadTask): String = binding.root.context.getString(when (task.status) {
            DownloadTaskStatus.QUEUED -> R.string.download_management_status_queued
            DownloadTaskStatus.PREPARING -> R.string.download_management_status_preparing
            DownloadTaskStatus.PAUSING -> R.string.download_row_pausing
            DownloadTaskStatus.PAUSED -> R.string.download_row_paused
            DownloadTaskStatus.PROCESSING -> R.string.download_management_status_processing
            else -> R.string.download_row_unknown_progress
        }).let { label ->
            if (task.status == DownloadTaskStatus.DOWNLOADING && task.totalBytes > 0) binding.root.context.getString(R.string.download_row_progress, task.progress.coerceIn(0, 100)) else label
        }
    }

    private fun samePath(first: String, second: String): Boolean = runCatching { File(first).canonicalPath == File(second).canonicalPath }.getOrDefault(false)

    private object TaskDiffCallback : DiffUtil.ItemCallback<DownloadTask>() {
        override fun areItemsTheSame(oldItem: DownloadTask, newItem: DownloadTask) = oldItem.id == newItem.id
        override fun areContentsTheSame(oldItem: DownloadTask, newItem: DownloadTask) = oldItem == newItem
        override fun getChangePayload(oldItem: DownloadTask, newItem: DownloadTask): Any? =
            if (oldItem.title == newItem.title && oldItem.artist == newItem.artist && oldItem.coverUrl == newItem.coverUrl && oldItem.source == newItem.source && oldItem.fileName == newItem.fileName) LIVE_PAYLOAD else null
    }
    private companion object { const val LIVE_PAYLOAD = "live" }
}
