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
import cn.partialy.pm.model.SongType
import cn.partialy.pm.ui.widget.SongSourceTagBinder

/** 导入与管理歌单共用的来源筛选菜单。 */
object PlaylistSourceFilterPopup {
    fun show(
        anchor: View,
        selected: ThirdPartySourceFilter,
        counts: Map<ThirdPartySourceFilter, Int>,
        onSelected: (ThirdPartySourceFilter) -> Unit,
    ): PopupWindow {
        val context = anchor.context
        val inflater = LayoutInflater.from(context)
        val content = inflater.inflate(R.layout.layout_search_source_dropdown, null, false)
        val container = content.findViewById<LinearLayout>(R.id.searchSourceOptionsContainer)
        val popup = PopupWindow(
            content,
            anchor.width.coerceAtLeast((132 * context.resources.displayMetrics.density).toInt()),
            ViewGroup.LayoutParams.WRAP_CONTENT,
            true,
        ).apply {
            isOutsideTouchable = true
            elevation = 8 * context.resources.displayMetrics.density
        }
        ThirdPartySourceFilter.values().forEach { filter ->
            val row = inflater.inflate(R.layout.item_third_party_source_option, container, false)
            val tag = row.findViewById<TextView>(R.id.sourceOptionTag)
            when (filter) {
                ThirdPartySourceFilter.ALL -> tag.visibility = View.GONE
                ThirdPartySourceFilter.KG -> SongSourceTagBinder.bind(tag, SongType.KG)
                ThirdPartySourceFilter.WY -> SongSourceTagBinder.bind(tag, SongType.WY)
            }
            row.findViewById<TextView>(R.id.sourceOptionText).text = context.getString(
                R.string.third_party_import_source_option_format,
                context.getString(labelRes(filter)),
                counts[filter] ?: 0,
            )
            row.findViewById<ImageView>(R.id.sourceOptionCheck).visibility =
                if (selected == filter) View.VISIBLE else View.INVISIBLE
            row.setOnClickListener {
                popup.dismiss()
                onSelected(filter)
            }
            container.addView(row)
        }
        popup.showAsDropDown(anchor, 0, (6 * context.resources.displayMetrics.density).toInt(), Gravity.END)
        return popup
    }

    fun labelRes(filter: ThirdPartySourceFilter): Int = when (filter) {
        ThirdPartySourceFilter.ALL -> R.string.third_party_import_source_all
        ThirdPartySourceFilter.KG -> R.string.third_party_import_source_kg
        ThirdPartySourceFilter.WY -> R.string.third_party_import_source_wy
    }
}
