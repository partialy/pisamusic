package cn.partialy.pm.ui.player

import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView

/** 两个固定 View 由页面控制器持有；绑定和切页都不会重建歌词或注册播放器监听。 */
internal class PlayerPagesAdapter(private val pages: List<View>) : RecyclerView.Adapter<PlayerPagesAdapter.Holder>() {
    class Holder(view: View) : RecyclerView.ViewHolder(view)
    override fun getItemCount() = pages.size
    override fun getItemViewType(position: Int) = position
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val page = pages[viewType]
        (page.parent as? ViewGroup)?.removeView(page)
        page.layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        return Holder(page)
    }
    override fun onBindViewHolder(holder: Holder, position: Int) = Unit
}
