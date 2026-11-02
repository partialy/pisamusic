package cn.partialy.pm.ui.dialog

import android.view.LayoutInflater
import android.widget.EditText
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.isVisible
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.R
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.mine.CreateLocalPlaylistCoverPickerAdapter
import cn.partialy.pm.ui.mine.MinePlaylistCoverResolver
import cn.partialy.pm.utils.playlistUtil.PlaylistCollectionManager
import com.google.android.material.button.MaterialButton
import com.google.android.material.imageview.ShapeableImageView
import coil.load
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/** 单曲、批量与“我的”共用表单；先落封面，再事务创建完整歌单。 */
object LocalPlaylistCreateDialog {
    fun show(activity: FragmentActivity, manager: PlaylistCollectionManager,
        songs: List<SongInfo> = emptyList(), onCreated: (String) -> Unit = {}, onDismiss: () -> Unit = {}) {
        val root = LayoutInflater.from(activity).inflate(R.layout.dialog_create_local_playlist, null, false)
        val title = root.findViewById<EditText>(R.id.playlistTitleEdit)
        val intro = root.findViewById<EditText>(R.id.playlistIntroEdit)
        val preview = root.findViewById<ShapeableImageView>(R.id.customCoverPreview)
        val clear = root.findViewById<MaterialButton>(R.id.clearCustomCoverButton)
        val pick = root.findViewById<MaterialButton>(R.id.pickCustomCoverButton)
        val pending = File(activity.cacheDir, "playlist-cover-${UUID.randomUUID()}")
        var busy = false
        var closed = false
        fun refresh() {
            val has = pending.isFile && pending.length() > 0
            clear.isVisible = has
            preview.isVisible = has
            if (has) preview.load(pending) else preview.setImageDrawable(null)
        }
        val adapter = CreateLocalPlaylistCoverPickerAdapter()
        adapter.onTemplateSelected = { if (!busy) { pending.delete(); refresh() } }
        root.findViewById<RecyclerView>(R.id.coverPickerRecyclerView).apply {
            layoutManager = LinearLayoutManager(activity, RecyclerView.HORIZONTAL, false)
            this.adapter = adapter
            itemAnimator = null
        }
        // 无 LifecycleOwner 的 registry 注册允许从已启动页面打开，关闭时显式注销。
        val launcher = activity.activityResultRegistry.register("playlist-cover-${UUID.randomUUID()}", ActivityResultContracts.GetContent()) { uri ->
            if (uri != null && !closed && !busy) activity.lifecycleScope.launch {
                busy = true
                val ok = withContext(Dispatchers.IO) { runCatching {
                    activity.contentResolver.openInputStream(uri)?.use { input -> pending.outputStream().use { input.copyTo(it) } }
                        ?: error("无法读取图片")
                }.isSuccess }
                busy = false
                if (!closed) {
                    if (ok) refresh() else PmMessage.error(activity, R.string.toast_playlist_cover_read_failed)
                } else pending.delete()
            }.invokeOnCompletion { busy = false; if (closed || activity.isDestroyed) pending.delete() }
        }
        pick.setOnClickListener { if (!busy) launcher.launch("image/*") }
        clear.setOnClickListener { if (!busy) { pending.delete(); refresh() } }
        refresh()
        val dialog = PmSlotDialog.Builder(activity)
            .setHeaderLayout(R.layout.dialog_pm_title_header) { view, _ ->
                view.findViewById<TextView>(R.id.dialogTitleText).setText(R.string.dialog_create_local_playlist_title)
            }.setContentView(root).setCancelButton(activity.getString(R.string.cancel))
            .setConfirmButton(activity.getString(R.string.dialog_ok), dismissOnConfirm = false) { dialog ->
                if (busy) return@setConfirmButton
                val name = title.text.toString().trim()
                if (name.isEmpty()) {
                    PmMessage.warning(activity, R.string.toast_playlist_name_required)
                    return@setConfirmButton
                }
                val description = intro.text.toString().trim()
                val template = MinePlaylistCoverResolver.coverStorageValue(adapter.selectedSuffix)
                busy = true
                dialog.setCancelable(false)
                dialog.findViewById<android.view.View>(R.id.cancelButton)?.isEnabled = false
                pick.isEnabled = false; clear.isEnabled = false; title.isEnabled = false; intro.isEnabled = false
                activity.lifecycleScope.launch {
                    val result = withContext(kotlinx.coroutines.NonCancellable + Dispatchers.IO) { runCatching {
                        val custom = if (pending.isFile && pending.length() > 0) MinePlaylistCoverResolver.persistedCoverFile(activity, UUID.randomUUID().toString()) else null
                        try {
                            custom?.let { pending.copyTo(it, overwrite = false) }
                            manager.createLocalPlaylistWithSongs(name, songs, description,
                                custom?.let { MinePlaylistCoverResolver.storageValueForAbsolutePath(it.absolutePath) } ?: template)
                        } catch (error: Exception) { custom?.delete(); throw error }
                    } }
                    busy = false
                    if (closed || activity.isDestroyed) return@launch
                    result.onSuccess { id -> onCreated(id); dialog.dismiss() }.onFailure {
                        dialog.setCancelable(true)
                        dialog.findViewById<android.view.View>(R.id.cancelButton)?.isEnabled = true
                        pick.isEnabled = true; clear.isEnabled = true; title.isEnabled = true; intro.isEnabled = true
                        PmMessage.error(activity, R.string.online_batch_create_failed)
                    }
                }.invokeOnCompletion { busy = false; if (closed || activity.isDestroyed) pending.delete() }
            }.show()
        val observer = object : androidx.lifecycle.DefaultLifecycleObserver {
            override fun onDestroy(owner: androidx.lifecycle.LifecycleOwner) { dialog.dismiss() }
        }
        activity.lifecycle.addObserver(observer)
        dialog.setOnDismissListener {
            closed = true
            activity.lifecycle.removeObserver(observer)
            launcher.unregister()
            if (!busy) pending.delete()
            onDismiss()
        }
    }
}
