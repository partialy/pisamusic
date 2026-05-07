package cn.partialy.pm.ui.dialog

import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
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
import coil.load
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.color.MaterialColors
import com.google.android.material.imageview.ShapeableImageView
import kotlin.math.roundToInt

data class SongMoreMenuDependencies(
    val musicController: MusicController,
    val loveManager: LoveManager,
    val playlistCollectionManager: PlaylistCollectionManager,
    val onDownloadClick: (SongInfo) -> Unit,
    val showShare: Boolean = false,
)

/**
 * 歌曲「更多」：下一首播放、下载、收藏、添加到自建歌单。
 */
object SongMoreMenu {

    fun show(activity: FragmentActivity, song: SongInfo, deps: SongMoreMenuDependencies) {
        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val root = LayoutInflater.from(activity).inflate(R.layout.layout_song_more_bottom_sheet, null)

        /** 第一个 sheet 关闭后再打开选歌单；不能用已 detach 的 contentView.post。 */
        var openPickPlaylistAfterDismiss = false

        val cover = root.findViewById<ShapeableImageView>(R.id.songMoreCoverView)
        val title = root.findViewById<TextView>(R.id.songMoreTitleView)
        val artist = root.findViewById<TextView>(R.id.songMoreArtistView)
        title.text = song.name
        artist.text = song.artist
        loadSongCover(cover, song)

        root.findViewById<ImageButton>(R.id.songMoreCloseButton).setOnClickListener { dialog.dismiss() }
        val loveIcon = root.findViewById<ImageView>(R.id.songMoreLoveIcon)
        val loveText = root.findViewById<TextView>(R.id.songMoreLoveText)

        fun renderLoveState() {
            val liked = deps.loveManager.isSongInLoveList(song)
            loveIcon.setImageResource(if (liked) R.drawable.ic_love_fill_24 else R.drawable.ic_love_24)
            loveIcon.setColorFilter(
                if (liked) {
                    ContextCompat.getColor(activity, R.color.red)
                } else {
                    MaterialColors.getColor(loveIcon, com.google.android.material.R.attr.colorOnSurface)
                }
            )
            loveText.setText(if (liked) R.string.song_more_cancel_favorite else R.string.song_more_favorite)
        }
        renderLoveState()

        root.findViewById<LinearLayout>(R.id.songMoreRowPlayNext).setOnClickListener {
            deps.musicController.addPlayNext(song)
            dialog.dismiss()
            Toast.makeText(activity, R.string.toast_song_added_to_play_next, Toast.LENGTH_SHORT).show()
        }
        root.findViewById<LinearLayout>(R.id.songMoreRowDownload).setOnClickListener {
            deps.onDownloadClick(song)
            dialog.dismiss()
        }
        root.findViewById<LinearLayout>(R.id.songMoreRowLove).setOnClickListener {
            val liked = deps.loveManager.toggleLikeStatus(song)
            renderLoveState()
            dialog.dismiss()
            if (liked) {
                Toast.makeText(activity, "已收藏", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(activity, "已取消收藏", Toast.LENGTH_SHORT).show()
            }
        }
        root.findViewById<LinearLayout>(R.id.songMoreRowAddPlaylist).setOnClickListener {
            openPickPlaylistAfterDismiss = true
            dialog.dismiss()
        }
        root.findViewById<LinearLayout>(R.id.songMoreRowShare).apply {
            visibility = if (deps.showShare) View.VISIBLE else View.GONE
            setOnClickListener {
                dialog.dismiss()
                Toast.makeText(activity, R.string.toast_share_coming_soon, Toast.LENGTH_SHORT).show()
            }
        }

        dialog.setContentView(root)
        dialog.setOnShowListener {
            applyBottomSheetMaxBehavior(dialog, fraction = 0.72f)
        }
        dialog.setOnDismissListener {
            if (!openPickPlaylistAfterDismiss) return@setOnDismissListener
            openPickPlaylistAfterDismiss = false
            val runOpenPick: () -> Unit = {
                if (!(activity.isFinishing || activity.isDestroyed)) {
                    showPickLocalPlaylistSheet(activity, song, deps.playlistCollectionManager)
                }
            }
            val decor = activity.window?.decorView
            if (decor != null) {
                decor.post(runOpenPick)
            } else {
                Handler(Looper.getMainLooper()).postDelayed(runOpenPick, 50)
            }
        }
        dialog.show()
    }

    private fun loadSongCover(imageView: ImageView, song: SongInfo) {
        val coverData = song.embeddedCoverArt
            ?: song.coverUrl.takeIf { it.isNotBlank() }?.replace("{size}", "120")
        imageView.load(coverData) {
            placeholder(R.drawable.ic_pm_icon)
            error(R.drawable.ic_pm_icon)
        }
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
