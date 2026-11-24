package cn.partialy.pm.ui.dialog

import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.R
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager

/** 统一承载收藏歌单的单个与批量删除确认。 */
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
                    PmMessage.success(activity, R.string.mine_playlist_deleted)
                    onFinished()
                } else {
                    PmMessage.error(activity, R.string.mine_playlist_delete_failed)
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
        showBatch(activity, localPlaylists) {
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
        }
    }

    /** 只承载确认 UI，实际删除由调用方的业务层执行。 */
    fun showBatch(
        activity: FragmentActivity,
        playlists: List<CollectedPlaylist>,
        onConfirm: () -> Unit,
    ): android.app.Dialog? {
        if (playlists.isEmpty()) return null
        val messageRes = if (playlists.all { it.type == CollectedPlaylistType.LOCAL }) {
            R.string.mine_playlist_batch_delete_confirm_message
        } else {
            R.string.playlist_management_delete_confirm
        }
        return PmMinimalDialog.show(
            context = activity,
            title = activity.getString(R.string.mine_playlist_delete_confirm_title),
            message = activity.getString(messageRes, playlists.size),
            cancelText = activity.getString(R.string.cancel),
            confirmText = activity.getString(R.string.dialog_ok),
            confirmColor = ContextCompat.getColor(activity, R.color.pm_dialog_danger),
            onConfirm = onConfirm,
        )
    }
}
