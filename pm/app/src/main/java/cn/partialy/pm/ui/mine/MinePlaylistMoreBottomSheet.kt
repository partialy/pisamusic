package cn.partialy.pm.ui.mine

import android.view.View
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.fragment.app.FragmentActivity
import cn.partialy.pm.R
import cn.partialy.pm.model.CollectedPlaylist
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import com.google.android.material.dialog.MaterialAlertDialogBuilder

/** 「我的」歌单更多：底部菜单，当前仅支持删除（含本地封面与 songs 文件，由 [PlaylistCollectionManager.removePlaylist] 处理）。 */
object MinePlaylistMoreBottomSheet {

    fun show(
        fragment: Fragment,
        playlist: CollectedPlaylist,
        manager: PlaylistCollectionManager,
        onDeleted: () -> Unit = {},
    ) {
        show(fragment.requireActivity(), playlist, manager, onDeleted)
    }

    fun show(
        activity: FragmentActivity,
        playlist: CollectedPlaylist,
        manager: PlaylistCollectionManager,
        onDeleted: () -> Unit = {},
    ) {
        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val sheet = activity.layoutInflater.inflate(R.layout.bottom_sheet_mine_playlist_more, null)
        dialog.setContentView(sheet)
        dialog.setOnShowListener {
            dialog.findViewById<View>(com.google.android.material.R.id.design_bottom_sheet)
                ?.setBackgroundResource(R.drawable.bg_mine_avatar_bottom_sheet)
        }
        sheet.findViewById<MaterialButton>(R.id.playlistMoreDelete).setOnClickListener {
            dialog.dismiss()
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
        sheet.findViewById<MaterialButton>(R.id.playlistMoreCancel).setOnClickListener {
            dialog.dismiss()
        }
        dialog.show()
    }
}
