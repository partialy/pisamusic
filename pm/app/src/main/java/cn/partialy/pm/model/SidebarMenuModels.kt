package cn.partialy.pm.model

data class SidebarMenuResponse(
    val msg: String = "",
    val code: Int = 0,
    val success: Boolean = true,
    val data: SidebarMenuConfigDto? = null,
)

data class SidebarMenuConfigDto(
    val schemaVersion: Int = 2,
    val builtinItems: List<SidebarBuiltinItemDto> = emptyList(),
    val listSections: List<SidebarListSectionDto> = emptyList(),
    val listSection: SidebarListSectionDto = SidebarListSectionDto(),
    val gridSection: SidebarGridSectionDto = SidebarGridSectionDto(),
    val updatedAt: Long = 0L,
)

data class SidebarBuiltinItemDto(
    val key: String = "",
    val enabled: Boolean = true,
    val name: String = "",
    val iconType: String = "default",
    val iconValue: String = "",
)

data class SidebarListSectionDto(
    val id: String = "",
    val enabled: Boolean = false,
    val sortOrder: Int = 0,
    val title: String = "",
    val items: List<SidebarMenuItemDto> = emptyList(),
)

data class SidebarGridSectionDto(
    val enabled: Boolean = false,
    val position: String = "top",
    val items: List<SidebarMenuItemDto> = emptyList(),
)

data class SidebarMenuItemDto(
    val id: String = "",
    val sortOrder: Int = 0,
    val name: String = "",
    val iconType: String = "none",
    val iconValue: String = "",
    val badgeType: String = "none",
    val subtitleText: String = "",
    val badgeVersion: Int = 1,
    val openType: String = "web",
    val url: String = "",
    val actionKey: String = "",
)
