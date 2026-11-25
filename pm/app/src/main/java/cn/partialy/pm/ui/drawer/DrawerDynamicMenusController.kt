package cn.partialy.pm.ui.drawer

import android.app.Activity
import android.content.Intent
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Space
import android.widget.TextView
import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.core.content.ContextCompat
import androidx.core.view.isVisible
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.activity.AccountProfileActivity
import cn.partialy.pm.activity.AppActivityTransitions
import cn.partialy.pm.activity.DataSettingsActivity
import cn.partialy.pm.activity.DownloadSettingsActivity
import cn.partialy.pm.activity.FeedbackActivity
import cn.partialy.pm.activity.FullscreenWebContentActivity
import cn.partialy.pm.activity.LoginActivity
import cn.partialy.pm.activity.PlaybackSettingsActivity
import cn.partialy.pm.activity.SettingsActivity
import cn.partialy.pm.activity.WebContentActivity
import cn.partialy.pm.activity.setting.SettingAboutActivity
import cn.partialy.pm.activity.setting.SettingAnnouncementsActivity
import cn.partialy.pm.activity.setting.SettingCheckUpdateActivity
import cn.partialy.pm.databinding.ItemDrawerDynamicRowBinding
import cn.partialy.pm.databinding.ItemDrawerGridEntryBinding
import cn.partialy.pm.databinding.MainDrawerContentBinding
import cn.partialy.pm.model.SidebarBuiltinItemDto
import cn.partialy.pm.model.SidebarMenuItemDto
import cn.partialy.pm.network.auth.AccountSessionStore
import cn.partialy.pm.ui.dialog.AppShareBottomSheet
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * 渲染侧栏内置固定项配置、多区块动态横栏、四宫格入口，并处理网页与 App 原生页面跳转。
 */
class DrawerDynamicMenusController(
    private val activity: FragmentActivity,
    private val binding: MainDrawerContentBinding,
    private val repository: SidebarMenuRepository,
    private val closeDrawer: () -> Unit,
    private val openScan: () -> Unit,
    private val openDiscover: () -> Unit,
) {
    private var clickJob: Job? = null
    private var destroyed = false

    fun render(state: SidebarMenuUiState) {
        if (destroyed) return
        renderBuiltinItems(state)
        renderListSections(state)
        renderGridSection(state)
    }

    private fun renderBuiltinItems(state: SidebarMenuUiState) {
        applyBuiltinRow(
            rowView = binding.drawerImportPlaylistsRow,
            iconView = binding.drawerImportPlaylistsIcon,
            titleView = binding.drawerImportPlaylistsTitle,
            item = state.findBuiltin(SidebarBuiltinKeys.IMPORT_PLAYLISTS),
            defaultTitleResId = R.string.drawer_import_playlists,
            defaultIconResId = R.drawable.ic_login_24,
        )
        applyBuiltinRow(
            rowView = binding.drawerLinkImportRow,
            iconView = binding.drawerLinkImportIcon,
            titleView = binding.drawerLinkImportTitle,
            item = state.findBuiltin(SidebarBuiltinKeys.LINK_IMPORT),
            defaultTitleResId = R.string.drawer_link_import,
            defaultIconResId = R.drawable.ic_link_24,
        )
        applyBuiltinRow(
            rowView = binding.drawerSleepTimerRow,
            iconView = binding.drawerSleepTimerIcon,
            titleView = binding.drawerSleepTimerTitle,
            item = state.findBuiltin(SidebarBuiltinKeys.SLEEP_TIMER),
            defaultTitleResId = R.string.drawer_sleep_timer,
            defaultIconResId = R.drawable.ic_alarm_24,
        )
        applyBuiltinRow(
            rowView = binding.drawerThemeRow,
            iconView = binding.drawerThemeIcon,
            titleView = binding.drawerThemeTitle,
            item = state.findBuiltin(SidebarBuiltinKeys.THEME),
            defaultTitleResId = R.string.drawer_theme_appearance,
            defaultIconResId = R.drawable.ic_sider_theme_24,
        )
    }

    private fun applyBuiltinRow(
        rowView: View,
        iconView: ImageView,
        titleView: TextView,
        item: SidebarBuiltinItemDto,
        @StringRes defaultTitleResId: Int,
        @DrawableRes defaultIconResId: Int,
    ) {
        rowView.isVisible = item.enabled
        if (!item.enabled) return
        val displayName = item.name.trim().ifEmpty { activity.getString(defaultTitleResId) }
        titleView.text = displayName
        if (rowView !== binding.drawerThemeRow) {
            rowView.contentDescription = displayName
        }
        SidebarIconBinder.bindBuiltinIcon(iconView, item, defaultIconResId)
    }

    private fun renderListSections(state: SidebarMenuUiState) {
        val container = binding.drawerDynamicListSectionContainer
        container.removeAllViews()
        if (!state.hasListSections) {
            container.isVisible = false
            return
        }
        container.isVisible = true

        state.listSections.forEach { section ->
            if (!section.enabled || section.items.isEmpty()) return@forEach
            val sectionTitle = section.title.trim()
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

            section.items.forEach { item ->
                val row = ItemDrawerDynamicRowBinding.inflate(activity.layoutInflater, container, false)
                SidebarIconBinder.bindListIcon(row.itemIcon, item)
                row.itemTitle.text = item.name

                val showRedDot = state.shouldShowRedDot(item)
                val showSubtitleText =
                    item.badgeType == SidebarMenuUiState.BADGE_TEXT && item.subtitleText.isNotBlank()
                row.itemSubtitleText.isVisible = showSubtitleText && !showRedDot
                if (showSubtitleText) {
                    row.itemSubtitleText.text = item.subtitleText
                }
                row.itemRedDot.isVisible = showRedDot

                row.root.setOnClickListener { onItemClick(item) }
                container.addView(row.root)
            }
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
        if (item.openType == SidebarMenuUiState.OPEN_APP_ACTION && item.actionKey == ACTION_SCAN) {
            openScan()
            return
        }
        clickJob = activity.lifecycleScope.launch {
            closeDrawer()
            delay(DRAWER_CLOSE_DURATION_MS)
            if (destroyed || activity.isFinishing || activity.isDestroyed ||
                !activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
            ) {
                return@launch
            }
            when (item.openType) {
                SidebarMenuUiState.OPEN_APP_ACTION -> dispatchAppAction(item.actionKey)
                SidebarMenuUiState.OPEN_FULLSCREEN_WEB -> FullscreenWebContentActivity.start(activity, item.url)
                else -> WebContentActivity.start(activity, item.url, item.name)
            }
        }
    }

    private fun dispatchAppAction(actionKey: String) {
        when (actionKey) {
            "discover" -> openDiscover()
            "announcements" -> openActivity(SettingAnnouncementsActivity::class.java)
            "check_update" -> openActivity(SettingCheckUpdateActivity::class.java)
            "feedback" -> FeedbackActivity.start(activity)
            "settings" -> SettingsActivity.start(activity)
            "login" -> LoginActivity.start(activity)
            "profile" -> {
                if (AccountSessionStore.read(activity).loggedIn) {
                    AccountProfileActivity.start(activity)
                } else {
                    LoginActivity.start(activity)
                }
            }
            "about" -> openActivity(SettingAboutActivity::class.java)
            "share_app" -> AppShareBottomSheet.show(activity)
            "data_management" -> DataSettingsActivity.start(activity)
            "download_settings" -> DownloadSettingsActivity.start(activity)
            "playback_settings" -> PlaybackSettingsActivity.start(activity)
        }
    }

    private fun openActivity(page: Class<out Activity>) {
        activity.startActivity(Intent(activity, page))
        AppActivityTransitions.applyForward(activity)
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
        const val ACTION_SCAN = "scan"
    }
}
