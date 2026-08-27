package cn.partialy.pm.ui.dialog

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.activity.ShareDetailActivity
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.model.SongType
import cn.partialy.pm.model.toCanonicalSong
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import coil.load
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlin.math.roundToInt

data class SongMoreMenuDependencies(
    val musicController: MusicController,
    val loveManager: LoveManager,
    val playlistCollectionManager: PlaylistCollectionManager,
    val onDownloadClick: (SongInfo) -> Unit,
    val showShare: Boolean = true,
    val onShareClick: ((SongInfo) -> Unit)? = null,
    val onListenTogetherClick: ((SongInfo) -> Unit)? = null,
)

/**
 * 歌曲「更多」：下一首播放、下载、收藏、添加到自建歌单。
 */
object SongMoreMenu {

    fun show(activity: FragmentActivity, song: SongInfo, deps: SongMoreMenuDependencies) {
        val liked = deps.loveManager.isSongInLoveList(song)
        val actions = buildList {
            add(ActionMenuItem(R.drawable.ic_next_24, activity.getString(R.string.song_more_play_next)) {
                deps.musicController.addPlayNext(song)
                Toast.makeText(activity, R.string.toast_song_added_to_play_next, Toast.LENGTH_SHORT).show()
            })
            add(ActionMenuItem(R.drawable.ic_download_24, activity.getString(R.string.song_more_download)) {
                deps.onDownloadClick(song)
            })
            add(ActionMenuItem(
                iconRes = if (liked) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24,
                text = activity.getString(
                    if (liked) R.string.song_more_cancel_favorite else R.string.song_more_favorite,
                ),
                colorRes = if (liked) R.color.red else null,
            ) {
                val liked = deps.loveManager.toggleLikeStatus(song)
                Toast.makeText(
                    activity,
                    activity.getString(if (liked) R.string.share_favorited else R.string.share_unfavorited),
                    Toast.LENGTH_SHORT,
                ).show()
            })
            add(ActionMenuItem(
                R.drawable.ic_playlist_24,
                activity.getString(R.string.song_more_add_to_playlist),
            ) {
                showAddToSheet(activity, song, deps.musicController, deps.playlistCollectionManager)
            })
            deps.onListenTogetherClick?.let { onListenTogetherClick ->
                add(ActionMenuItem(
                    R.drawable.ic_listen_together_24,
                    activity.getString(R.string.listen_together_title),
                ) {
                    onListenTogetherClick(song)
                })
            }
            add(ActionMenuItem(
                R.drawable.ic_info_24,
                activity.getString(R.string.song_more_detail),
            ) {
                ShareDetailActivity.startSongDetail(activity, song.toCanonicalSong())
            })
            if (deps.showShare) {
                add(ActionMenuItem(
                    R.drawable.ic_share_24,
                    activity.getString(R.string.song_more_share),
                ) {
                    if (song.type == SongType.LOCAL) {
                        showLocalSongShareUnsupported(activity)
                    } else {
                        deps.onShareClick?.invoke(song) ?: ShareBottomSheet.showSong(activity, song)
                    }
                })
            }
        }

        ActionMenuBottomSheet.show(
            activity = activity,
            items = actions,
            bindHeader = { root -> SongInfoHeaderBinder.bind(root, song) },
        )
    }

    private fun showLocalSongShareUnsupported(activity: FragmentActivity) {
        PmMinimalDialog.Builder(activity)
            .setMessage(activity.getString(R.string.local_song_share_unsupported))
            .setSingleButton(activity.getString(R.string.dialog_i_know))
            .show()
    }

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

    private fun showAddToSheet(
        activity: FragmentActivity,
        song: SongInfo,
        musicController: MusicController,
        playlistCollectionManager: PlaylistCollectionManager,
    ) {
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
            add(AddToTarget.CurrentQueue(musicController.playList.value.size))
            addAll(localPlaylists.map { AddToTarget.LocalPlaylist(it) })
        }

        empty.visibility = View.GONE
        rv.visibility = View.VISIBLE
        rv.layoutManager = LinearLayoutManager(activity)
        val adapter = AddToTargetAdapter(items) { target ->
            when (target) {
                is AddToTarget.CurrentQueue -> {
                    musicController.addToPlayList(song, autoPlay = false)
                    Toast.makeText(
                        activity,
                        activity.getString(R.string.toast_song_added_to_playlist, activity.getString(R.string.current_play_queue)),
                        Toast.LENGTH_SHORT,
                    ).show()
                    dialog.dismiss()
                }
                is AddToTarget.LocalPlaylist -> {
                    val playlist = target.playlist
                    val added = playlistCollectionManager.addSongsToLocalPlaylist(playlist.id, listOf(song))
                    val msg = if (added) {
                        activity.getString(R.string.toast_song_added_to_playlist, playlist.name)
                    } else {
                        activity.getString(R.string.toast_song_already_in_playlist)
                    }
                    Toast.makeText(activity, msg, Toast.LENGTH_SHORT).show()
                    dialog.dismiss()
                }
            }
        }
        rv.adapter = adapter

        var queueCountJob: Job? = activity.lifecycleScope.launch {
            musicController.playList.collect { songs ->
                adapter.updateQueueCount(songs.size)
            }
        }

        dialog.setContentView(root)
        dialog.setOnDismissListener {
            queueCountJob?.cancel()
            queueCountJob = null
        }
        dialog.setOnShowListener {
            applyBottomSheetMaxBehavior(dialog, fraction = 0.5f)
        }
        dialog.show()
    }

    private sealed class AddToTarget {
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
            when (val item = items[position]) {
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
