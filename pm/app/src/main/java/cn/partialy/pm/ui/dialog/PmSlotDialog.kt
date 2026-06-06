package cn.partialy.pm.ui.dialog

import android.app.Dialog
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.view.WindowManager
import android.widget.LinearLayout
import androidx.annotation.ColorInt
import androidx.annotation.LayoutRes
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import cn.partialy.pm.R
import cn.partialy.pm.databinding.DialogPmSlotBinding

class PmSlotDialog private constructor(
    private val context: Context,
    private val config: Config,
) {
    fun show(): Dialog {
        val dialog = Dialog(context)
        dialog.requestWindowFeature(Window.FEATURE_NO_TITLE)
        val binding = DialogPmSlotBinding.inflate(dialog.layoutInflater)
        bindContent(binding, dialog)
        dialog.setContentView(binding.root)
        dialog.window?.setWindowAnimations(R.style.PmMinimalDialogAnimationStyle)
        dialog.setCancelable(config.cancelable)
        dialog.setOnShowListener {
            dialog.window?.apply {
                setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
                setDimAmount(0.32f)
                setLayout(WindowManager.LayoutParams.WRAP_CONTENT, WindowManager.LayoutParams.WRAP_CONTENT)
            }
        }
        dialog.show()
        return dialog
    }

    private fun bindContent(binding: DialogPmSlotBinding, dialog: Dialog) {
        val slotView = when {
            config.contentView != null -> config.contentView
            config.contentLayoutRes != null -> dialog.layoutInflater.inflate(
                config.contentLayoutRes,
                binding.slotContainer,
                false,
            )
            else -> null
        }

        slotView?.let { view ->
            (view.parent as? ViewGroup)?.removeView(view)
            binding.slotContainer.addView(view)
            config.onBind?.invoke(view, dialog)
        }

        binding.cancelButton.text = config.cancelText
        binding.confirmButton.text = config.confirmText
        binding.cancelButton.setTextColor(
            config.cancelColor ?: ContextCompat.getColor(context, R.color.pm_dialog_cancel),
        )
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
            config.onCancel?.invoke(dialog)
            dialog.dismiss()
        }
        binding.confirmButton.setOnClickListener {
            config.onConfirm?.invoke(dialog)
            if (config.dismissOnConfirm) {
                dialog.dismiss()
            }
        }
    }

    data class Config(
        @LayoutRes val contentLayoutRes: Int? = null,
        val contentView: View? = null,
        val onBind: ((View, Dialog) -> Unit)? = null,
        val cancelText: String = "取消",
        val confirmText: String = "确认",
        @ColorInt val cancelColor: Int? = null,
        @ColorInt val confirmColor: Int? = null,
        val singleButton: Boolean = false,
        val cancelable: Boolean = true,
        val dismissOnConfirm: Boolean = true,
        val onCancel: ((Dialog) -> Unit)? = null,
        val onConfirm: ((Dialog) -> Unit)? = null,
    )

    class Builder(private val context: Context) {
        @LayoutRes private var contentLayoutRes: Int? = null
        private var contentView: View? = null
        private var onBind: ((View, Dialog) -> Unit)? = null
        private var cancelText: String = "取消"
        private var confirmText: String = "确认"
        @ColorInt private var cancelColor: Int? = null
        @ColorInt private var confirmColor: Int? = null
        private var singleButton: Boolean = false
        private var cancelable: Boolean = true
        private var dismissOnConfirm: Boolean = true
        private var onCancel: ((Dialog) -> Unit)? = null
        private var onConfirm: ((Dialog) -> Unit)? = null

        fun setContentLayout(
            @LayoutRes layoutRes: Int,
            onBind: ((View, Dialog) -> Unit)? = null,
        ) = apply {
            contentLayoutRes = layoutRes
            contentView = null
            this.onBind = onBind
        }

        fun setContentView(
            view: View,
            onBind: ((View, Dialog) -> Unit)? = null,
        ) = apply {
            contentView = view
            contentLayoutRes = null
            this.onBind = onBind
        }

        fun setCancelButton(
            text: String = "取消",
            @ColorInt textColor: Int? = null,
            action: ((Dialog) -> Unit)? = null,
        ) = apply {
            cancelText = text
            cancelColor = textColor
            onCancel = action
            singleButton = false
        }

        fun setConfirmButton(
            text: String = "确认",
            @ColorInt textColor: Int? = null,
            dismissOnConfirm: Boolean = true,
            action: ((Dialog) -> Unit)? = null,
        ) = apply {
            confirmText = text
            confirmColor = textColor
            this.dismissOnConfirm = dismissOnConfirm
            onConfirm = action
        }

        fun setSingleButton(
            text: String = "确认",
            @ColorInt textColor: Int? = null,
            dismissOnConfirm: Boolean = true,
            action: ((Dialog) -> Unit)? = null,
        ) = apply {
            confirmText = text
            confirmColor = textColor
            this.dismissOnConfirm = dismissOnConfirm
            onConfirm = action
            singleButton = true
        }

        fun setCancelable(value: Boolean) = apply { cancelable = value }

        fun show(): Dialog = PmSlotDialog(context, build()).show()

        private fun build(): Config = Config(
            contentLayoutRes = contentLayoutRes,
            contentView = contentView,
            onBind = onBind,
            cancelText = cancelText,
            confirmText = confirmText,
            cancelColor = cancelColor,
            confirmColor = confirmColor,
            singleButton = singleButton,
            cancelable = cancelable,
            dismissOnConfirm = dismissOnConfirm,
            onCancel = onCancel,
            onConfirm = onConfirm,
        )
    }

    companion object {
        fun show(
            context: Context,
            @LayoutRes contentLayoutRes: Int,
            cancelText: String = "取消",
            confirmText: String = "确认",
            @ColorInt cancelColor: Int? = null,
            @ColorInt confirmColor: Int? = null,
            singleButton: Boolean = false,
            cancelable: Boolean = true,
            dismissOnConfirm: Boolean = true,
            onBind: ((View, Dialog) -> Unit)? = null,
            onCancel: ((Dialog) -> Unit)? = null,
            onConfirm: ((Dialog) -> Unit)? = null,
        ): Dialog {
            return PmSlotDialog(
                context,
                Config(
                    contentLayoutRes = contentLayoutRes,
                    cancelText = cancelText,
                    confirmText = confirmText,
                    cancelColor = cancelColor,
                    confirmColor = confirmColor,
                    singleButton = singleButton,
                    cancelable = cancelable,
                    dismissOnConfirm = dismissOnConfirm,
                    onBind = onBind,
                    onCancel = onCancel,
                    onConfirm = onConfirm,
                ),
            ).show()
        }
    }
}
