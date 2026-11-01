package cn.partialy.pm.ui.dialog

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import coil.load
import coil.dispose
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

object AddToPlaylistBottomSheet {
    private fun applyBottomSheetMaxBehavior(dialog: BottomSheetDialog, fraction: Float) {
        val bottomSheet = dialog.findViewById<View>(
            com.google.android.material.R.id.design_bottom_sheet,
        ) ?: return
        val maxH = (dialog.context.resources.displayMetrics.heightPixels * fraction).roundToInt()
        BottomSheetBehavior.from(bottomSheet as ViewGroup).apply {
            skipCollapsed = true
            this.maxHeight = maxH
            state = BottomSheetBehavior.STATE_EXPANDED
        }
    }

    fun show(
        activity: FragmentActivity,
        songs: List<SongInfo>,
        musicController: MusicController,
        playlistCollectionManager: PlaylistCollectionManager,
        allowQueueTarget: Boolean = true,
        onResult: (cn.partialy.pm.player.PlaylistAppendResult) -> Unit = {},
        onFinished: () -> Unit = {},
    ) {
        var finished = false
        fun finish() { if (!finished) { finished = true; onFinished() } }
        val report: (cn.partialy.pm.player.PlaylistAppendResult) -> Unit = { onResult(it); finish() }
        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val root = LayoutInflater.from(activity).inflate(R.layout.layout_pick_local_playlist_bottom_sheet, null)
        val empty = root.findViewById<TextView>(R.id.pickPlaylistEmptyView)
        val rv = root.findViewById<RecyclerView>(R.id.pickPlaylistRecyclerView)

        val localPlaylists = playlistCollectionManager.getAllPlaylists()
            .filter { it.type == CollectedPlaylistType.LOCAL }
        val items = buildList {
            if (allowQueueTarget) {
                add(AddToTarget.CurrentQueue(musicController.playList.value.size))
            }
            addAll(localPlaylists.map { AddToTarget.LocalPlaylist(it) })
            add(AddToTarget.NewPlaylist)
        }

        empty.visibility = if (items.isEmpty()) View.VISIBLE else View.GONE
        rv.visibility = if (items.isEmpty()) View.GONE else View.VISIBLE
        rv.layoutManager = LinearLayoutManager(activity)
        var next: (() -> Unit)? = null
        val adapter = AddToTargetAdapter(items) { target ->
            next = {
                val name = when (target) {
                    is AddToTarget.CurrentQueue -> activity.getString(R.string.current_play_queue)
                    is AddToTarget.LocalPlaylist -> target.playlist.name
                    AddToTarget.NewPlaylist -> activity.getString(R.string.dialog_create_local_playlist_title)
                }
                val apply = {
                    when (target) {
                        is AddToTarget.CurrentQueue -> musicController.appendSongsLazyWithResult(songs, report)
                        is AddToTarget.LocalPlaylist -> activity.lifecycleScope.launch {
                            val result = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
                                runCatching { playlistCollectionManager.addSongsToLocalPlaylistWithResult(target.playlist.id, songs) }.getOrNull()
                            }
                            report(cn.partialy.pm.player.PlaylistAppendResult(result?.added.orEmpty(), result?.existing.orEmpty(), result?.failed ?: songs))
                        }
                        AddToTarget.NewPlaylist -> LocalPlaylistCreateDialog.show(activity, playlistCollectionManager, songs,
                            onCreated = { report(cn.partialy.pm.player.PlaylistAppendResult(songs.filter { it.id.isNotBlank() }.distinctBy { it.type to it.id }, emptyList(), songs.filter { it.id.isBlank() })) }, onDismiss = ::finish)
                    }
                }
                if (songs.size > 100) {
                    var submitted = false
                    PmMinimalDialog.show(activity,
                        message = activity.getString(R.string.online_batch_large_add, songs.size, name),
                        cancelText = activity.getString(R.string.cancel), confirmText = activity.getString(R.string.dialog_ok),
                        onConfirm = { if (!submitted) { submitted = true; apply() } }).setOnDismissListener { if (!submitted) finish() }
                } else apply()
            }
            dialog.dismiss()
        }
        rv.adapter = adapter

        var queueCountJob: Job? = if (allowQueueTarget) {
            activity.lifecycleScope.launch {
                musicController.playList.collect { songs ->
                    adapter.updateQueueCount(songs.size)
                }
            }
        } else {
            null
        }

        dialog.setContentView(root)
        dialog.setOnDismissListener {
            queueCountJob?.cancel()
            queueCountJob = null
            next?.invoke() ?: finish()
        }
        dialog.setOnShowListener {
            applyBottomSheetMaxBehavior(dialog, fraction = 0.5f)
        }
        dialog.show()
    }

    private sealed class AddToTarget {
        data object NewPlaylist : AddToTarget()
        data class CurrentQueue(val count: Int) : AddToTarget()
        data class LocalPlaylist(val playlist: CollectedPlaylist) : AddToTarget()
    }

    private class AddToTargetAdapter(
        items: List<AddToTarget>,
        private val onPick: (AddToTarget) -> Unit,
    ) : RecyclerView.Adapter<AddToTargetAdapter.Vh>() {
        private val items = items.toMutableList()

        class Vh(view: View) : RecyclerView.ViewHolder(view) {
            val cover: ImageView = view.findViewById(R.id.pickPlaylistCoverView)
            val name: TextView = view.findViewById(R.id.pickPlaylistNameView)
            val count: TextView = view.findViewById(R.id.pickPlaylistCountView)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Vh {
            val v = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_pick_local_playlist_row, parent, false)
            return Vh(v)
        }

        override fun onBindViewHolder(holder: Vh, position: Int) {
            holder.cover.dispose()
            when (val item = items[position]) {
                AddToTarget.NewPlaylist -> {
                    holder.cover.setImageResource(R.drawable.ic_playlist_24)
                    holder.name.setText(R.string.dialog_create_local_playlist_title)
                    holder.count.text = ""
                }
                is AddToTarget.CurrentQueue -> {
                    holder.cover.setImageResource(R.drawable.mine_entry_favorite_playlists)
                    holder.name.text = holder.itemView.context.getString(R.string.current_play_queue)
                    holder.count.text = holder.itemView.context.getString(
                        R.string.mine_playlist_track_count,
                        item.count.coerceAtLeast(0),
                    )
                }
                is AddToTarget.LocalPlaylist -> {
                    val p = item.playlist
                    bindCover(holder.cover, p)
                    holder.name.text = p.name
                    holder.count.text = holder.itemView.context.getString(
                        R.string.mine_playlist_track_count,
                        p.count.coerceAtLeast(0),
                    )
                }
            }
            holder.itemView.setOnClickListener { onPick(items[position]) }
        }

        override fun getItemCount(): Int = items.size

        fun updateQueueCount(count: Int) {
            val current = items.firstOrNull() as? AddToTarget.CurrentQueue ?: return
            if (current.count == count) return
            items[0] = current.copy(count = count)
            notifyItemChanged(0)
        }

        private fun bindCover(iv: ImageView, item: CollectedPlaylist) {
            MinePlaylistCoverResolver.localTemplateRes(item.cover)?.let { res ->
                iv.setImageResource(res)
                return
            }
            MinePlaylistCoverResolver.localFileForCover(item.cover)?.let { file ->
                val ph = MinePlaylistCoverResolver.defaultLocalCoverRes()
                iv.load(file) {
                    crossfade(true)
                    placeholder(ph)
                    error(ph)
                }
                return
            }
            val url = item.cover.trim()
            if (url.startsWith("http://") || url.startsWith("https://")) {
                iv.load(url) {
                    placeholder(MinePlaylistCoverResolver.fallbackCoverRes)
                    error(MinePlaylistCoverResolver.fallbackCoverRes)
                }
            } else {
                iv.setImageResource(
                    if (item.type == CollectedPlaylistType.LOCAL) {
                        MinePlaylistCoverResolver.defaultLocalCoverRes()
                    } else {
                        MinePlaylistCoverResolver.fallbackCoverRes
                    },
                )
            }
        }
    }
}
