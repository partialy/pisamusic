package cn.partialy.pm.ui.mine

import androidx.fragment.app.FragmentActivity
import cn.partialy.pm.R
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.player.MusicController
import cn.partialy.pm.ui.dialog.ActionMenuBottomSheet
import cn.partialy.pm.ui.dialog.ActionMenuItem
import cn.partialy.pm.ui.dialog.AddToPlaylistBottomSheet
import cn.partialy.pm.ui.dialog.SongInfoHeaderBinder
import cn.partialy.pm.ui.message.MessageType
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager

/** 三类批量页共用操作菜单与添加到流程，来源相关的删除业务由各 Activity 决定。 */
object PlaylistBatchActionCoordinator {
    fun show(activity: FragmentActivity, songs: List<SongInfo>, items: List<ActionMenuItem>) {
        if (songs.isEmpty() || activity.isFinishing || activity.isDestroyed) return
        ActionMenuBottomSheet.show(activity, items, bindHeader = {
            SongInfoHeaderBinder.bind(it, songs.first())
        })
    }

    fun addSelected(
        activity: FragmentActivity,
        songs: List<SongInfo>,
        controller: MusicController,
        manager: PlaylistCollectionManager,
        excludeLocalPlaylistId: String? = null,
        onHandled: (Set<String>) -> Unit,
        onFinished: () -> Unit,
    ) {
        if (songs.isEmpty()) { onFinished(); return }
        AddToPlaylistBottomSheet.show(
            activity, songs, controller, manager,
            excludeLocalPlaylistId = excludeLocalPlaylistId,
            onResult = { result ->
                if (!activity.isFinishing && !activity.isDestroyed) {
                    onHandled((result.added + result.existing).mapTo(linkedSetOf(), ::playlistSongKey))
                    PmMessage.show(activity,
                        if (result.failed.isNotEmpty()) MessageType.WARNING else MessageType.SUCCESS,
                        activity.getString(R.string.online_batch_add_result,
                            result.added.size, result.existing.size, result.failed.size),
                        2000L, null)
                }
            },
            onFinished = onFinished,
        )
    }
}
