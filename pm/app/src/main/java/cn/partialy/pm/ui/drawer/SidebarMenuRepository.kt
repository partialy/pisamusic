package cn.partialy.pm.ui.drawer

import android.content.Context
import cn.partialy.pm.model.SidebarBuiltinItemDto
import cn.partialy.pm.model.SidebarGridSectionDto
import cn.partialy.pm.model.SidebarListSectionDto
import cn.partialy.pm.model.SidebarMenuConfigDto
import cn.partialy.pm.model.SidebarMenuItemDto
import cn.partialy.pm.utils.localdata.AppConfigStore
import com.google.gson.Gson
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import javax.inject.Inject
import javax.inject.Singleton

interface SidebarMenuCache {
    fun readConfigJson(): String?
    fun writeConfigJson(json: String)
    fun readDismissedBadgeKeys(): Set<String>
    fun writeDismissedBadgeKeys(keys: Set<String>)
}

class NoOpSidebarMenuCache : SidebarMenuCache {
    override fun readConfigJson(): String? = null
    override fun writeConfigJson(json: String) = Unit
    override fun readDismissedBadgeKeys(): Set<String> = emptySet()
    override fun writeDismissedBadgeKeys(keys: Set<String>) = Unit
}

private class AppConfigSidebarMenuCache(context: Context) : SidebarMenuCache {
    private val store = AppConfigStore.shared(context.applicationContext)

    override fun readConfigJson(): String? = store.read(KEY_MENU_CONFIG)?.valueJson

    override fun writeConfigJson(json: String) {
        store.write(
            key = KEY_MENU_CONFIG,
            valueJson = json,
            namespace = NAMESPACE,
            schemaVersion = 2,
        )
    }

    override fun readDismissedBadgeKeys(): Set<String> {
        val raw = store.read(KEY_DISMISSED_BADGES)?.valueJson ?: return emptySet()
        return runCatching {
            val array = JSONArray(raw)
            buildSet {
                for (i in 0 until array.length()) {
                    val value = array.optString(i).trim()
                    if (value.isNotEmpty()) add(value)
                }
            }
        }.getOrDefault(emptySet())
    }

    override fun writeDismissedBadgeKeys(keys: Set<String>) {
        val array = JSONArray()
        keys.sorted().forEach { array.put(it) }
        store.write(
            key = KEY_DISMISSED_BADGES,
            valueJson = array.toString(),
            namespace = NAMESPACE,
            schemaVersion = 2,
        )
    }

    private companion object {
        const val NAMESPACE = "sidebar_menu"
        const val KEY_MENU_CONFIG = "sidebar.menu_config"
        const val KEY_DISMISSED_BADGES = "sidebar.dismissed_badges"
    }
}

object SidebarBuiltinKeys {
    const val IMPORT_PLAYLISTS = "import_playlists"
    const val LINK_IMPORT = "link_import"
    const val SLEEP_TIMER = "sleep_timer"
    const val THEME = "theme"

    val ORDERED = listOf(IMPORT_PLAYLISTS, LINK_IMPORT, SLEEP_TIMER, THEME)

    fun defaultItems(): List<SidebarBuiltinItemDto> = ORDERED.map { key ->
        SidebarBuiltinItemDto(
            key = key,
            enabled = true,
            name = "",
            iconType = "default",
            iconValue = "",
        )
    }
}

data class SidebarMenuUiState(
    val isLocalMode: Boolean = false,
    val builtinItems: List<SidebarBuiltinItemDto> = SidebarBuiltinKeys.defaultItems(),
    val listSections: List<SidebarListSectionDto> = emptyList(),
    val gridSection: SidebarGridSectionDto = SidebarGridSectionDto(),
    val dismissedBadgeKeys: Set<String> = emptySet(),
    val updatedAt: Long = 0L,
) {
    val hasListSections: Boolean
        get() = !isLocalMode && listSections.any { it.enabled && it.items.isNotEmpty() }

    val hasGridItems: Boolean
        get() = !isLocalMode && gridSection.enabled && gridSection.items.isNotEmpty()

    val hasUnreadOnceRedDot: Boolean
        get() {
            if (isLocalMode) return false
            val visibleItems = buildList {
                if (hasListSections) {
                    listSections.forEach { sec ->
                        if (sec.enabled) addAll(sec.items)
                    }
                }
                if (hasGridItems) addAll(gridSection.items)
            }
            return visibleItems.any { item ->
                item.badgeType == BADGE_DOT_ONCE &&
                    badgeKey(item) !in dismissedBadgeKeys
            }
        }

    fun findBuiltin(key: String): SidebarBuiltinItemDto {
        return builtinItems.firstOrNull { it.key == key }
            ?: SidebarBuiltinItemDto(key = key, enabled = true, name = "", iconType = "default", iconValue = "")
    }

    fun shouldShowRedDot(item: SidebarMenuItemDto): Boolean {
        return when (item.badgeType) {
            BADGE_DOT_ALWAYS -> true
            BADGE_DOT_ONCE -> badgeKey(item) !in dismissedBadgeKeys
            else -> false
        }
    }

    companion object {
        const val BADGE_NONE = "none"
        const val BADGE_TEXT = "text"
        const val BADGE_DOT_ONCE = "dot_once"
        const val BADGE_DOT_ALWAYS = "dot_always"
        const val OPEN_APP_ACTION = "app_action"
        const val OPEN_FULLSCREEN_WEB = "fullscreen_web"

        fun badgeKey(item: SidebarMenuItemDto): String = "${item.id}:${item.badgeVersion}"
    }
}

@Singleton
class SidebarMenuRepository(
    private val cache: SidebarMenuCache,
) {
    @Inject
    constructor(@ApplicationContext context: Context) : this(AppConfigSidebarMenuCache(context))

    private val gson = Gson()
    private val lock = Any()
    private var cachedConfig: SidebarMenuConfigDto = loadCachedConfig()
    private var dismissedKeys: Set<String> = cache.readDismissedBadgeKeys()
    private var localMode: Boolean = false

    private val _state = MutableStateFlow(buildUiState())
    val state: StateFlow<SidebarMenuUiState> = _state.asStateFlow()

    fun setLocalMode(enabled: Boolean) {
        synchronized(lock) {
            if (localMode == enabled) return
            localMode = enabled
            _state.value = buildUiState()
        }
    }

    fun updateFromServer(config: SidebarMenuConfigDto?) {
        if (config == null) return
        val normalized = normalizeConfig(config)
        synchronized(lock) {
            cachedConfig = normalized
            runCatching { cache.writeConfigJson(gson.toJson(normalized)) }
            _state.value = buildUiState()
        }
    }

    fun markItemClicked(item: SidebarMenuItemDto) {
        if (item.badgeType != SidebarMenuUiState.BADGE_DOT_ONCE) return
        val key = SidebarMenuUiState.badgeKey(item)
        synchronized(lock) {
            if (key in dismissedKeys) return
            val updated = dismissedKeys + key
            dismissedKeys = updated
            runCatching { cache.writeDismissedBadgeKeys(updated) }
            _state.value = buildUiState()
        }
    }

    private fun loadCachedConfig(): SidebarMenuConfigDto {
        val json = cache.readConfigJson()?.takeIf { it.isNotBlank() } ?: return SidebarMenuConfigDto()
        return runCatching {
            val parsed = gson.fromJson(json, SidebarMenuConfigDto::class.java) ?: return@runCatching SidebarMenuConfigDto()
            normalizeConfig(parsed)
        }.getOrDefault(SidebarMenuConfigDto())
    }

    private fun isValidItem(item: SidebarMenuItemDto): Boolean {
        if (item.id.isBlank() || item.name.isBlank()) return false
        return if (item.openType == SidebarMenuUiState.OPEN_APP_ACTION) {
            item.actionKey.isNotBlank()
        } else {
            item.url.isNotBlank()
        }
    }

    private fun normalizeConfig(raw: SidebarMenuConfigDto): SidebarMenuConfigDto {
        val rawBuiltinByKey = raw.builtinItems.associateBy { it.key }
        val builtinItems = SidebarBuiltinKeys.ORDERED.map { key ->
            val found = rawBuiltinByKey[key]
            if (found == null) {
                SidebarBuiltinItemDto(key = key, enabled = true, name = "", iconType = "default", iconValue = "")
            } else {
                found.copy(
                    name = found.name.trim(),
                    iconType = found.iconType.ifBlank { "default" },
                    iconValue = found.iconValue.trim(),
                )
            }
        }

        val sourceSections = if (raw.listSections.isNotEmpty()) {
            raw.listSections
        } else if (raw.listSection.enabled && raw.listSection.items.isNotEmpty()) {
            listOf(raw.listSection.copy(id = raw.listSection.id.ifBlank { "default" }))
        } else {
            emptyList()
        }

        val listSections = sourceSections
            .sortedBy { it.sortOrder }
            .mapNotNull { sec ->
                if (!sec.enabled) return@mapNotNull null
                val validItems = sec.items.filter(::isValidItem).sortedBy { it.sortOrder }
                if (validItems.isEmpty()) return@mapNotNull null
                sec.copy(
                    enabled = true,
                    title = sec.title.trim(),
                    items = validItems,
                )
            }

        val gridItems = raw.gridSection.items
            .filter(::isValidItem)
            .sortedBy { it.sortOrder }

        return SidebarMenuConfigDto(
            schemaVersion = raw.schemaVersion.coerceAtLeast(2),
            builtinItems = builtinItems,
            listSections = listSections,
            gridSection = raw.gridSection.copy(
                enabled = raw.gridSection.enabled && gridItems.isNotEmpty(),
                position = if (raw.gridSection.position == "bottom") "bottom" else "top",
                items = gridItems,
            ),
            updatedAt = raw.updatedAt,
        )
    }

    private fun buildUiState(): SidebarMenuUiState {
        if (localMode) {
            return SidebarMenuUiState(
                isLocalMode = true,
                builtinItems = SidebarBuiltinKeys.defaultItems(),
                listSections = emptyList(),
                gridSection = SidebarGridSectionDto(),
                dismissedBadgeKeys = dismissedKeys,
                updatedAt = cachedConfig.updatedAt,
            )
        }
        val effectiveBuiltins = if (cachedConfig.builtinItems.isNotEmpty()) {
            cachedConfig.builtinItems
        } else {
            SidebarBuiltinKeys.defaultItems()
        }
        val effectiveGrid = if (!cachedConfig.gridSection.enabled) {
            SidebarGridSectionDto()
        } else {
            cachedConfig.gridSection
        }
        return SidebarMenuUiState(
            isLocalMode = false,
            builtinItems = effectiveBuiltins,
            listSections = cachedConfig.listSections,
            gridSection = effectiveGrid,
            dismissedBadgeKeys = dismissedKeys,
            updatedAt = cachedConfig.updatedAt,
        )
    }
}
