package cn.partialy.pm.ui.drawer

import android.content.Context
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
            schemaVersion = 1,
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
            schemaVersion = 1,
        )
    }

    private companion object {
        const val NAMESPACE = "sidebar_menu"
        const val KEY_MENU_CONFIG = "sidebar.menu_config"
        const val KEY_DISMISSED_BADGES = "sidebar.dismissed_badges"
    }
}

data class SidebarMenuUiState(
    val isLocalMode: Boolean = false,
    val listSection: SidebarListSectionDto = SidebarListSectionDto(),
    val gridSection: SidebarGridSectionDto = SidebarGridSectionDto(),
    val dismissedBadgeKeys: Set<String> = emptySet(),
    val updatedAt: Long = 0L,
) {
    val hasListItems: Boolean
        get() = !isLocalMode && listSection.enabled && listSection.items.isNotEmpty()

    val hasGridItems: Boolean
        get() = !isLocalMode && gridSection.enabled && gridSection.items.isNotEmpty()

    val hasUnreadOnceRedDot: Boolean
        get() {
            if (isLocalMode) return false
            val visibleItems = buildList {
                if (hasListItems) addAll(listSection.items)
                if (hasGridItems) addAll(gridSection.items)
            }
            return visibleItems.any { item ->
                item.badgeType == BADGE_DOT_ONCE &&
                    badgeKey(item) !in dismissedBadgeKeys
            }
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
            gson.fromJson(json, SidebarMenuConfigDto::class.java) ?: SidebarMenuConfigDto()
        }.getOrDefault(SidebarMenuConfigDto())
    }

    private fun normalizeConfig(raw: SidebarMenuConfigDto): SidebarMenuConfigDto {
        val listItems = raw.listSection.items
            .filter { it.id.isNotBlank() && it.name.isNotBlank() && it.url.isNotBlank() }
            .sortedBy { it.sortOrder }
        val gridItems = raw.gridSection.items
            .filter { it.id.isNotBlank() && it.name.isNotBlank() && it.url.isNotBlank() }
            .sortedBy { it.sortOrder }
        return SidebarMenuConfigDto(
            listSection = raw.listSection.copy(
                enabled = raw.listSection.enabled && listItems.isNotEmpty(),
                title = raw.listSection.title.trim(),
                items = listItems,
            ),
            gridSection = raw.gridSection.copy(
                enabled = raw.gridSection.enabled && gridItems.isNotEmpty(),
                position = if (raw.gridSection.position == "bottom") "bottom" else "top",
                items = gridItems,
            ),
            updatedAt = raw.updatedAt,
        )
    }

    private fun buildUiState(): SidebarMenuUiState {
        val effectiveList = if (localMode || !cachedConfig.listSection.enabled) {
            SidebarListSectionDto()
        } else {
            cachedConfig.listSection
        }
        val effectiveGrid = if (localMode || !cachedConfig.gridSection.enabled) {
            SidebarGridSectionDto()
        } else {
            cachedConfig.gridSection
        }
        return SidebarMenuUiState(
            isLocalMode = localMode,
            listSection = effectiveList,
            gridSection = effectiveGrid,
            dismissedBadgeKeys = dismissedKeys,
            updatedAt = cachedConfig.updatedAt,
        )
    }
}
