package cn.partialy.pm.ui.dialog

import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.FragmentActivity
import cn.partialy.pm.R
import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import coil.load
import com.google.android.material.dialog.MaterialAlertDialogBuilder

object PlaylistActionBottomSheet {
    fun show(
        activity: FragmentActivity,
        playlist: CanonicalPlaylist,
        deleteTarget: CollectedPlaylist? = null,
        manager: PlaylistCollectionManager? = null,
        onDeleted: () -> Unit = {},
    ) {
        val items = buildList {
            add(ActionMenuItem(R.drawable.ic_share_24, activity.getString(R.string.song_more_share)) {
                ShareBottomSheet.showPlaylist(activity, playlist)
            })
            if (deleteTarget != null && manager != null) {
                add(ActionMenuItem(
                    iconRes = R.drawable.ic_delete_24,
                    text = activity.getString(R.string.mine_playlist_action_delete),
                    colorRes = R.color.red,
                ) {
                    confirmDelete(activity, deleteTarget, manager, onDeleted)
                })
            }
        }
        ActionMenuBottomSheet.show(
            activity = activity,
            items = items,
            bindHeader = { root ->
                val title = playlist.name.ifBlank { activity.getString(R.string.mine_playlist_untitled) }
                val description = playlist.desc.ifBlank {
                    activity.getString(R.string.share_playlist_fallback_desc, playlist.source.uppercase(), playlist.song_count)
                }
                root.findViewById<TextView>(R.id.songInfoTitleView).text = title
                root.findViewById<TextView>(R.id.songInfoArtistView).text = description
                val coverView = root.findViewById<ImageView>(R.id.songInfoCoverView)
                bindCover(coverView, playlist.cover)
            },
        )
    }

    private fun confirmDelete(
        activity: FragmentActivity,
        playlist: CollectedPlaylist,
        manager: PlaylistCollectionManager,
        onDeleted: () -> Unit,
    ) {
        val name = playlist.name.ifBlank { activity.getString(R.string.mine_playlist_untitled) }
        MaterialAlertDialogBuilder(activity)
            .setBackground(activity.getDrawable(R.drawable.bg_search_field))
            .setTitle(R.string.mine_playlist_delete_confirm_title)
            .setMessage(activity.getString(R.string.mine_playlist_delete_confirm_message, name))
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.dialog_ok) { _, _ ->
                val ok = manager.removePlaylist(playlist.type, playlist.id)
                if (ok) {
                    Toast.makeText(activity, R.string.mine_playlist_deleted, Toast.LENGTH_SHORT).show()
                    onDeleted()
                } else {
                    Toast.makeText(activity, R.string.mine_playlist_delete_failed, Toast.LENGTH_SHORT).show()
                }
            }
            .show()
    }

    private fun bindCover(view: ImageView, cover: String) {
        MinePlaylistCoverResolver.localTemplateRes(cover)?.let { res ->
            view.load(res) {
                placeholder(res)
                error(res)
            }
            return
        }
        val value = cover.trim()
        if (value.startsWith("http://") || value.startsWith("https://")) {
            view.load(value) {
                placeholder(R.drawable.ic_pm_icon)
                error(R.drawable.ic_pm_icon)
            }
        } else {
            view.setImageResource(R.drawable.ic_pm_icon)
        }
    }
}
