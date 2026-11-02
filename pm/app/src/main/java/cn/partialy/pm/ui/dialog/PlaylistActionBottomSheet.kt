package cn.partialy.pm.ui.dialog

import android.widget.ImageView
import android.widget.TextView
import androidx.fragment.app.FragmentActivity
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.R
import cn.partialy.pm.activity.ShareDetailActivity
import cn.partialy.pm.activity.PlaylistEditActivity
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.toCollectedPlaylist
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.playlistdetail.PlaylistCoverRequestBinder
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager

object PlaylistActionBottomSheet {
    fun show(
        activity: FragmentActivity,
        playlist: CanonicalPlaylist,
        deleteTarget: CollectedPlaylist? = null,
        manager: PlaylistCollectionManager? = null,
        onDeleted: () -> Unit = {},
        onConvertToLocal: (() -> Unit)? = null,
    ) {
        val items = buildList {
            add(ActionMenuItem(R.drawable.ic_info_24, activity.getString(R.string.song_more_detail)) {
                ShareDetailActivity.startPlaylistDetail(activity, playlist)
            })
            if (playlist.source.equals("local", ignoreCase = true) &&
                manager?.getCollectedPlaylist(CollectedPlaylistType.LOCAL, playlist.id) != null) {
                add(ActionMenuItem(R.drawable.ic_edit_24, activity.getString(R.string.playlist_edit_action)) {
                    PlaylistEditActivity.start(activity, playlist.id)
                })
            }
            val favoriteTarget = manager?.let { findCollectedPlaylist(it, playlist) }
            if (manager != null && playlist.source.lowercase() != "local" && playlist.id.isNotBlank()) {
                add(ActionMenuItem(
                    iconRes = if (favoriteTarget == null) R.drawable.ic_love_24 else R.drawable.ic_love_fill_24,
                    text = activity.getString(
                        if (favoriteTarget == null) R.string.collect_playlist else R.string.song_more_cancel_favorite,
                    ),
                    colorRes = if (favoriteTarget == null) null else R.color.red,
                ) {
                    toggleFavorite(activity, playlist, favoriteTarget, manager)
                })
            }
            add(ActionMenuItem(R.drawable.ic_share_24, activity.getString(R.string.song_more_share)) {
                ShareBottomSheet.showPlaylist(activity, playlist)
            })
            if (onConvertToLocal != null && playlist.source.lowercase() in listOf("kg", "wy")) {
                add(ActionMenuItem(R.drawable.ic_playlist_24, activity.getString(R.string.playlist_convert_action)) {
                    onConvertToLocal()
                })
            }
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
        var coverBinder: PlaylistCoverRequestBinder? = null
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
                coverBinder = PlaylistCoverRequestBinder(coverView).also {
                    it.bind(runCatching { SongType.valueOf(playlist.source.uppercase()) }.getOrNull(), playlist.cover)
                }
            },
            onDismiss = { coverBinder?.dispose() },
        )
    }

    private fun findCollectedPlaylist(
        manager: PlaylistCollectionManager,
        playlist: CanonicalPlaylist,
    ): CollectedPlaylist? =
        when (playlist.source.lowercase()) {
            "kg" -> manager.findKgLikeCollected(playlist.id)
            "wy" -> manager.findWyLikeCollected(playlist.id)
            else -> manager.getCollectedPlaylist(playlist.toCollectedPlaylist().type, playlist.id)
        }

    private fun toggleFavorite(
        activity: FragmentActivity,
        playlist: CanonicalPlaylist,
        favoriteTarget: CollectedPlaylist?,
        manager: PlaylistCollectionManager,
    ) {
        if (favoriteTarget == null) {
            val ok = manager.addNetworkPlaylist(playlist.toCollectedPlaylist())
            if (ok) PmMessage.success(activity, R.string.share_detail_favorited)
            else PmMessage.error(activity, R.string.playlist_more_favorite_failed)
            return
        }
        val ok = manager.removePlaylist(favoriteTarget.type, favoriteTarget.id)
        if (ok) PmMessage.success(activity, R.string.share_detail_unfavorited)
        else PmMessage.error(activity, R.string.playlist_more_unfavorite_failed)
    }

    private fun confirmDelete(
        activity: FragmentActivity,
        playlist: CollectedPlaylist,
        manager: PlaylistCollectionManager,
        onDeleted: () -> Unit,
    ) {
        PlaylistDeleteConfirmation.showSingle(activity, playlist, manager, onDeleted)
    }

}
