package cn.partialy.pm.ui.dialog

import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.utils.playlistUtil.LocalPlaylistAutoCoverRules
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import com.google.android.material.textfield.TextInputEditText
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** “我的”、单曲及批量添加统一创建入口；只收集名称，初始歌曲与封面一同提交。 */
object LocalPlaylistCreateDialog {
    fun show(
        activity: FragmentActivity,
        manager: PlaylistCollectionManager,
        songs: List<SongInfo> = emptyList(),
        onCreated: (String) -> Unit = {},
        onDismiss: () -> Unit = {},
    ) {
        val root = activity.layoutInflater.inflate(R.layout.dialog_create_local_playlist, null, false)
        val title = root.findViewById<TextInputEditText>(R.id.playlistTitleEdit)
        var busy = false
        var closed = false

        val dialog = PmSlotDialog.Builder(activity)
            .setContentView(root)
            .setCancelButton(activity.getString(R.string.cancel))
            .setConfirmButton(activity.getString(R.string.dialog_ok), dismissOnConfirm = false) { dialog ->
                if (busy || closed) return@setConfirmButton
                val name = title.text?.toString()?.trim().orEmpty()
                if (name.isBlank()) {
                    PmMessage.warning(activity, R.string.toast_playlist_name_required)
                    return@setConfirmButton
                }
                busy = true
                dialog.setCancelable(false)
                dialog.findViewById<android.view.View>(R.id.cancelButton)?.isEnabled = false
                dialog.findViewById<android.view.View>(R.id.confirmButton)?.isEnabled = false
                title.isEnabled = false
                activity.lifecycleScope.launch {
                    val result = withContext(NonCancellable + Dispatchers.IO) {
                        runCatching {
                            manager.createLocalPlaylistWithSongs(
                                name = name,
                                songs = songs,
                                intro = "",
                                cover = LocalPlaylistAutoCoverRules.fromLastAddedSong(
                                    songs.filter { it.id.isNotBlank() }.distinctBy { it.type to it.id },
                                ).orEmpty(),
                            )
                        }
                    }
                    busy = false
                    if (closed || activity.isDestroyed || activity.isFinishing) return@launch
                    result.onSuccess { id ->
                        onCreated(id)
                        dialog.dismiss()
                    }.onFailure {
                        dialog.setCancelable(true)
                        dialog.findViewById<android.view.View>(R.id.cancelButton)?.isEnabled = true
                        dialog.findViewById<android.view.View>(R.id.confirmButton)?.isEnabled = true
                        title.isEnabled = true
                        PmMessage.error(activity, R.string.online_batch_create_failed)
                    }
                }
            }.show()

        val observer = object : DefaultLifecycleObserver {
            override fun onDestroy(owner: LifecycleOwner) {
                dialog.dismiss()
            }
        }
        activity.lifecycle.addObserver(observer)
        dialog.setOnDismissListener {
            closed = true
            activity.lifecycle.removeObserver(observer)
            onDismiss()
        }
        title.requestFocus()
    }
}
