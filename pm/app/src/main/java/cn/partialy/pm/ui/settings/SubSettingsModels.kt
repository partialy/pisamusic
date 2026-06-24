package cn.partialy.pm.ui.settings

data class SubSettingsSection(
    val id: String,
    val title: CharSequence? = null,
    val items: List<SubSettingsItem>,
)

sealed interface SubSettingsItem {
    val id: String
    val title: CharSequence
    val summary: CharSequence?
    val enabled: Boolean

    data class Option(
        override val id: String,
        override val title: CharSequence,
        val value: CharSequence? = null,
        override val summary: CharSequence? = null,
        override val enabled: Boolean = true,
    ) : SubSettingsItem

    data class Navigation(
        override val id: String,
        override val title: CharSequence,
        override val summary: CharSequence? = null,
        override val enabled: Boolean = true,
    ) : SubSettingsItem

    data class Switch(
        override val id: String,
        override val title: CharSequence,
        val checked: Boolean,
        override val summary: CharSequence? = null,
        override val enabled: Boolean = true,
    ) : SubSettingsItem
}
