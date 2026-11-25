package cn.partialy.pm.ui.drawer

import androidx.appcompat.app.AppCompatDelegate
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import cn.partialy.pm.R
import cn.partialy.pm.databinding.MainDrawerContentBinding
import cn.partialy.pm.ui.dialog.SettingsOption
import cn.partialy.pm.ui.dialog.showSettingsOptionPicker
import cn.partialy.pm.utils.SettingsPrefs
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** 侧栏「主题外观」内置入口控制器，负责模式图标刷新与主题选择弹窗。 */
class DrawerQuickActions(
    private val activity: FragmentActivity,
    private val closeDrawer: () -> Unit,
) {
    private var binding: MainDrawerContentBinding? = null
    private var actionJob: Job? = null
    private var destroyed = false

    fun bind(drawerBinding: MainDrawerContentBinding) {
        if (destroyed) return
        binding = drawerBinding
        drawerBinding.drawerThemeRow.setOnClickListener {
            if (destroyed || actionJob?.isActive == true) return@setOnClickListener
            actionJob = activity.lifecycleScope.launch {
                closeDrawer()
                // 与 MainActivity 当前最大 220ms 的抽屉收起动画对齐。
                delay(DRAWER_CLOSE_DURATION_MS)
                if (destroyed || activity.isFinishing || activity.isDestroyed ||
                    !activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)
                ) {
                    return@launch
                }
                showThemePicker()
            }
        }
        refresh()
    }

    fun refresh() {
        if (destroyed) return
        val b = binding ?: return
        val mode = SettingsPrefs.getThemeMode(activity)
        val (icon, description) = when (mode) {
            SettingsPrefs.ThemeMode.Light -> R.drawable.ic_sider_sun_24 to R.string.settings_theme_light
            SettingsPrefs.ThemeMode.Dark -> R.drawable.ic_sider_moon_24 to R.string.settings_theme_dark
            SettingsPrefs.ThemeMode.System -> R.drawable.ic_sider_theme_auto_24 to R.string.settings_theme_system
        }
        b.drawerThemeModeIcon.setImageResource(icon)
        val titleText = b.drawerThemeTitle.text?.toString()?.takeIf { it.isNotBlank() }
            ?: activity.getString(R.string.drawer_theme_appearance)
        b.drawerThemeRow.contentDescription = "$titleText，${activity.getString(description)}"
    }

    fun destroy() {
        destroyed = true
        // 通用选择器在协程取消时自动 dismiss，不保留宿主已销毁的 Dialog。
        actionJob?.cancel()
        actionJob = null
        binding?.drawerThemeRow?.setOnClickListener(null)
        binding = null
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

    private companion object {
        const val DRAWER_CLOSE_DURATION_MS = 220L
    }
}
