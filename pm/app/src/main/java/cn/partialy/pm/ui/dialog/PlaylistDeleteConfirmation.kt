package cn.partialy.pm.ui.dialog

import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import android.widget.Toast
import cn.partialy.pm.R
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager

/** 统一承载收藏歌单的单个与本地歌单批量删除确认。 */
object PlaylistDeleteConfirmation {

    fun showSingle(
        activity: FragmentActivity,
        playlist: CollectedPlaylist,
        manager: PlaylistCollectionManager,
        onFinished: () -> Unit,
    ) {
        val name = playlist.name.ifBlank { activity.getString(R.string.mine_playlist_untitled) }
        PmMinimalDialog.show(
            context = activity,
            title = activity.getString(R.string.mine_playlist_delete_confirm_title),
            message = activity.getString(R.string.mine_playlist_delete_confirm_message, name),
            cancelText = activity.getString(R.string.cancel),
            confirmText = activity.getString(R.string.dialog_ok),
            confirmColor = ContextCompat.getColor(activity, R.color.pm_dialog_danger),
            onConfirm = {
                if (manager.removePlaylist(playlist.type, playlist.id)) {
                    Toast.makeText(activity, R.string.mine_playlist_deleted, Toast.LENGTH_SHORT).show()
                    onFinished()
                } else {
                    Toast.makeText(activity, R.string.mine_playlist_delete_failed, Toast.LENGTH_SHORT).show()
                }
            },
        )
    }

    fun showLocalBatch(
        activity: FragmentActivity,
        playlists: List<CollectedPlaylist>,
        manager: PlaylistCollectionManager,
        onFinished: (deleted: Int, failed: Int) -> Unit,
    ) {
        val localPlaylists = playlists.filter { it.type == CollectedPlaylistType.LOCAL }
        if (localPlaylists.isEmpty()) {
            onFinished(0, 0)
            return
        }
        PmMinimalDialog.show(
            context = activity,
            title = activity.getString(R.string.mine_playlist_delete_confirm_title),
            message = activity.getString(
                R.string.mine_playlist_batch_delete_confirm_message,
                localPlaylists.size,
            ),
            cancelText = activity.getString(R.string.cancel),
            confirmText = activity.getString(R.string.dialog_ok),
            confirmColor = ContextCompat.getColor(activity, R.color.pm_dialog_danger),
            onConfirm = {
                var deleted = 0
                var failed = 0
                localPlaylists.forEach { playlist ->
                    if (manager.removePlaylist(playlist.type, playlist.id)) {
                        deleted++
                    } else {
                        failed++
                    }
                }
                onFinished(deleted, failed)
            },
        )
    }
}
