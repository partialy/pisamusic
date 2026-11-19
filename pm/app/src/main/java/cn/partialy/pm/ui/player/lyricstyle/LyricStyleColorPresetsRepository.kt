package cn.partialy.pm.ui.player.lyricstyle

import android.content.Context
import android.graphics.Color
import cn.partialy.pm.R
import cn.partialy.pm.utils.LyricDisplayPrefs
import cn.partialy.pm.utils.localdata.AppConfigStore
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.util.concurrent.ConcurrentHashMap

internal data class ColorPresetOpResult(
    val ok: Boolean,
    val errorMessage: String = "",
)

/**
 * 歌词样式配色预设独立仓库（底层复用 AppConfigStore，默认样式代理至 LyricDisplayPrefs 保持兼容）。
 * 每种样式的每个颜色设置项（Slot）均持久化为独立列表，最多 12 个、至少保留 1 个。
 */
internal class LyricStyleColorPresetsStore(
    private val configStore: AppConfigStore,
    private val effectConfigStore: LyricEffectConfigStore,
) {
    private val cache = ConcurrentHashMap<String, List<Int>>()
    private val lock = Any()

    fun getPresets(spec: LyricColorSlotSpec): List<Int> {
        val key = spec.storageKey()
        cache[key]?.let { return it }
        synchronized(lock) {
            cache[key]?.let { return it }
            val record = configStore.read(key)
            val parsed = decodeColors(record?.valueJson, spec.defaultPresets)
            cache[key] = parsed
            return parsed
        }
    }

    fun addPreset(spec: LyricColorSlotSpec, color: Int): PresetMutationOutcome {
        synchronized(lock) {
            val current = getPresets(spec).toMutableList()
            if (current.size >= MAX_PRESET_COUNT) {
                return PresetMutationOutcome.LimitReached
            }
            if (current.any { it == color }) {
                return PresetMutationOutcome.AlreadyExists
            }
            current.add(color)
            saveListLocked(spec, current)
            return PresetMutationOutcome.Success
        }
    }

    fun removePreset(spec: LyricColorSlotSpec, color: Int): PresetMutationOutcome {
        synchronized(lock) {
            val current = getPresets(spec).toMutableList()
            if (current.size <= 1) {
                return PresetMutationOutcome.KeepAtLeastOne
            }
            val removed = current.remove(color)
            if (!removed) {
                return PresetMutationOutcome.NotFound
            }
            val normalized = saveListLocked(spec, current)
            syncEffectColorAfterChange(spec, oldColor = null, newList = normalized)
            return PresetMutationOutcome.Success
        }
    }

    fun updatePreset(spec: LyricColorSlotSpec, index: Int, newColor: Int): PresetMutationOutcome {
        synchronized(lock) {
            val current = getPresets(spec).toMutableList()
            if (index !in current.indices) {
                return PresetMutationOutcome.InvalidIndex
            }
            val oldColor = current[index]
            if (oldColor != newColor && current.any { it == newColor }) {
                return PresetMutationOutcome.AlreadyExists
            }
            current[index] = newColor
            val normalized = saveListLocked(spec, current)
            syncEffectColorAfterChange(spec, oldColor = oldColor, replacementColor = newColor, newList = normalized)
            return PresetMutationOutcome.Success
        }
    }

    private fun saveListLocked(spec: LyricColorSlotSpec, colors: List<Int>): List<Int> {
        val normalized = colors
            .distinct()
            .take(MAX_PRESET_COUNT)
            .ifEmpty { spec.defaultPresets }
        val key = spec.storageKey()
        configStore.write(
            key = key,
            valueJson = json.encodeToString(normalized),
            namespace = NAMESPACE,
            schemaVersion = SCHEMA_VERSION,
        )
        cache[key] = normalized
        return normalized
    }

    private fun syncEffectColorAfterChange(
        spec: LyricColorSlotSpec,
        oldColor: Int?,
        replacementColor: Int? = null,
        newList: List<Int>,
    ) {
        val read = spec.readEffectColor ?: return
        val write = spec.writeEffectColor ?: return
        effectConfigStore.update { cfg ->
            val currentSelected = read(cfg)
            val nextSelected = when {
                oldColor != null && replacementColor != null && currentSelected == oldColor -> replacementColor
                newList.any { it == currentSelected } -> currentSelected
                else -> newList.firstOrNull() ?: currentSelected
            }
            if (nextSelected == currentSelected) cfg else write(cfg, nextSelected)
        }
    }

    private fun decodeColors(rawJson: String?, fallback: List<Int>): List<Int> {
        if (rawJson.isNullOrBlank()) return fallback
        val parsed = runCatching {
            json.decodeFromString<List<Int>>(rawJson)
        }.getOrNull() ?: return fallback
        val normalized = parsed.distinct().take(MAX_PRESET_COUNT)
        return if (normalized.isEmpty()) fallback else normalized
    }

    sealed class PresetMutationOutcome {
        data object Success : PresetMutationOutcome()
        data object LimitReached : PresetMutationOutcome()
        data object AlreadyExists : PresetMutationOutcome()
        data object KeepAtLeastOne : PresetMutationOutcome()
        data object InvalidIndex : PresetMutationOutcome()
        data object NotFound : PresetMutationOutcome()
    }

    companion object {
        const val MAX_PRESET_COUNT = LyricDisplayPrefs.PRESET_MAX_COUNT
        const val NAMESPACE = "lyric"
        const val SCHEMA_VERSION = 1

        private val json = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
        }
    }
}

internal object LyricStyleColorPresetsRepository {

    @Volatile
    private var sharedStore: LyricStyleColorPresetsStore? = null

    private fun store(context: Context): LyricStyleColorPresetsStore =
        sharedStore ?: synchronized(this) {
            sharedStore ?: run {
                val appCtx = context.applicationContext
                val configStore = AppConfigStore.shared(appCtx)
                LyricStyleColorPresetsStore(
                    configStore = configStore,
                    effectConfigStore = LyricEffectConfigStore(configStore),
                ).also { sharedStore = it }
            }
        }

    fun getPresets(context: Context, styleId: LyricEffectStyleId, slotKey: String): List<Int> {
        val spec = LyricColorPresetRegistry.findSlot(styleId, slotKey) ?: return emptyList()
        if (styleId == LyricEffectStyleId.DEFAULT) {
            return when (slotKey) {
                LyricColorPresetRegistry.SLOT_DEFAULT_NORMAL -> LyricDisplayPrefs.getNormalColorRgbPresets(context)
                LyricColorPresetRegistry.SLOT_DEFAULT_CURRENT -> LyricDisplayPrefs.getCurrentColorArgbPresets(context)
                else -> emptyList()
            }
        }
        return store(context).getPresets(spec)
    }

    fun addPreset(
        context: Context,
        styleId: LyricEffectStyleId,
        slotKey: String,
        color: Int,
    ): ColorPresetOpResult {
        val spec = LyricColorPresetRegistry.findSlot(styleId, slotKey)
            ?: return ColorPresetOpResult(false, context.getString(R.string.lyric_color_add_failed))

        if (styleId == LyricEffectStyleId.DEFAULT) {
            return addDefaultPreset(context, spec, color)
        }

        val outcome = store(context).addPreset(spec, spec.normalizeColor(color))
        return toOpResult(context, outcome, R.string.lyric_color_add_failed)
    }

    fun removePreset(
        context: Context,
        styleId: LyricEffectStyleId,
        slotKey: String,
        color: Int,
    ): ColorPresetOpResult {
        val spec = LyricColorPresetRegistry.findSlot(styleId, slotKey)
            ?: return ColorPresetOpResult(false, context.getString(R.string.lyric_color_keep_one))

        if (styleId == LyricEffectStyleId.DEFAULT) {
            val ok = when (slotKey) {
                LyricColorPresetRegistry.SLOT_DEFAULT_NORMAL -> LyricDisplayPrefs.removeNormalColorRgbPreset(context, color)
                LyricColorPresetRegistry.SLOT_DEFAULT_CURRENT -> LyricDisplayPrefs.removeCurrentColorArgbPreset(context, color)
                else -> false
            }
            if (ok) LyricDisplayPrefs.ensureStyleColorsMatchPresets(context)
            return if (ok) {
                ColorPresetOpResult(true)
            } else {
                ColorPresetOpResult(false, context.getString(R.string.lyric_color_keep_one))
            }
        }

        val outcome = store(context).removePreset(spec, spec.normalizeColor(color))
        if (outcome is LyricStyleColorPresetsStore.PresetMutationOutcome.Success) {
            LyricEffectConfigRepository.invalidateCache()
        }
        return toOpResult(context, outcome, R.string.lyric_color_keep_one)
    }

    fun updatePreset(
        context: Context,
        styleId: LyricEffectStyleId,
        slotKey: String,
        index: Int,
        color: Int,
    ): ColorPresetOpResult {
        val spec = LyricColorPresetRegistry.findSlot(styleId, slotKey)
            ?: return ColorPresetOpResult(false, context.getString(R.string.lyric_color_update_failed))

        if (styleId == LyricEffectStyleId.DEFAULT) {
            return updateDefaultPreset(context, spec, index, color)
        }

        val outcome = store(context).updatePreset(spec, index, spec.normalizeColor(color))
        if (outcome is LyricStyleColorPresetsStore.PresetMutationOutcome.Success) {
            LyricEffectConfigRepository.invalidateCache()
        }
        return toOpResult(context, outcome, R.string.lyric_color_update_failed)
    }

    private fun addDefaultPreset(
        context: Context,
        spec: LyricColorSlotSpec,
        color: Int,
    ): ColorPresetOpResult {
        val existing = getPresets(context, LyricEffectStyleId.DEFAULT, spec.slotKey)
        if (existing.size >= LyricDisplayPrefs.PRESET_MAX_COUNT) {
            return ColorPresetOpResult(
                false,
                context.getString(R.string.lyric_color_limit_reached, LyricDisplayPrefs.PRESET_MAX_COUNT),
            )
        }
        val normalized = spec.normalizeColor(color)
        if (existing.any { it == normalized }) {
            return ColorPresetOpResult(false, context.getString(R.string.lyric_color_exists))
        }
        val ok = when (spec.slotKey) {
            LyricColorPresetRegistry.SLOT_DEFAULT_NORMAL -> LyricDisplayPrefs.addNormalColorRgbPreset(context, normalized)
            LyricColorPresetRegistry.SLOT_DEFAULT_CURRENT -> LyricDisplayPrefs.addCurrentColorArgbPreset(context, normalized)
            else -> false
        }
        if (ok) LyricDisplayPrefs.ensureStyleColorsMatchPresets(context)
        return if (ok) {
            ColorPresetOpResult(true)
        } else {
            ColorPresetOpResult(false, context.getString(R.string.lyric_color_add_failed))
        }
    }

    private fun updateDefaultPreset(
        context: Context,
        spec: LyricColorSlotSpec,
        index: Int,
        color: Int,
    ): ColorPresetOpResult {
        val list = getPresets(context, LyricEffectStyleId.DEFAULT, spec.slotKey)
        if (index !in list.indices) {
            return ColorPresetOpResult(false, context.getString(R.string.lyric_color_index_invalid))
        }
        val oldColor = list[index]
        val normalized = spec.normalizeColor(color)
        if (oldColor != normalized && list.any { it == normalized }) {
            return ColorPresetOpResult(false, context.getString(R.string.lyric_color_exists))
        }
        val ok = when (spec.slotKey) {
            LyricColorPresetRegistry.SLOT_DEFAULT_NORMAL -> LyricDisplayPrefs.updateNormalColorRgbPreset(context, index, normalized)
            LyricColorPresetRegistry.SLOT_DEFAULT_CURRENT -> LyricDisplayPrefs.updateCurrentColorArgbPreset(context, index, normalized)
            else -> false
        }
        if (ok) {
            // 若当前样式选中了被编辑的那一项旧颜色，同步直接更新为新颜色；否则回退校验首项
            val style = LyricDisplayPrefs.readStyle(context)
            when (spec.slotKey) {
                LyricColorPresetRegistry.SLOT_DEFAULT_NORMAL -> {
                    val normalRgb = Color.rgb(
                        Color.red(style.normalColorArgb),
                        Color.green(style.normalColorArgb),
                        Color.blue(style.normalColorArgb),
                    )
                    if (normalRgb == oldColor) {
                        LyricDisplayPrefs.writeStyle(context, style.copy(normalColorArgb = normalized))
                    } else {
                        LyricDisplayPrefs.ensureStyleColorsMatchPresets(context)
                    }
                }
                LyricColorPresetRegistry.SLOT_DEFAULT_CURRENT -> {
                    if (style.currentColorArgb == oldColor) {
                        LyricDisplayPrefs.writeStyle(context, style.copy(currentColorArgb = normalized))
                    } else {
                        LyricDisplayPrefs.ensureStyleColorsMatchPresets(context)
                    }
                }
            }
        }
        return if (ok) {
            ColorPresetOpResult(true)
        } else {
            ColorPresetOpResult(false, context.getString(R.string.lyric_color_update_failed))
        }
    }

    private fun toOpResult(
        context: Context,
        outcome: LyricStyleColorPresetsStore.PresetMutationOutcome,
        fallbackRes: Int,
    ): ColorPresetOpResult = when (outcome) {
        LyricStyleColorPresetsStore.PresetMutationOutcome.Success -> ColorPresetOpResult(true)
        LyricStyleColorPresetsStore.PresetMutationOutcome.LimitReached -> ColorPresetOpResult(
            false,
            context.getString(R.string.lyric_color_limit_reached, LyricStyleColorPresetsStore.MAX_PRESET_COUNT),
        )
        LyricStyleColorPresetsStore.PresetMutationOutcome.AlreadyExists -> ColorPresetOpResult(
            false,
            context.getString(R.string.lyric_color_exists),
        )
        LyricStyleColorPresetsStore.PresetMutationOutcome.KeepAtLeastOne -> ColorPresetOpResult(
            false,
            context.getString(R.string.lyric_color_keep_one),
        )
        LyricStyleColorPresetsStore.PresetMutationOutcome.InvalidIndex -> ColorPresetOpResult(
            false,
            context.getString(R.string.lyric_color_index_invalid),
        )
        LyricStyleColorPresetsStore.PresetMutationOutcome.NotFound -> ColorPresetOpResult(
            false,
            context.getString(fallbackRes),
        )
    }
}
