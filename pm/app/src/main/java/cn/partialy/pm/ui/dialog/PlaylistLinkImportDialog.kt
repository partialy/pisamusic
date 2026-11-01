package cn.partialy.pm.ui.dialog

import android.app.Dialog
import android.content.ClipboardManager
import android.content.Context
import android.view.LayoutInflater
import android.view.WindowManager
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.WyPlaylistDetailActivity
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.DialogPlaylistLinkImportBinding
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.utils.playlistUtil.PlaylistShareLinkParser
import cn.partialy.pm.utils.playlistUtil.PlaylistShareLinkResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

/** 只解析并打开在线歌单，不写入收藏或本地歌单。 */
object PlaylistLinkImportDialog {
    fun show(activity: BaseActivity, repository: WyCookieRepository) {
        val binding = DialogPlaylistLinkImportBinding.inflate(LayoutInflater.from(activity))
        var request: Job? = null
        var busy = false
        var closed = false
        fun message(resId: Int) {
            binding.linkInputLayout.error = activity.getString(resId)
        }
        binding.linkInput.doAfterTextChanged { binding.linkInputLayout.error = null }
        fun setBusy(dialog: Dialog, value: Boolean) {
            busy = value
            binding.linkInputLayout.isEnabled = !value
            binding.linkLoading.isVisible = value
            dialog.findViewById<TextView>(R.id.confirmButton)?.apply {
                isEnabled = !value
                setText(if (value) R.string.playlist_link_loading else R.string.playlist_link_open)
            }
        }
        binding.linkInputLayout.setEndIconOnClickListener {
            if (busy) return@setEndIconOnClickListener
            val clipboard = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            // 只读取用户主动点击时的最新一项文本，不把 URI 强制转换成文本。
            val text = runCatching {
                clipboard.primaryClip?.takeIf { it.itemCount > 0 }?.getItemAt(0)?.text
            }.getOrNull()
            if (text.isNullOrBlank()) {
                message(R.string.playlist_link_clipboard_empty)
            } else {
                binding.linkInput.setText(text)
                binding.linkInput.setSelection(binding.linkInput.text?.length ?: 0)
            }
        }
        val dialog = PmSlotDialog.Builder(activity)
            .setHeaderLayout(R.layout.dialog_pm_title_header) { view, _ ->
                view.findViewById<TextView>(R.id.dialogTitleText).setText(R.string.drawer_link_import)
            }
            .setContentView(binding.root)
            .setCancelButton(activity.getString(R.string.cancel))
            .setConfirmButton(activity.getString(R.string.playlist_link_open), dismissOnConfirm = false) { dialog ->
                if (busy) return@setConfirmButton
                val parsed = PlaylistShareLinkParser.parse(binding.linkInput.text.toString())
                val id = when (parsed) {
                    is PlaylistShareLinkResult.Netease -> parsed.playlistId
                    PlaylistShareLinkResult.UnsupportedKugou -> {
                        message(R.string.playlist_link_kugou_unsupported)
                        return@setConfirmButton
                    }
                    PlaylistShareLinkResult.Invalid -> {
                        message(R.string.playlist_link_invalid)
                        return@setConfirmButton
                    }
                }
                binding.linkInputLayout.error = null
                setBusy(dialog, true)
                request = activity.lifecycleScope.launch {
                    try {
                        val metadata = withTimeout(30_000) { repository.getPlaylistMetadata(id).getOrThrow() }
                        if (closed || activity.isFinishing || activity.isDestroyed) return@launch
                        WyPlaylistDetailActivity.start(activity, id, metadata.name.orEmpty(),
                            metadata.coverImgUrl.orEmpty(), "", metadata.trackCount?.coerceAtLeast(0) ?: 0,
                            CollectedPlaylistType.WY)
                        dialog.dismiss()
                    } catch (error: kotlinx.coroutines.TimeoutCancellationException) {
                        if (!closed) message(R.string.playlist_link_failed)
                    } catch (error: CancellationException) {
                        throw error
                    } catch (error: Exception) {
                        if (!closed) message(R.string.playlist_link_failed)
                    } finally {
                        if (!closed) setBusy(dialog, false)
                    }
                }
            }.show()
        dialog.window?.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN)
        binding.root.requestFocus()
        val observer = object : DefaultLifecycleObserver {
            override fun onDestroy(owner: LifecycleOwner) { dialog.dismiss() }
        }
        activity.lifecycle.addObserver(observer)
        dialog.setOnDismissListener {
            closed = true
            request?.cancel()
            activity.lifecycle.removeObserver(observer)
        }
    }
}
