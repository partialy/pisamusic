package cn.partialy.pm.ui.dialog

import android.animation.ValueAnimator
import android.app.Dialog
import android.content.ClipboardManager
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.text.SpannableString
import android.text.Spanned
import android.text.style.ImageSpan
import android.view.Gravity
import android.view.LayoutInflater
import android.view.WindowManager
import android.view.animation.LinearInterpolator
import android.widget.TextView
import androidx.appcompat.content.res.AppCompatResources
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.DrawableCompat
import androidx.core.widget.doAfterTextChanged
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.WyPlaylistDetailActivity
import cn.partialy.pm.activity.PlaylistDetailActivity
import cn.partialy.pm.activity.base.BaseActivity
import cn.partialy.pm.databinding.DialogPlaylistLinkImportBinding
import cn.partialy.pm.model.CollectedPlaylistType
import cn.partialy.pm.network.cookie.WyCookieRepository
import cn.partialy.pm.network.repository.KgRepository
import cn.partialy.pm.utils.playlistUtil.PlaylistShareLinkParser
import cn.partialy.pm.utils.playlistUtil.PlaylistShareLinkResult
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

/** 只解析并打开在线歌单，不写入收藏或本地歌单。 */
object PlaylistLinkImportDialog {
    fun show(activity: BaseActivity, repository: WyCookieRepository, kgRepository: KgRepository) {
        val binding = DialogPlaylistLinkImportBinding.inflate(LayoutInflater.from(activity))
        var request: Job? = null
        var busy = false
        var closed = false
        var loadingAnimation: ValueAnimator? = null
        fun message(resId: Int) {
            binding.linkInputLayout.error = activity.getString(resId)
        }
        binding.linkInput.doAfterTextChanged { binding.linkInputLayout.error = null }
        fun setBusy(dialog: Dialog, value: Boolean) {
            busy = value
            binding.linkInputLayout.isEnabled = !value
            loadingAnimation?.cancel()
            loadingAnimation = null
            dialog.findViewById<TextView>(R.id.confirmButton)?.apply {
                isEnabled = !value
                alpha = if (value) 0.65f else 1f
                if (value) {
                    loadingAnimation = startConfirmLoading(activity, this)
                } else {
                    setText(R.string.playlist_link_open)
                }
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
                view.findViewById<TextView>(R.id.dialogTitleText).apply {
                    setText(R.string.playlist_link_input_title)
                    gravity = Gravity.CENTER
                }
            }
            .setContentView(binding.root)
            .setCancelButton(activity.getString(R.string.cancel))
            .setConfirmButton(activity.getString(R.string.playlist_link_open), dismissOnConfirm = false) { dialog ->
                if (busy) return@setConfirmButton
                val parsed = PlaylistShareLinkParser.parse(binding.linkInput.text.toString())
                if (parsed == PlaylistShareLinkResult.Invalid) {
                    message(R.string.playlist_link_invalid)
                    return@setConfirmButton
                }
                binding.linkInputLayout.error = null
                setBusy(dialog, true)
                request = activity.lifecycleScope.launch {
                    try {
                        // 请求只准备导航动作；确认弹窗仍存活后才执行，防止取消后的迟到跳转。
                        val openPlaylist: () -> Unit = withTimeout(30_000) {
                            when (parsed) {
                                is PlaylistShareLinkResult.Netease -> {
                                    val metadata = repository.getPlaylistMetadata(parsed.playlistId).getOrThrow()
                                    val open: () -> Unit = {
                                        WyPlaylistDetailActivity.start(activity, parsed.playlistId, metadata.name.orEmpty(),
                                            metadata.coverImgUrl.orEmpty(), "", metadata.trackCount?.coerceAtLeast(0) ?: 0,
                                            CollectedPlaylistType.WY)
                                    }
                                    open
                                }
                                is PlaylistShareLinkResult.Kugou -> {
                                    val metadata = kgRepository.getPlaylistMetadata(parsed.playlistId).getOrThrow()
                                    val open: () -> Unit = {
                                        PlaylistDetailActivity.start(activity, parsed.playlistId, metadata.name,
                                            metadata.pic, metadata.intro.ifBlank { metadata.tags }, metadata.count.coerceAtLeast(0))
                                    }
                                    open
                                }
                                PlaylistShareLinkResult.Invalid -> error("无效歌单链接")
                            }
                        }
                        if (closed || activity.isFinishing || activity.isDestroyed) return@launch
                        openPlaylist()
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
            loadingAnimation?.cancel()
            request?.cancel()
            activity.lifecycle.removeObserver(observer)
        }
    }

    /** 将旋转图标作为文字的一部分绘制，使“转圈 + 解析中”整体居于按钮中央。 */
    private fun startConfirmLoading(activity: BaseActivity, button: TextView): ValueAnimator? {
        val icon = AppCompatResources.getDrawable(activity, R.drawable.ic_loading_loop_24)?.mutate()
        if (icon == null) {
            button.setText(R.string.playlist_link_loading)
            return null
        }
        DrawableCompat.setTint(icon, ContextCompat.getColor(activity, R.color.pm_dialog_confirm))
        val iconSize = (16f * activity.resources.displayMetrics.density).toInt().coerceAtLeast(1)
        icon.setBounds(0, 0, iconSize, iconSize)

        val spinner = object : ImageSpan(icon, ImageSpan.ALIGN_BOTTOM) {
            var rotationDegrees = 0f

            override fun draw(
                canvas: Canvas,
                text: CharSequence,
                start: Int,
                end: Int,
                x: Float,
                top: Int,
                y: Int,
                bottom: Int,
                paint: Paint,
            ) {
                val saved = canvas.save()
                canvas.rotate(rotationDegrees, x + iconSize / 2f, bottom - iconSize / 2f)
                super.draw(canvas, text, start, end, x, top, y, bottom, paint)
                canvas.restoreToCount(saved)
            }
        }
        val label = SpannableString("\uFFFC  ${activity.getString(R.string.playlist_link_loading)}")
        label.setSpan(spinner, 0, 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
        button.text = label
        return ValueAnimator.ofFloat(0f, 360f).apply {
            duration = 900L
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            addUpdateListener {
                spinner.rotationDegrees = it.animatedValue as Float
                button.invalidate()
            }
            start()
        }
    }
}
