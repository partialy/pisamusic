package cn.partialy.pm.directmessage

import android.app.Activity
import android.app.Dialog
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.SystemClock
import android.text.method.ScrollingMovementMethod
import android.view.Gravity
import android.view.Window
import android.view.WindowManager
import android.widget.LinearLayout
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import cn.partialy.pm.R
import cn.partialy.pm.databinding.DialogPmMinimalBinding
import kotlin.math.roundToInt

/** 使用 PmMinimalDialog 同一份布局和窗口风格，但保持专属消息的强制确认行为独立。 */
class DirectMessageDialog private constructor(
    private val activity: Activity,
    private val item: DirectMessageItem,
    private val unlockAt: Long,
    private val rules: DirectMessageQueueRules,
    private val onConfirmed: () -> Unit,
    private val onDismissedWithoutConfirmation: () -> Unit,
) {
    fun show(): Dialog {
        val dialog = Dialog(activity)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val binding = DialogPmMinimalBinding.inflate(dialog.layoutInflater)
        var confirmed = false

        bindContent(binding)
        binding.confirmButton.setOnClickListener {
            if (!rules.canConfirm(unlockAt, SystemClock.elapsedRealtime())) return@setOnClickListener
            confirmed = true
            dialog.dismiss()
            onConfirmed()
        }
        dialog.setOnDismissListener {
            if (!confirmed) onDismissedWithoutConfirmation()
        }

        dialog.setContentView(binding.root)
        dialog.setCancelable(false)
        dialog.setCanceledOnTouchOutside(false)
        dialog.window?.apply {
            setWindowAnimations(R.style.PmMinimalDialogAnimationStyle)
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            setDimAmount(0.32f)
            setLayout(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
        }
        dialog.show()
        scheduleUnlock(binding)
        return dialog
    }

    private fun bindContent(binding: DialogPmMinimalBinding) {
        binding.dialogTitle.isVisible = true
        binding.dialogTitle.setText(R.string.direct_message_title)
        binding.dialogMessage.apply {
            text = item.content
            gravity = Gravity.START
            setTextIsSelectable(true)
            maxHeight = 360.dp()
            movementMethod = ScrollingMovementMethod.getInstance()
            isVerticalScrollBarEnabled = true
        }
        binding.cancelButton.isVisible = false
        binding.verticalDivider.isVisible = false
        binding.confirmButton.apply {
            setText(R.string.dialog_i_know)
            setTextColor(ContextCompat.getColor(activity, R.color.pm_dialog_confirm))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT,
            )
        }
    }

    private fun scheduleUnlock(binding: DialogPmMinimalBinding) {
        fun refresh() {
            val remaining = rules.remainingMs(unlockAt, SystemClock.elapsedRealtime())
            binding.confirmButton.isEnabled = remaining == 0L
            binding.confirmButton.alpha = if (remaining == 0L) 1f else DISABLED_ALPHA
            if (remaining > 0L) {
                binding.confirmButton.postDelayed(::refresh, remaining)
            }
        }
        refresh()
    }

    private fun Int.dp(): Int =
        (this * activity.resources.displayMetrics.density).roundToInt()

    companion object {
        private const val DISABLED_ALPHA = 0.48f

        fun show(
            activity: Activity,
            item: DirectMessageItem,
            unlockAt: Long,
            rules: DirectMessageQueueRules,
            onConfirmed: () -> Unit,
            onDismissedWithoutConfirmation: () -> Unit,
        ): Dialog = DirectMessageDialog(
            activity = activity,
            item = item,
            unlockAt = unlockAt,
            rules = rules,
            onConfirmed = onConfirmed,
            onDismissedWithoutConfirmation = onDismissedWithoutConfirmation,
        ).show()
    }
}
