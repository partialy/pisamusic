package cn.partialy.pm.ui.drawer

import android.view.View
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.Space
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.FullscreenWebContentActivity
import cn.partialy.pm.activity.WebContentActivity
import cn.partialy.pm.databinding.ItemDrawerDynamicRowBinding
import cn.partialy.pm.databinding.ItemDrawerGridEntryBinding
import cn.partialy.pm.databinding.MainDrawerContentBinding
import cn.partialy.pm.model.SidebarMenuItemDto
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * 渲染侧栏动态下发区域（现有列表底部分段横栏 + 顶部/底部九宫格），并处理点击跳转与一次性红点消除。
 */
class DrawerDynamicMenusController(
    private val activity: FragmentActivity,
    private val binding: MainDrawerContentBinding,
    private val repository: SidebarMenuRepository,
    private val closeDrawer: () -> Unit,
) {
    private var clickJob: Job? = null
    private var destroyed = false

    fun render(state: SidebarMenuUiState) {
        if (destroyed) return
        renderListSection(state)
        renderGridSection(state)
    }

    private fun renderListSection(state: SidebarMenuUiState) {
        val container = binding.drawerDynamicListSectionContainer
        container.removeAllViews()
        if (!state.hasListItems) {
            container.isVisible = false
            return
        }
        container.isVisible = true

        val sectionTitle = state.listSection.title.trim()
        if (sectionTitle.isNotEmpty()) {
            val header = TextView(activity).apply {
                text = sectionTitle
                textSize = 12f
                setTextColor(ContextCompat.getColor(activity, R.color.text_secondary))
                setPadding(dp(16), dp(4), dp(16), dp(4))
            }
            container.addView(header)
        } else {
            container.addView(createInsetDivider())
        }

        state.listSection.items.forEach { item ->
            val row = ItemDrawerDynamicRowBinding.inflate(activity.layoutInflater, container, false)
            SidebarIconBinder.bindListIcon(row.itemIcon, item)
            row.itemTitle.text = item.name

            val showRedDot = state.shouldShowRedDot(item)
            val showSubtitleText = item.badgeType == SidebarMenuUiState.BADGE_TEXT && item.subtitleText.isNotBlank()
            row.itemSubtitleText.isVisible = showSubtitleText && !showRedDot
            if (showSubtitleText) {
                row.itemSubtitleText.text = item.subtitleText
            }
            row.itemRedDot.isVisible = showRedDot

            row.root.setOnClickListener { onItemClick(item) }
            container.addView(row.root)
        }
    }

    private fun renderGridSection(state: SidebarMenuUiState) {
        val topCard = binding.drawerGridTopCard
        val topContainer = binding.drawerGridTopContainer
        val bottomCard = binding.drawerGridBottomCard
        val bottomContainer = binding.drawerGridBottomContainer

        topContainer.removeAllViews()
        bottomContainer.removeAllViews()
        topCard.isVisible = false
        bottomCard.isVisible = false

        if (!state.hasGridItems) return

        val isBottom = state.gridSection.position == "bottom"
        val targetCard = if (isBottom) bottomCard else topCard
        val targetContainer = if (isBottom) bottomContainer else topContainer
        targetCard.isVisible = true

        state.gridSection.items.chunked(4).forEach { rowItems ->
            val rowLayout = LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                )
            }
            rowItems.forEach { item ->
                val cell = ItemDrawerGridEntryBinding.inflate(activity.layoutInflater, rowLayout, false)
                SidebarIconBinder.bindGridIcon(cell.gridIcon, item)
                cell.gridTitle.text = item.name
                cell.gridRedDot.isVisible = state.shouldShowRedDot(item)
                cell.root.setOnClickListener { onItemClick(item) }
                rowLayout.addView(cell.root)
            }
            repeat(4 - rowItems.size) {
                val spacer = Space(activity).apply {
                    layoutParams = LinearLayout.LayoutParams(0, 1, 1f)
                }
                rowLayout.addView(spacer)
            }
            targetContainer.addView(rowLayout)
        }
    }

    private fun onItemClick(item: SidebarMenuItemDto) {
        if (destroyed || clickJob?.isActive == true) return
        repository.markItemClicked(item)
        clickJob = activity.lifecycleScope.launch {
            closeDrawer()
            delay(DRAWER_CLOSE_DURATION_MS)
            if (destroyed || activity.isFinishing || activity.isDestroyed ||
                !activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
            ) {
                return@launch
            }
            if (item.openType == OPEN_TYPE_FULLSCREEN_WEB) {
                FullscreenWebContentActivity.start(activity, item.url)
            } else {
                WebContentActivity.start(activity, item.url, item.name)
            }
        }
    }

    fun destroy() {
        destroyed = true
        clickJob?.cancel()
        clickJob = null
        binding.drawerDynamicListSectionContainer.removeAllViews()
        binding.drawerGridTopContainer.removeAllViews()
        binding.drawerGridBottomContainer.removeAllViews()
    }

    private fun createInsetDivider(): View {
        return View(activity).apply {
            setBackgroundColor(ContextCompat.getColor(activity, R.color.settings_card_inset_divider))
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)).apply {
                marginStart = dp(16)
                marginEnd = dp(16)
            }
        }
    }

    private fun dp(value: Int): Int = (activity.resources.displayMetrics.density * value).toInt()

    private companion object {
        const val DRAWER_CLOSE_DURATION_MS = 220L
        const val OPEN_TYPE_FULLSCREEN_WEB = "fullscreen_web"
    }
}
