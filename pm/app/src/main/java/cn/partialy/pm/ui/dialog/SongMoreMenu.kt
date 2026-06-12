package cn.partialy.pm.ui.dialog

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.FragmentActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.R
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.utils.loveUtil.LoveManager
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import kotlin.math.roundToInt

data class SongMoreMenuDependencies(
    val musicController: MusicController,
    val loveManager: LoveManager,
    val playlistCollectionManager: PlaylistCollectionManager,
    val onDownloadClick: (SongInfo) -> Unit,
    val showShare: Boolean = false,
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
                    if (liked) "已收藏" else "已取消收藏",
                    Toast.LENGTH_SHORT,
                ).show()
            })
            add(ActionMenuItem(
                R.drawable.ic_playlist_24,
                activity.getString(R.string.song_more_add_to_playlist),
            ) {
                showPickLocalPlaylistSheet(activity, song, deps.playlistCollectionManager)
            })
            deps.onListenTogetherClick?.let { onListenTogetherClick ->
                add(ActionMenuItem(
                    R.drawable.ic_listen_together_24,
                    activity.getString(R.string.listen_together_title),
                ) {
                    onListenTogetherClick(song)
                })
            }
            if (deps.showShare) {
                add(ActionMenuItem(
                    R.drawable.ic_share_24,
                    activity.getString(R.string.song_more_share),
                ) {
                    Toast.makeText(
                        activity,
                        R.string.toast_share_coming_soon,
                        Toast.LENGTH_SHORT,
                    ).show()
                })
            }
        }

        ActionMenuBottomSheet.show(
            activity = activity,
            items = actions,
            bindHeader = { root -> SongInfoHeaderBinder.bind(root, song) },
        )
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

    private fun showPickLocalPlaylistSheet(
        activity: FragmentActivity,
        song: SongInfo,
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

        if (localPlaylists.isEmpty()) {
            empty.visibility = View.VISIBLE
            rv.visibility = View.GONE
        } else {
            empty.visibility = View.GONE
            rv.visibility = View.VISIBLE
            rv.layoutManager = LinearLayoutManager(activity)
            rv.adapter = PickLocalPlaylistAdapter(localPlaylists) { playlist ->
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

        dialog.setContentView(root)
        dialog.setOnShowListener {
            applyBottomSheetMaxBehavior(dialog, fraction = 0.78f)
        }
        dialog.show()
    }

    private class PickLocalPlaylistAdapter(
        private val items: List<CollectedPlaylist>,
        private val onPick: (CollectedPlaylist) -> Unit,
    ) : RecyclerView.Adapter<PickLocalPlaylistAdapter.Vh>() {

        class Vh(view: View) : RecyclerView.ViewHolder(view) {
            val name: TextView = view.findViewById(R.id.pickPlaylistNameView)
            val count: TextView = view.findViewById(R.id.pickPlaylistCountView)
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Vh {
            val v = LayoutInflater.from(parent.context)
                .inflate(R.layout.item_pick_local_playlist_row, parent, false)
            return Vh(v)
        }

        override fun onBindViewHolder(holder: Vh, position: Int) {
            val p = items[position]
            holder.name.text = p.name
            val n = p.count.coerceAtLeast(0)
            holder.count.text = holder.itemView.context.getString(R.string.mine_playlist_track_count, n)
            holder.itemView.setOnClickListener { onPick(p) }
        }

        override fun getItemCount(): Int = items.size
    }
}
