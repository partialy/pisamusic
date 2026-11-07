package cn.partialy.pm.ui.download

import androidx.fragment.app.FragmentActivity
import cn.partialy.pm.R
import cn.partialy.pm.download.task.DownloadTask
import cn.partialy.pm.download.task.DownloadTaskStatus
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.dialog.ActionMenuBottomSheet
import cn.partialy.pm.ui.dialog.ActionMenuItem
import cn.partialy.pm.ui.dialog.SongInfoHeaderBinder
import com.google.android.material.bottomsheet.BottomSheetDialog

object DownloadTaskActionMenu {
    fun show(
        activity: FragmentActivity,
        task: DownloadTask,
        file: DownloadTaskFileInfo,
        onPlay: () -> Unit,
        onRepair: () -> Unit,
        onDetails: () -> Unit,
        onDelete: () -> Unit,
        onRetry: () -> Unit,
    ): BottomSheetDialog {
        val items = mutableListOf<ActionMenuItem>()
        if (task.status == DownloadTaskStatus.COMPLETED && file.readable) {
            items += ActionMenuItem(R.drawable.ic_play_24, activity.getString(R.string.download_details_play), onClick = onPlay)
            items += ActionMenuItem(R.drawable.ic_edit_24, activity.getString(R.string.download_management_repair_action), onClick = onRepair)
        } else if (task.status == DownloadTaskStatus.COMPLETED && file.exists) {
            // 存在但损坏的音频不满足核心重下条件；保留诊断/修复及安全删除入口。
            items += ActionMenuItem(R.drawable.ic_edit_24, activity.getString(R.string.download_management_repair_action), onClick = onRepair)
        } else {
            items += ActionMenuItem(R.drawable.ic_download_24, activity.getString(R.string.download_details_retry), onClick = onRetry)
            if (task.status == DownloadTaskStatus.FAILED && file.readable) {
                items += ActionMenuItem(R.drawable.ic_edit_24, activity.getString(R.string.download_management_repair_action), onClick = onRepair)
            }
        }
        items += ActionMenuItem(R.drawable.ic_info_24, activity.getString(R.string.download_details_title), onClick = onDetails)
        items += ActionMenuItem(R.drawable.ic_delete_24, activity.getString(R.string.delete), R.color.pm_dialog_danger, onDelete)
        return ActionMenuBottomSheet.show(activity, items, bindHeader = { root ->
            SongInfoHeaderBinder.bind(root, if (file.readable) file.song else SongInfo(
                task.songId, task.source, task.title, task.artist, task.coverUrl, album = task.album,
            ))
        })
    }
}
