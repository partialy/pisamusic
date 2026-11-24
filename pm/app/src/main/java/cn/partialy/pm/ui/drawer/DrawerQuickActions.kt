package cn.partialy.pm.ui.drawer

import android.content.Intent
import android.view.ViewGroup
import android.view.View
import androidx.core.content.ContextCompat
import android.widget.LinearLayout
import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.view.isVisible
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.BuildConfig
import cn.partialy.pm.R
import cn.partialy.pm.activity.AppActivityTransitions
import cn.partialy.pm.activity.FeedbackActivity
import cn.partialy.pm.activity.setting.SettingAnnouncementsActivity
import cn.partialy.pm.activity.setting.SettingCheckUpdateActivity
import cn.partialy.pm.databinding.ItemDrawerQuickActionBinding
import cn.partialy.pm.ui.dialog.SettingsOption
import cn.partialy.pm.ui.dialog.showSettingsOptionPicker
import cn.partialy.pm.utils.SettingsPrefs
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** 侧栏快捷入口与主题选择，页面跳转及弹层均等待侧栏收起。 */
class DrawerQuickActions(
    private val activity: FragmentActivity,
    private val closeDrawer: () -> Unit,
) {
    private val rows = mutableListOf<ItemDrawerQuickActionBinding>()
    private val dividers = mutableListOf<View>()
    private var themeRow: ItemDrawerQuickActionBinding? = null
    private var updateRow: ItemDrawerQuickActionBinding? = null
    private var actionJob: Job? = null
    private var destroyed = false

    fun bind(container: LinearLayout) {
        if (destroyed) return
        clearRows()
        themeRow = addRow(container, R.drawable.ic_sider_theme_24, R.string.drawer_theme_appearance) {
            showThemePicker()
        }
        addRow(container, R.drawable.ic_sider_feedback_24, R.string.feedback_title) {
            FeedbackActivity.start(activity)
        }
        addRow(container, R.drawable.ic_sider_announcement_24, R.string.announcement_system_title) {
            openPage(SettingAnnouncementsActivity::class.java)
        }
        updateRow = addRow(container, R.drawable.ic_sider_update_24, R.string.check_update) {
            openPage(SettingCheckUpdateActivity::class.java)
        }
        refresh()
    }

    fun refresh() {
        if (destroyed) return
        val mode = SettingsPrefs.getThemeMode(activity)
        val (icon, description) = when (mode) {
            SettingsPrefs.ThemeMode.Light -> R.drawable.ic_sider_sun_24 to R.string.settings_theme_light
            SettingsPrefs.ThemeMode.Dark -> R.drawable.ic_sider_moon_24 to R.string.settings_theme_dark
            SettingsPrefs.ThemeMode.System -> R.drawable.ic_sider_theme_auto_24 to R.string.settings_theme_system
        }
        themeRow?.apply {
            modeIcon.setImageResource(icon)
            modeIcon.isVisible = true
            root.contentDescription = "${activity.getString(R.string.drawer_theme_appearance)}，${activity.getString(description)}"
        }
        updateRow?.apply {
            actionValue.text = BuildConfig.VERSION_NAME
            actionValue.isVisible = true
        }
    }

    fun destroy() {
        destroyed = true
        // 通用选择器在协程取消时自动 dismiss，不保留宿主已销毁的 Dialog。
        actionJob?.cancel()
        actionJob = null
        clearRows()
    }

    private fun addRow(
        container: LinearLayout,
        @DrawableRes icon: Int,
        @StringRes title: Int,
        action: suspend () -> Unit,
    ): ItemDrawerQuickActionBinding {
        val divider = View(activity).apply {
            setBackgroundColor(ContextCompat.getColor(activity, R.color.settings_card_inset_divider))
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(1)).apply {
                marginStart = dp(16)
                marginEnd = dp(16)
            }
        }
        container.addView(divider)
        dividers += divider
        val row = ItemDrawerQuickActionBinding.inflate(activity.layoutInflater, container, false)
        row.actionIcon.setImageResource(icon)
        row.actionTitle.setText(title)
        row.root.setOnClickListener {
            if (destroyed || actionJob?.isActive == true) return@setOnClickListener
            actionJob = activity.lifecycleScope.launch {
                closeDrawer()
                // 与 MainActivity 当前最大 220ms 的抽屉收起动画对齐。
                delay(DRAWER_CLOSE_DURATION_MS)
                if (destroyed || activity.isFinishing || activity.isDestroyed ||
                    !activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) return@launch
                action()
            }
        }
        container.addView(row.root)
        rows += row
        return row
    }

    private suspend fun showThemePicker() {
        val current = SettingsPrefs.getThemeMode(activity)
        val modes = listOf(SettingsPrefs.ThemeMode.Dark, SettingsPrefs.ThemeMode.Light, SettingsPrefs.ThemeMode.System)
        val picked = showSettingsOptionPicker(
            context = activity,
            title = activity.getString(R.string.drawer_theme_appearance),
            options = listOf(
                SettingsOption("dark", activity.getString(R.string.settings_theme_dark)),
                SettingsOption("light", activity.getString(R.string.settings_theme_light)),
                SettingsOption("system", activity.getString(R.string.settings_theme_system)),
            ),
            selectedIndex = modes.indexOf(current),
        ) ?: return
        val mode = when (picked.id) {
            "dark" -> SettingsPrefs.ThemeMode.Dark
            "light" -> SettingsPrefs.ThemeMode.Light
            "system" -> SettingsPrefs.ThemeMode.System
            else -> return
        }
        if (destroyed || activity.isFinishing || activity.isDestroyed || mode == current) return
        SettingsPrefs.setThemeMode(activity, mode)
        refresh()
        AppCompatDelegate.setDefaultNightMode(SettingsPrefs.toNightMode(mode))
    }

    private fun openPage(page: Class<out android.app.Activity>) {
        activity.startActivity(Intent(activity, page))
        AppActivityTransitions.applyForward(activity)
    }

    private fun clearRows() {
        rows.forEach {
            it.root.setOnClickListener(null)
            (it.root.parent as? ViewGroup)?.removeView(it.root)
        }
        rows.clear()
        dividers.forEach { (it.parent as? ViewGroup)?.removeView(it) }
        dividers.clear()
        themeRow = null
        updateRow = null
    }

    private fun dp(value: Int): Int = (activity.resources.displayMetrics.density * value).toInt()

    private companion object {
        const val DRAWER_CLOSE_DURATION_MS = 220L
    }
}
