package cn.partialy.pm.audioeffect

import android.content.Context
import kotlinx.serialization.SerializationException
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

object AudioEffectsPrefs {
    private const val PREFS_NAME = "audio_effects_settings"
    private const val KEY_STATE = "state"

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    fun readState(context: Context): AudioEffectState {
        val raw = prefs(context).getString(KEY_STATE, null) ?: return AudioEffectState()
        return decodeState(raw)
    }

    fun saveState(context: Context, state: AudioEffectState) {
        prefs(context)
            .edit()
            .putString(KEY_STATE, encodeState(state.normalized()))
            .apply()
    }

    internal fun encodeState(state: AudioEffectState): String =
        json.encodeToString(state.normalized())

    internal fun decodeState(raw: String): AudioEffectState =
        try {
            json.decodeFromString<AudioEffectState>(raw).normalized()
        } catch (_: SerializationException) {
            AudioEffectState()
        } catch (_: IllegalArgumentException) {
            AudioEffectState()
        }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
