package cn.partialy.pm.ui.dialog

import android.app.Dialog
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.text.method.ScrollingMovementMethod
import android.view.Gravity
import android.view.View
import android.view.Window
import android.view.WindowManager
import android.widget.LinearLayout
import androidx.annotation.ColorInt
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import cn.partialy.pm.R
import cn.partialy.pm.databinding.DialogPmMinimalBinding
import kotlin.math.roundToInt

class PmMinimalDialog private constructor(
    private val context: Context,
    private val config: Config,
) {
    fun show(): Dialog {
        val dialog = Dialog(context)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val binding = DialogPmMinimalBinding.inflate(dialog.layoutInflater)
        bindContent(binding, dialog)
        dialog.setContentView(binding.root)
        dialog.window?.apply {
            setWindowAnimations(R.style.PmMinimalDialogAnimationStyle)
            setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
            setDimAmount(0.32f)
            setLayout(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
        }
        dialog.setCancelable(config.cancelable)
        dialog.show()
        return dialog
    }

    private fun bindContent(binding: DialogPmMinimalBinding, dialog: Dialog) {
        val title = config.title?.trim().orEmpty()
        binding.dialogTitle.isVisible = title.isNotBlank()
        if (title.isNotBlank()) {
            binding.dialogTitle.text = title
            binding.dialogMessage.textSize = 14f
            binding.dialogMessage.typeface = Typeface.DEFAULT
        } else {
            binding.dialogMessage.textSize = 16f
            binding.dialogMessage.typeface = Typeface.DEFAULT_BOLD
            (binding.dialogMessage.layoutParams as LinearLayout.LayoutParams).apply {
                topMargin = 0
                binding.dialogMessage.layoutParams = this
            }
        }
        binding.dialogMessage.text = config.message
        binding.dialogMessage.gravity = config.messageGravity
        binding.dialogMessage.setTextIsSelectable(config.messageSelectable)
        binding.dialogMessage.isVerticalScrollBarEnabled = config.messageMaxHeightDp != null
        if (config.messageMaxHeightDp != null) {
            binding.dialogMessage.maxHeight = config.messageMaxHeightDp.dp()
            binding.dialogMessage.movementMethod = ScrollingMovementMethod.getInstance()
        }

        binding.cancelButton.text = config.cancelText
        binding.confirmButton.text = config.confirmText
        binding.confirmButton.setTextColor(
            config.confirmColor ?: ContextCompat.getColor(context, R.color.pm_dialog_confirm),
        )

        binding.cancelButton.isVisible = !config.singleButton
        binding.verticalDivider.isVisible = !config.singleButton
        if (config.singleButton) {
            binding.confirmButton.layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.MATCH_PARENT,
            )
        }

        binding.cancelButton.setOnClickListener {
            config.onCancel?.invoke()
            if (config.dismissOnCancel) dialog.dismiss()
        }
        binding.confirmButton.setOnClickListener {
            config.onConfirm?.invoke()
            if (config.dismissOnConfirm) dialog.dismiss()
        }
    }

    private fun Int.dp(): Int =
        (this * context.resources.displayMetrics.density).roundToInt()

    data class Config(
        val title: String? = null,
        val message: String,
        val cancelText: String = "取消",
        val confirmText: String = "确认",
        @ColorInt val confirmColor: Int? = null,
        val messageGravity: Int = Gravity.CENTER,
        val messageSelectable: Boolean = false,
        val messageMaxHeightDp: Int? = null,
        val singleButton: Boolean = false,
        val cancelable: Boolean = true,
        val dismissOnCancel: Boolean = true,
        val dismissOnConfirm: Boolean = true,
        val onCancel: (() -> Unit)? = null,
        val onConfirm: (() -> Unit)? = null,
    )

    class Builder(private val context: Context) {
        private var title: String? = null
        private var message: String = ""
        private var cancelText: String = "取消"
        private var confirmText: String = "确认"
        @ColorInt private var confirmColor: Int? = null
        private var messageGravity: Int = Gravity.CENTER
        private var messageSelectable: Boolean = false
        private var messageMaxHeightDp: Int? = null
        private var singleButton: Boolean = false
        private var cancelable: Boolean = true
        private var dismissOnCancel: Boolean = true
        private var dismissOnConfirm: Boolean = true
        private var onCancel: (() -> Unit)? = null
        private var onConfirm: (() -> Unit)? = null

        fun setTitle(value: String?) = apply { title = value }
        fun setMessage(value: String) = apply { message = value }
        fun setCancelButton(text: String = "取消", action: (() -> Unit)? = null) = apply {
            cancelText = text
            onCancel = action
            singleButton = false
        }
        fun setConfirmButton(
            text: String = "确认",
            @ColorInt textColor: Int? = null,
            action: (() -> Unit)? = null,
        ) = apply {
            confirmText = text
            confirmColor = textColor
            onConfirm = action
        }
        fun setMessageGravity(value: Int) = apply { messageGravity = value }
        fun setMessageSelectable(value: Boolean) = apply { messageSelectable = value }
        fun setMessageMaxHeightDp(value: Int?) = apply { messageMaxHeightDp = value }
        fun setDismissOnCancel(value: Boolean) = apply { dismissOnCancel = value }
        fun setDismissOnConfirm(value: Boolean) = apply { dismissOnConfirm = value }

        fun setSingleButton(
            text: String = "确认",
            @ColorInt textColor: Int? = null,
            action: (() -> Unit)? = null,
        ) = apply {
            confirmText = text
            confirmColor = textColor
            onConfirm = action
            singleButton = true
        }
        fun setCancelable(value: Boolean) = apply { cancelable = value }

        fun show(): Dialog = PmMinimalDialog(context, build()).show()

        private fun build(): Config = Config(
            title = title,
            message = message,
            cancelText = cancelText,
            confirmText = confirmText,
            confirmColor = confirmColor,
            messageGravity = messageGravity,
            messageSelectable = messageSelectable,
            messageMaxHeightDp = messageMaxHeightDp,
            singleButton = singleButton,
            cancelable = cancelable,
            dismissOnCancel = dismissOnCancel,
            dismissOnConfirm = dismissOnConfirm,
            onCancel = onCancel,
            onConfirm = onConfirm,
        )
    }

    companion object {
        fun show(
            context: Context,
            title: String? = null,
            message: String,
            cancelText: String = "取消",
            confirmText: String = "确认",
            @ColorInt confirmColor: Int? = null,
            messageGravity: Int = Gravity.CENTER,
            messageSelectable: Boolean = false,
            messageMaxHeightDp: Int? = null,
            singleButton: Boolean = false,
            cancelable: Boolean = true,
            dismissOnCancel: Boolean = true,
            dismissOnConfirm: Boolean = true,
            onCancel: (() -> Unit)? = null,
            onConfirm: (() -> Unit)? = null,
        ): Dialog {
            return PmMinimalDialog(
                context,
                Config(
                    title = title,
                    message = message,
                    cancelText = cancelText,
                    confirmText = confirmText,
                    confirmColor = confirmColor,
                    messageGravity = messageGravity,
                    messageSelectable = messageSelectable,
                    messageMaxHeightDp = messageMaxHeightDp,
                    singleButton = singleButton,
                    cancelable = cancelable,
                    dismissOnCancel = dismissOnCancel,
                    dismissOnConfirm = dismissOnConfirm,
                    onCancel = onCancel,
                    onConfirm = onConfirm,
                ),
            ).show()
        }
    }
}
