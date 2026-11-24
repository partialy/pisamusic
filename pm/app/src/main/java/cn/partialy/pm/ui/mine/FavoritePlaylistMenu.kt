package cn.partialy.pm.ui.mine

import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupWindow
import android.widget.TextView
import cn.partialy.pm.R

/** 收藏歌单列表的紧凑菜单；先关闭弹层，再交由宿主导航。 */
internal class FavoritePlaylistMenu(
    private val anchor: View,
    private val onSearch: () -> Unit,
    private val onMultiSelect: () -> Unit,
    private val onImport: () -> Unit,
) {
    private var popup: PopupWindow? = null

    fun show() {
        dismiss()
        val inflater = LayoutInflater.from(anchor.context)
        val content = inflater.inflate(R.layout.layout_search_source_dropdown, null, false)
        val container = content.findViewById<LinearLayout>(R.id.searchSourceOptionsContainer)
        val window = PopupWindow(content, 0, ViewGroup.LayoutParams.WRAP_CONTENT, true).apply {
            isOutsideTouchable = true
            elevation = dp(8).toFloat()
        }
        val actions = listOf(
            Triple(R.drawable.ic_search_24, R.string.search, onSearch),
            Triple(R.drawable.ic_list_check_24, R.string.favorite_playlists_multi_select, onMultiSelect),
            Triple(R.drawable.ic_add_24, R.string.third_party_import_action, onImport),
        )
        actions.forEach { (icon, title, action) ->
            val row = inflater.inflate(R.layout.item_compact_action_menu_row, container, false)
            row.findViewById<ImageView>(R.id.actionMenuItemIcon).setImageResource(icon)
            row.findViewById<TextView>(R.id.actionMenuItemText).setText(title)
            row.setOnClickListener {
                window.dismiss()
                action()
            }
            container.addView(row)
        }
        content.measure(
            View.MeasureSpec.makeMeasureSpec(anchor.resources.displayMetrics.widthPixels - dp(32), View.MeasureSpec.AT_MOST),
            View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED),
        )
        window.width = content.measuredWidth.coerceAtLeast(dp(160))
        window.setOnDismissListener { if (popup === window) popup = null }
        popup = window
        window.showAsDropDown(anchor, 0, dp(6), Gravity.END)
    }

    fun dismiss() {
        popup?.dismiss()
        popup = null
    }

    private fun dp(value: Int): Int = (anchor.resources.displayMetrics.density * value).toInt()
}
