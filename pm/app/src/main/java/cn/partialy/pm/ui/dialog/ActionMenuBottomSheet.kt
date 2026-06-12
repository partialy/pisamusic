package cn.partialy.pm.ui.dialog

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.annotation.ColorRes
import androidx.annotation.DrawableRes
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import cn.partialy.pm.R
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.color.MaterialColors
import kotlin.math.roundToInt

data class ActionMenuItem(
    @DrawableRes val iconRes: Int,
    val text: CharSequence,
    @ColorRes val colorRes: Int? = null,
    val onClick: () -> Unit,
)

/**
 * 带信息头部的通用操作菜单。操作统一在 Sheet 完全关闭后执行，避免连续弹层重叠。
 */
object ActionMenuBottomSheet {

    fun show(
        activity: FragmentActivity,
        items: List<ActionMenuItem>,
        bindHeader: (View) -> Unit,
        maxHeightFraction: Float = 0.72f,
        onDismiss: () -> Unit = {},
    ): BottomSheetDialog {
        val dialog = BottomSheetDialog(
            activity,
            com.google.android.material.R.style.ThemeOverlay_Material3_BottomSheetDialog,
        )
        val root = LayoutInflater.from(activity).inflate(
            R.layout.layout_action_menu_bottom_sheet,
            null,
        )
        bindHeader(root)

        var selectedAction: (() -> Unit)? = null
        root.findViewById<ImageButton>(R.id.actionMenuCloseButton).setOnClickListener {
            dialog.dismiss()
        }
        val container = root.findViewById<LinearLayout>(R.id.actionMenuItemsContainer)
        items.forEach { item ->
            val row = LayoutInflater.from(activity).inflate(
                R.layout.item_action_menu_row,
                container,
                false,
            )
            val icon = row.findViewById<ImageView>(R.id.actionMenuItemIcon)
            val text = row.findViewById<TextView>(R.id.actionMenuItemText)
            val color = item.colorRes?.let { ContextCompat.getColor(activity, it) }
                ?: MaterialColors.getColor(
                    root,
                    com.google.android.material.R.attr.colorOnSurface,
                )
            icon.setImageResource(item.iconRes)
            icon.setColorFilter(color)
            text.text = item.text
            text.setTextColor(color)
            row.setOnClickListener {
                selectedAction = item.onClick
                dialog.dismiss()
            }
            container.addView(row)
        }

        dialog.setContentView(root)
        dialog.setOnShowListener {
            val bottomSheet = dialog.findViewById<View>(
                com.google.android.material.R.id.design_bottom_sheet,
            ) ?: return@setOnShowListener
            val maxHeight = (
                dialog.context.resources.displayMetrics.heightPixels * maxHeightFraction
                ).roundToInt()
            BottomSheetBehavior.from(bottomSheet as ViewGroup).apply {
                skipCollapsed = true
                this.maxHeight = maxHeight
                state = BottomSheetBehavior.STATE_EXPANDED
            }
        }
        dialog.setOnDismissListener {
            val action = selectedAction
            selectedAction = null
            onDismiss()
            action?.invoke()
        }
        dialog.show()
        return dialog
    }
}
