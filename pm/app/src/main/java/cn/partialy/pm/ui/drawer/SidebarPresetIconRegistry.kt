package cn.partialy.pm.ui.drawer

import androidx.annotation.DrawableRes
import cn.partialy.pm.R

/**
 * 侧栏动态菜单预置图标键映射表（后续可直接在此扩充更多预置 key）。
 */
object SidebarPresetIconRegistry {

    private val icons: Map<String, Int> = mapOf(
        "link" to R.drawable.ic_link_24,
        "alarm" to R.drawable.ic_alarm_24,
        "theme" to R.drawable.ic_sider_theme_24,
        "feedback" to R.drawable.ic_sider_feedback_24,
        "announcement" to R.drawable.ic_sider_announcement_24,
        "update" to R.drawable.ic_sider_update_24,
        "settings" to R.drawable.ic_settings_24,
        "scan" to R.drawable.ic_scan_qrcode_24,
    )

    @DrawableRes
    fun resolve(key: String?): Int? {
        val clean = key?.trim().orEmpty()
        if (clean.isEmpty()) return null
        return icons[clean]
    }
}
