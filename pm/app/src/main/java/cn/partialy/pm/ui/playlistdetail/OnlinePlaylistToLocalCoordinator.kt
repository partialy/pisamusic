package cn.partialy.pm.ui.playlistdetail

import cn.partialy.pm.ui.message.PmMessage
import cn.partialy.pm.ui.message.PmMessageFlow
import android.app.Dialog
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import cn.partialy.pm.R
import cn.partialy.pm.activity.LocalPlaylistDetailActivity
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.model.CanonicalPlaylist
import cn.partialy.pm.model.SongInfo
import cn.partialy.pm.ui.dialog.PmMinimalDialog
import com.google.android.material.progressindicator.CircularProgressIndicator
import kotlinx.coroutines.launch

/** UI 只持有当前 Activity，加载与提交属于旋转保留的 ViewModel。 */
class OnlinePlaylistToLocalCoordinator(
    private val activity: BaseActivity,
    private val model: OnlinePlaylistToLocalViewModel,
) : DefaultLifecycleObserver {
    private var dialog: Dialog? = null
    private var displayedStage: PlaylistConversionStage? = null

    init {
        activity.lifecycle.addObserver(this)
        activity.lifecycleScope.launch {
            activity.repeatOnLifecycle(Lifecycle.State.STARTED) {
                model.state.collect(::render)
            }
        }
    }

    fun request(playlist: CanonicalPlaylist, initial: List<SongInfo>) = model.request(playlist, initial)

    override fun onStop(owner: LifecycleOwner) = dismiss()

    override fun onDestroy(owner: LifecycleOwner) {
        dismiss()
        activity.lifecycle.removeObserver(this)
    }

    private fun dismiss() {
        dialog?.setOnCancelListener(null)
        dialog?.dismiss()
        dialog = null
        displayedStage = null
    }

    private fun render(state: PlaylistConversionState) {
        when (state.stage) {
            PlaylistConversionStage.IDLE -> dismiss()
            PlaylistConversionStage.CONFIRMING -> if (displayedStage != state.stage) {
                dismiss()
                displayedStage = state.stage
                dialog = PmMinimalDialog.show(activity,
                    title = activity.getString(R.string.playlist_convert_action),
                    message = activity.getString(R.string.playlist_convert_confirm),
                    onCancel = model::cancel, onConfirm = model::confirm,
                ).also { it.setOnCancelListener { model.cancel() } }
            }
            PlaylistConversionStage.LOADING, PlaylistConversionStage.SAVING -> renderProgress(state)
            PlaylistConversionStage.SUCCESS, PlaylistConversionStage.FAILED -> {
                dismiss()
                val result = model.consumeResult() ?: return
                if (result.stage == PlaylistConversionStage.SUCCESS) {
                    PmMessageFlow.showSuccessThenNavigate(activity, activity.getString(R.string.playlist_convert_success,
                        result.songCount, result.skippedCount)) {
                        result.createdId?.let { LocalPlaylistDetailActivity.start(activity, it) }
                    }
                } else {
                    PmMessage.error(activity, activity.getString(R.string.playlist_convert_failed,
                        result.readCount, result.skippedCount), 3500)
                }
            }
        }
    }

    private fun renderProgress(state: PlaylistConversionState) {
        val saving = state.stage == PlaylistConversionStage.SAVING
        if (displayedStage != state.stage) {
            dismiss()
            displayedStage = state.stage
            dialog = PmMinimalDialog.show(activity,
                title = activity.getString(R.string.playlist_convert_action), message = "",
                singleButton = true, confirmText = activity.getString(if (saving)
                    R.string.playlist_convert_saving else R.string.cancel),
                cancelable = !saving, onConfirm = { if (!saving) model.cancel() },
            ).also { current ->
                current.setCanceledOnTouchOutside(false)
                current.setOnCancelListener { if (!saving) model.cancel() }
                current.findViewById<TextView>(R.id.confirmButton).isEnabled = !saving
                val container = current.findViewById<LinearLayout>(R.id.messageContainer)
                val size = (24 * activity.resources.displayMetrics.density).toInt()
                container.addView(CircularProgressIndicator(activity).apply {
                    isIndeterminate = true
                    indicatorSize = size
                }, 1, LinearLayout.LayoutParams(size, size).apply { topMargin = size / 2 })
            }
        }
        dialog?.findViewById<TextView>(R.id.dialogMessage)?.apply {
            isVisible = true
            text = activity.getString(if (saving) R.string.playlist_convert_saving_message
                else R.string.playlist_convert_progress, state.readCount, state.skippedCount)
        }
    }
}
